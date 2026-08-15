// Sketch only — illustrates how Task 1's coordinator contract maps onto XState.
// Not wired to real dependencies; compare against lib/auth/bootstrap-coordinator.ts (planned).
//
// Revised after plan review (second revision). Fixes vs the first draft:
//   - `error` is NOT a final state (a final state stops the actor permanently, so a
//     transient sync failure could never recover without a page reload).
//   - `applyTransition` is actually invoked (it was declared but orphaned).
//   - `generation` is assigned by the machine — XState cancels the *actor*, but it
//     cannot cancel a fetchScenario promise already in flight inside a store, so the
//     stores still need a generation to reject stale commits.
//   - Hydration is split guest-scope-first / user-scope-after-identity, because
//     scoped storage keys are not knowable until getUser() resolves.
//   - AUTH_EVENTs arriving during hydratingGuest/hydratingUser are CAPTURED by
//     target-less handlers on those two states, never allowed to re-target and cancel
//     the in-flight hydration: the listener registers before start(), so supabase's
//     INITIAL_SESSION typically arrives mid-guest-hydration, and cancelling there
//     would abort the one-time legacy migration. A captured event is applied after
//     the hydration settles — via applyingTransition directly when it names the
//     hydrated user, or via authenticating (which re-resolves identity and re-hydrates
//     the superseding scope) when it names a different user. `hydratedUserId` stops
//     that re-resolution from re-hydrating an already-hydrated scope (which would loop).
//   - `mfaRequired` has NO `MFA_ELEVATED` transition — elevation triggers a full
//     navigation, the provider remounts, and the actor is rebuilt from hydratingGuest.
//   - `pendingEvent` is normalised on entry to applyingTransition (synthetic
//     INITIAL_SESSION when nothing was captured), so the claim/sync guard reads the
//     same value on the startup path and the event path. The first draft had the
//     guard read `context.pendingEvent` while the startup path only put the synthetic
//     event in the actor input — startup claims would never have run.
//   - The claim/sync guard also requires a non-null userId, so a captured null-user
//     event (SIGNED_OUT mid-hydration) falls through to `ready` instead of syncing.
//
// Param types on the setup callbacks below are written explicitly because `xstate`
// is not installed yet (Task 1 adds it); without them these callbacks would be
// untyped. Once the dependency lands the annotations can be removed.

import { setup, assign, fromPromise } from "xstate"
import type { User } from "@supabase/supabase-js"

type AuthEventType =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"

interface AuthEvent {
  type: AuthEventType
  userId: string | null
  hasSession: boolean
}

const CLAIM_EVENT_TYPES = new Set<AuthEventType>(["SIGNED_IN", "INITIAL_SESSION"])

interface Context {
  userId: string | null
  // Set on hydratingUser entry. Lets authenticating tell "scope already hydrated
  // for this user" from "needs hydration" when a captured event re-resolves
  // identity — without it, a superseding event would re-enter hydratingUser forever.
  hydratedUserId: string | null
  error: Error | null
  // XState's built-in event queue + invoke cancellation replaces the hand-rolled
  // queue[]/drain() loop: a new `AUTH_EVENT` while mid-transition re-enters
  // `authenticating` and the in-flight actor for the OLD event is auto-stopped.
  // ...but actor cancellation does NOT reach promises already in flight *inside*
  // the stores. `generation` is incremented on every identity transition and passed
  // into syncFromDb/syncExpensesFromDb so those can drop a late response.
  pendingEvent: AuthEvent | null
  generation: number
}

// Shorthand param types for setup callbacks (see header comment).
type C = { context: Context }
type CE = { context: Context; event: any }
type E = { event: any }

const INITIAL_EVENT = (userId: string | null): AuthEvent => ({
  type: "INITIAL_SESSION",
  userId,
  hasSession: userId != null,
})

export const bootstrapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as { type: "AUTH_EVENT"; event: AuthEvent },
  },
  guards: {
    // TOKEN_REFRESHED / USER_UPDATED / PASSWORD_RECOVERY must never claim or sync,
    // and neither may a null-user event (e.g. a captured SIGNED_OUT). Expressed as
    // a guard on the transition INTO syncing so the skip is visible in the chart
    // rather than buried in an if-branch inside the actor.
    mayClaimAndSync: ({ context }: C) =>
      context.pendingEvent != null &&
      context.userId != null &&
      CLAIM_EVENT_TYPES.has(context.pendingEvent.type),
    mfaRequired: ({ event }: E) =>
      event.output?.current === "aal1" && event.output?.next === "aal2",
    // True when nothing was captured during the hydration, or the captured event
    // names the user whose scope was just hydrated — only then is applying safe.
    scopeStillCurrent: ({ context }: C) =>
      context.pendingEvent == null || context.pendingEvent.userId === context.userId,
  },
  actors: {
    // Guest-scoped hydration. Runs before identity is known, so it can only ever
    // read the guest key. Legacy un-scoped migration runs here too: it routes on the
    // sessionId *inside the legacy payload*, so it does not need the current user.
    hydrateGuestScope: fromPromise(async () => {
      /* migrateLegacyKeys(); setScope({kind:"guest"}); hydrate both stores */
    }),
    resolveIdentity: fromPromise(async () => {
      /* dependencies.getUser() -> User | null */
      return null as User | null
    }),
    // Second hydration, user-scoped. This is why the "hydrate exactly once"
    // criterion must become "hydrate once per scope".
    hydrateUserScope: fromPromise(async ({ input }: { input: { userId: string } }) => {
      /* setScope({kind:"user",userId}); rehydrate() */
    }),
    applyTransition: fromPromise(
      async ({ input }: { input: { event: AuthEvent; generation: number } }) => {
        /* dependencies.applyAuthTransition(event, generation) */
      }
    ),
    checkAal: fromPromise(async ({ input }: { input: { userId: string } }) => {
      /* dependencies.currentAal() — MUST be token-aware; see lib/supabase/proxy.ts */
      return { current: "aal2", next: null as string | null }
    }),
    claimAndSync: fromPromise(
      async ({ input }: { input: { userId: string; event: AuthEvent; generation: number } }) => {
        /* claimLocalData(source) -> syncFromDb(userId, gen) -> syncExpensesFromDb(userId, gen) */
      }
    ),
  },
}).createMachine({
  id: "bootstrap",
  initial: "hydratingGuest",
  context: { userId: null, hydratedUserId: null, error: null, pendingEvent: null, generation: 0 },

  // A late AUTH_EVENT from any state except the two hydration states re-targets
  // `authenticating` with the new event in context and a bumped generation. Leaving
  // whichever state we were in stops its invoked actor, so the superseded transition
  // can never commit. This single handler is the whole anti-clobber guarantee.
  // NOTE: this must remain reachable from `error` — hence `error` is not final.
  // NOTE: hydratingGuest/hydratingUser override this with target-less CAPTURE
  // handlers (see Design Decisions): a re-target from there would cancel the
  // in-flight hydration and abort the one-time legacy migration.
  on: {
    AUTH_EVENT: {
      target: ".authenticating",
      actions: assign({
        pendingEvent: ({ event }: E) => event.event,
        generation: ({ context }: C) => context.generation + 1,
      }),
    },
  },

  states: {
    hydratingGuest: {
      // Capture, do not re-target: the listener registers before start(), so
      // supabase's INITIAL_SESSION typically arrives while this is still running.
      on: {
        AUTH_EVENT: {
          actions: assign({
            pendingEvent: ({ event }: E) => event.event,
            generation: ({ context }: C) => context.generation + 1,
          }),
        },
      },
      invoke: {
        src: "hydrateGuestScope",
        onDone: "authenticating",
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    authenticating: {
      invoke: {
        src: "resolveIdentity",
        onDone: [
          // Verified user whose scope is already hydrated: applying is safe now.
          {
            guard: ({ context, event }: CE) =>
              event.output != null && context.hydratedUserId === (event.output as User).id,
            target: "applyingTransition",
          },
          // Verified user whose scope is not yet hydrated.
          {
            guard: ({ event }: E) => event.output != null,
            target: "hydratingUser",
            actions: assign({ userId: ({ event }: E) => (event.output as User).id }),
          },
          // A captured event (e.g. SIGNED_OUT during hydration) must still be applied
          // even when no session remains — the null-user shortcut to ready is
          // startup-only, so it is guarded on no event being held.
          {
            guard: ({ context }: C) => context.pendingEvent != null,
            target: "applyingTransition",
            actions: assign({ userId: null }),
          },
          { target: "ready", actions: assign({ userId: null }) },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    hydratingUser: {
      // Capture, do not re-target (same reason as hydratingGuest).
      on: {
        AUTH_EVENT: {
          actions: assign({
            pendingEvent: ({ event }: E) => event.event,
            generation: ({ context }: C) => context.generation + 1,
          }),
        },
      },
      entry: assign({ hydratedUserId: ({ context }: C) => context.userId }),
      invoke: {
        src: "hydrateUserScope",
        input: ({ context }: C) => ({ userId: context.userId! }),
        // If the captured event names the hydrated user (or nothing was captured),
        // applying is safe immediately. A different user — or a null-user event like
        // SIGNED_OUT — re-resolves identity first, so a superseding user's scope is
        // hydrated before anything is applied, and sign-out cleanup is not skipped.
        onDone: [
          { guard: "scopeStillCurrent", target: "applyingTransition" },
          { target: "authenticating" },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    applyingTransition: {
      // Normalise the startup path so the claim/sync guard reads the same value
      // everywhere: without this, pendingEvent stays null on startup and
      // mayClaimAndSync would silently skip the first sign-in's claim.
      entry: assign({
        pendingEvent: ({ context }: C) => context.pendingEvent ?? INITIAL_EVENT(context.userId),
      }),
      invoke: {
        src: "applyTransition",
        input: ({ context }: C) => ({
          event: context.pendingEvent!,
          generation: context.generation,
        }),
        onDone: "checkingAal",
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    checkingAal: {
      invoke: {
        src: "checkAal",
        input: ({ context }: C) => ({ userId: context.userId! }),
        onDone: [
          { guard: "mfaRequired", target: "mfaRequired" },
          { guard: "mayClaimAndSync", target: "syncing" },
          // Token refresh / user update / sign-out: no claim, no sync.
          { target: "ready" },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    mfaRequired: {
      // Terminal resting state for this actor: MFA elevation triggers a full
      // navigation, the provider remounts, and the actor is rebuilt from
      // hydratingGuest. There is deliberately NO `MFA_ELEVATED` event — if in-place
      // elevation is ever introduced, the event is added then, with a test that
      // actually sends it.
    },

    syncing: {
      invoke: {
        src: "claimAndSync",
        input: ({ context }: C) => ({
          userId: context.userId!,
          event: context.pendingEvent!,
          generation: context.generation,
        }),
        onDone: "ready",
        onError: { target: "error", actions: assign({ error: ({ event }: E) => event.error as Error }) },
      },
    },

    ready: {},

    // Deliberately NOT `type: "final"` — the actor must stay alive so a later
    // AUTH_EVENT (e.g. a retry, or a sign-out) can still be processed.
    error: {},
  },
})
