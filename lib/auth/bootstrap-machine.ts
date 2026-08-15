import { setup, assign, fromPromise } from "xstate"
import type { User } from "@supabase/supabase-js"

export type AuthEventType =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"

export interface AuthEvent {
  type: AuthEventType
  userId: string | null
  hasSession: boolean
}

// The coordinator dependency contract. SupabaseProvider and the test fixture
// implement these the same way; the machine never references Supabase directly.
export interface BootstrapDependencies {
  // One per scope, not one total: the guest scope is hydrated before identity is
  // known; the user scope is re-hydrated after getUser() resolves.
  hydrateGuestScope: () => Promise<void> // legacy-key migration + setScope(guest) + hydrate both stores
  hydrateUserScope: (userId: string) => Promise<void> // setScope(user) + rehydrate both stores
  getUser: () => Promise<User | null>
  // MUST be token-aware: getAuthenticatorAssuranceLevel(access_token), not the
  // argument-less cookie-cached form (which can report a removed factor as still
  // making aal2 reachable). See lib/supabase/proxy.ts.
  currentAal: () => Promise<{ current: string | null; next: string | null }>
  // Must be a no-op for INITIAL_SESSION with a null user (signed-out reload).
  applyAuthTransition: (event: AuthEvent, generation: number) => Promise<void>
  claimLocalData: (userId: string, source: "guest" | "user" | "legacy-unknown") => Promise<void>
  syncFromDb: (userId: string, generation: number) => Promise<void>
  syncExpensesFromDb: (userId: string, generation: number) => Promise<void>
}

export type BootstrapPhase =
  | "idle"
  | "hydrating"
  | "authenticating"
  | "mfa-required"
  | "syncing"
  | "ready"
  | "error"

export interface BootstrapState {
  phase: BootstrapPhase
  userId: string | null
  error: Error | null
}

export interface BootstrapCoordinator {
  getState: () => BootstrapState
  start: () => Promise<void>
  enqueueAuthEvent: (event: AuthEvent) => void
  flush: () => Promise<void>
  // Subscribe to phase/userId/error changes — SupabaseProvider maps this onto
  // AuthContext so consumers re-render as the bootstrap advances.
  subscribe: (listener: (state: BootstrapState) => void) => () => void
}

// TOKEN_REFRESHED / USER_UPDATED / PASSWORD_RECOVERY must never claim or sync.
// Expressed as a guard on the transition INTO syncing so the skip stays visible
// in the chart rather than buried inside the claimAndSync actor.
const CLAIM_EVENT_TYPES = new Set<AuthEventType>(["SIGNED_IN", "INITIAL_SESSION"])

interface Context {
  userId: string | null
  // Set on hydratingUser entry. Lets authenticating tell "scope already hydrated
  // for this user" from "needs hydration" when a captured event re-resolves
  // identity — without it, a superseding event would re-enter hydratingUser forever.
  hydratedUserId: string | null
  error: Error | null
  // AUTH_EVENTs arriving while a hydration state is in flight are captured here
  // (target-less handlers) and applied after the hydration settles — never used
  // to cancel the in-flight hydration or the one-time legacy migration.
  pendingEvent: AuthEvent | null
  // XState's invoke cancellation stops the *actor*, but it cannot cancel a
  // fetchScenario promise already in flight inside a store. generation is
  // incremented on every identity transition and passed into
  // syncFromDb/syncExpensesFromDb so a late response can be dropped.
  generation: number
  // The userId before the current event was applied. The claim/sync guard
  // requires the event to name a DIFFERENT user than prevUserId, so a SIGNED_IN
  // for the already-active user (e.g. a re-auth during the same session) is a
  // no-op rather than a re-claim + re-sync.
  prevUserId: string | null
}

type C = { context: Context }
type CE = { context: Context; event: { output?: User | null } }
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
    mayClaimAndSync: ({ context }: C) =>
      context.pendingEvent != null &&
      context.userId != null &&
      CLAIM_EVENT_TYPES.has(context.pendingEvent.type) &&
      context.pendingEvent.userId !== context.prevUserId,
    mfaRequired: ({ event }: E) =>
      event.output?.current === "aal1" && event.output?.next === "aal2",
    // True when nothing was captured during the hydration, or the captured event
    // names the user whose scope was just hydrated — only then is applying safe.
    scopeStillCurrent: ({ context }: C) =>
      context.pendingEvent == null || context.pendingEvent.userId === context.userId,
    // A verified user whose scope is already hydrated goes straight to applying.
    scopeAlreadyHydrated: ({ context, event }: CE) =>
      event.output != null && context.hydratedUserId === event.output.id,
    hasVerifiedUser: ({ event }: E) => event.output != null,
    holdsPendingEvent: ({ context }: C) => context.pendingEvent != null,
  },
  actors: {
    // The real implementations are wired in by createBootstrapCoordinator via
    // .provide() — these stubs only exist so the machine type-checks standalone.
    // Their input/output types declare the contract .provide() must satisfy.
    hydrateGuestScope: fromPromise<void, void>(async () => {
      throw new Error("hydrateGuestScope not provided")
    }),
    resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(async () => {
      throw new Error("resolveIdentity not provided")
    }),
    hydrateUserScope: fromPromise<void, { userId: string }>(async () => {
      throw new Error("hydrateUserScope not provided")
    }),
    applyTransition: fromPromise<void, { event: AuthEvent; generation: number }>(async () => {
      throw new Error("applyTransition not provided")
    }),
    checkAal: fromPromise<{ current: string | null; next: string | null }, { userId: string }>(
      async () => {
        throw new Error("checkAal not provided")
      }
    ),
    claimAndSync: fromPromise<void, { userId: string; event: AuthEvent; generation: number }>(
      async () => {
        throw new Error("claimAndSync not provided")
      }
    ),
  },
}).createMachine({
  id: "bootstrap",
  initial: "hydratingGuest",
  context: {
    userId: null,
    hydratedUserId: null,
    error: null,
    pendingEvent: null,
    generation: 0,
    prevUserId: null,
  },

  // A late AUTH_EVENT from any state except the two hydration states re-targets
  // `authenticating` with the new event in context and a bumped generation.
  // Leaving whichever state we were in stops its invoked actor, so a superseded
  // transition can never commit. This single handler is the whole anti-clobber
  // guarantee. NOTE: this must remain reachable from `error` — hence `error` is
  // not final. NOTE: hydratingGuest/hydratingUser override this with target-less
  // CAPTURE handlers: a re-target from there would cancel the in-flight hydration
  // and abort the one-time legacy migration.
  on: {
    AUTH_EVENT: {
      target: ".authenticating",
      actions: assign({
        pendingEvent: ({ event }: E) => event.event,
        generation: ({ context }: C) => context.generation + 1,
        prevUserId: ({ context }: C) => context.userId,
      }),
    },
  },

  states: {
    hydratingGuest: {
      // Capture, do not re-target: the listener registers before start(), so
      // supabase-js's INITIAL_SESSION typically arrives while this is still
      // running. A re-target here would cancel the hydration and strand the
      // legacy keys unmigrated.
      on: {
        AUTH_EVENT: {
          actions: assign({
            pendingEvent: ({ event }: E) => event.event,
            generation: ({ context }: C) => context.generation + 1,
            prevUserId: ({ context }: C) => context.userId,
          }),
        },
      },
      invoke: {
        src: "hydrateGuestScope",
        onDone: "authenticating",
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
      },
    },

    authenticating: {
      invoke: {
        src: "resolveIdentity",
        input: ({ context }: C) => ({ pendingEvent: context.pendingEvent }),
        onDone: [
          { guard: "scopeAlreadyHydrated", target: "applyingTransition" },
          {
            guard: "hasVerifiedUser",
            target: "hydratingUser",
            actions: assign({ userId: ({ event }: E) => (event.output as User).id }),
          },
          {
            // A captured event (e.g. SIGNED_OUT during hydration) must still be
            // applied even when no session remains — the null-user shortcut to
            // ready is startup-only, so it is guarded on no event being held.
            guard: "holdsPendingEvent",
            target: "applyingTransition",
            actions: assign({ userId: null }),
          },
          { target: "ready", actions: assign({ userId: null }) },
        ],
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
      },
    },

    hydratingUser: {
      // Capture, do not re-target (same reason as hydratingGuest).
      on: {
        AUTH_EVENT: {
          actions: assign({
            pendingEvent: ({ event }: E) => event.event,
            generation: ({ context }: C) => context.generation + 1,
            prevUserId: ({ context }: C) => context.userId,
          }),
        },
      },
      entry: assign({ hydratedUserId: ({ context }: C) => context.userId }),
      invoke: {
        src: "hydrateUserScope",
        input: ({ context }: C) => ({ userId: context.userId! }),
        // If the captured event names the hydrated user (or nothing was
        // captured), applying is safe immediately. A different user — or a
        // null-user event like SIGNED_OUT — re-resolves identity first, so a
        // superseding user's scope is hydrated before anything is applied, and
        // sign-out cleanup is not skipped.
        onDone: [
          { guard: "scopeStillCurrent", target: "applyingTransition" },
          { target: "authenticating" },
        ],
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
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
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
      },
    },

    checkingAal: {
      invoke: {
        src: "checkAal",
        input: ({ context }: C) => ({ userId: context.userId! }),
        onDone: [
          { guard: "mfaRequired", target: "mfaRequired" },
          { guard: "mayClaimAndSync", target: "syncing" },
          // Token refresh / user update / same-identity event / sign-out: no
          // claim, no sync.
          { target: "ready" },
        ],
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
      },
    },

    mfaRequired: {
      // Terminal resting state for this actor: MFA elevation triggers a full
      // navigation, the provider remounts, and the actor is rebuilt from
      // hydratingGuest. There is deliberately NO `MFA_ELEVATED` event — if
      // in-place elevation is ever introduced, the event is added then, with a
      // test that actually sends it.
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
        onError: {
          target: "error",
          actions: assign({ error: ({ event }: E) => event.error as Error }),
        },
      },
    },

    ready: {},

    // Deliberately NOT `type: "final"` — the actor must stay alive so a later
    // AUTH_EVENT (e.g. a retry, or a sign-out) can still be processed.
    error: {},
  },
})
