// Sketch only — illustrates how Task 1's coordinator contract maps onto XState.
// Not wired to real dependencies; compare against lib/auth/bootstrap-coordinator.ts (planned).
//
// Revised after plan review. Fixes vs the first draft:
//   - `error` is NOT a final state (a final state stops the actor permanently, so a
//     transient sync failure could never recover without a page reload).
//   - `applyTransition` is actually invoked (it was declared but orphaned).
//   - `generation` is assigned by the machine — XState cancels the *actor*, but it
//     cannot cancel a fetchScenario promise already in flight inside a store, so the
//     stores still need a generation to reject stale commits.
//   - Hydration is split guest-scope-first / user-scope-after-identity, because
//     scoped storage keys are not knowable until getUser() resolves.

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
  error: Error | null
  // XState's built-in event queue + invoke cancellation replaces the hand-rolled
  // queue[]/drain() loop: a new `AUTH_EVENT` while mid-transition re-enters
  // `authenticating` and the in-flight actor for the OLD event is auto-stopped.
  pendingEvent: AuthEvent | null
  // ...but actor cancellation does NOT reach promises already in flight *inside*
  // the stores. `generation` is incremented on every identity transition and passed
  // into syncFromDb/syncExpensesFromDb so those can drop a late response.
  generation: number
}

export const bootstrapMachine = setup({
  types: {
    context: {} as Context,
    events: {} as
      | { type: "AUTH_EVENT"; event: AuthEvent }
      | { type: "MFA_ELEVATED" },
  },
  guards: {
    // TOKEN_REFRESHED / USER_UPDATED / PASSWORD_RECOVERY must never claim or sync.
    // Expressed as a guard on the transition INTO syncing so the skip is visible in
    // the chart rather than buried in an if-branch inside the actor.
    mayClaimAndSync: ({ context }) =>
      context.pendingEvent != null && CLAIM_EVENT_TYPES.has(context.pendingEvent.type),
    mfaRequired: ({ event }: any) =>
      event.output?.current === "aal1" && event.output?.next === "aal2",
  },
  actors: {
    // Guest-scoped hydration. Runs before identity is known, so it can only ever
    // read the guest key. Legacy un-scoped migration runs here too: it routes on the
    // sessionId *inside the legacy payload*, so it does not need the current user.
    hydrateGuestScope: fromPromise(async () => {
      /* migrateLegacyKeys(); setScope({kind:"guest"}); hydrateStores() */
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
  context: { userId: null, error: null, pendingEvent: null, generation: 0 },

  // A late AUTH_EVENT from any state re-targets `authenticating` with the new event
  // in context and a bumped generation. Leaving whichever state we were in stops its
  // invoked actor, so the superseded transition can never commit. This single handler
  // is the whole anti-clobber guarantee.
  // NOTE: this must remain reachable from `error` — hence `error` is not final.
  on: {
    AUTH_EVENT: {
      target: ".authenticating",
      actions: assign({
        pendingEvent: ({ event }) => event.event,
        generation: ({ context }) => context.generation + 1,
      }),
    },
  },

  states: {
    hydratingGuest: {
      invoke: {
        src: "hydrateGuestScope",
        onDone: "authenticating",
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    authenticating: {
      invoke: {
        src: "resolveIdentity",
        onDone: [
          {
            guard: ({ event }) => event.output != null,
            target: "hydratingUser",
            actions: assign({ userId: ({ event }) => (event.output as User).id }),
          },
          // No session: guest scope is already hydrated, nothing further to do.
          { target: "ready", actions: assign({ userId: null }) },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    hydratingUser: {
      invoke: {
        src: "hydrateUserScope",
        input: ({ context }) => ({ userId: context.userId! }),
        onDone: "applyingTransition",
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    applyingTransition: {
      invoke: {
        src: "applyTransition",
        input: ({ context }) => ({
          event: context.pendingEvent ?? {
            type: "INITIAL_SESSION" as const,
            userId: context.userId,
            hasSession: true,
          },
          generation: context.generation,
        }),
        onDone: "checkingAal",
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    checkingAal: {
      invoke: {
        src: "checkAal",
        input: ({ context }) => ({ userId: context.userId! }),
        onDone: [
          { guard: "mfaRequired", target: "mfaRequired" },
          { guard: "mayClaimAndSync", target: "syncing" },
          // Token refresh / user update: identity unchanged, no claim, no sync.
          { target: "ready" },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    mfaRequired: {
      // Only reachable if elevation happens IN PLACE (client-side signInWithPassword
      // window). If elevation triggers a full navigation the provider remounts and the
      // actor is rebuilt from hydratingGuest — in that case this transition is dead
      // code and should be dropped. The plan must pick one; see Task 2 Step 3.
      on: { MFA_ELEVATED: "checkingAal" },
    },

    syncing: {
      invoke: {
        src: "claimAndSync",
        input: ({ context }) => ({
          userId: context.userId!,
          event: context.pendingEvent!,
          generation: context.generation,
        }),
        onDone: "ready",
        onError: { target: "error", actions: assign({ error: ({ event }) => event.error as Error }) },
      },
    },

    ready: {},

    // Deliberately NOT `type: "final"` — the actor must stay alive so a later
    // AUTH_EVENT (e.g. a retry, or a sign-out) can still be processed.
    error: {},
  },
})
