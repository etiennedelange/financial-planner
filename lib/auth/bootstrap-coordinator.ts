import { createActor, fromPromise } from "xstate"
import type { User } from "@supabase/supabase-js"
import {
  bootstrapMachine,
  type AuthEvent,
  type BootstrapCoordinator,
  type BootstrapDependencies,
  type BootstrapPhase,
  type BootstrapState,
} from "./bootstrap-machine"

// Thin wrapper adapting the machine actor to the BootstrapCoordinator surface
// (getState, start, enqueueAuthEvent, flush). SupabaseProvider and the tests
// never need to know XState is involved.

type BootstrapSnapshot = ReturnType<ReturnType<typeof createActor<typeof bootstrapMachine>>["getSnapshot"]>

const PHASE_OF_VALUE: Record<string, BootstrapPhase> = {
  hydratingGuest: "hydrating",
  hydratingUser: "hydrating",
  authenticating: "authenticating",
  applyingTransition: "authenticating",
  checkingAal: "authenticating",
  mfaRequired: "mfa-required",
  syncing: "syncing",
  ready: "ready",
  error: "error",
}

// Phases where an auth event has been fully processed — past the transient
// authenticating chain, committed to its outcome (or resting, or failed).
const COMMITTED_PHASES = new Set<BootstrapPhase>(["syncing", "ready", "mfa-required", "error"])
// Resting phases: the actor stays here until a new AUTH_EVENT arrives.
const RESTING_PHASES = new Set<BootstrapPhase>(["ready", "mfa-required"])

export function createBootstrapCoordinator(dependencies: BootstrapDependencies): BootstrapCoordinator {
  const machine = bootstrapMachine.provide({
    actors: {
      hydrateGuestScope: fromPromise<void, void>(() => dependencies.hydrateGuestScope()),
      // Identity comes from the captured/queued event when one is held — the event
      // already carries a verified userId from the auth listener. getUser() is only
      // consulted on the startup path (no pendingEvent yet); a captured null-user
      // event (SIGNED_OUT mid-hydration) must NOT re-enter getUser, or an erroring
      // auth server would trap the actor in `error` forever.
      resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(
        async ({ input }) => {
          if (input.pendingEvent != null) {
            return input.pendingEvent.userId != null
              ? ({ id: input.pendingEvent.userId } as User)
              : null
          }
          return dependencies.getUser()
        }
      ),
      hydrateUserScope: fromPromise<void, { userId: string }>(({ input }) =>
        dependencies.hydrateUserScope(input.userId)
      ),
      applyTransition: fromPromise<void, { event: AuthEvent; generation: number }>(
        ({ input }) => dependencies.applyAuthTransition(input.event, input.generation)
      ),
      checkAal: fromPromise<{ current: string | null; next: string | null }, { userId: string }>(
        async () => dependencies.currentAal()
      ),
      claimAndSync: fromPromise<void, { userId: string; event: AuthEvent; generation: number }>(
        async ({ input }) => {
          // Claiming runs only on the startup path (the synthetic INITIAL_SESSION):
          // that is the only moment guest-owned data exists. A live SIGNED_IN event
          // is a re-auth of an already-active session and must not claim — the
          // claim/sync guard additionally requires a userId change for that path.
          // The source is the caller's ownership claim: the startup snapshot is
          // guest-owned by construction, so every claim here is "guest". The
          // claimLocalData dependency passes it to lib/supabase/claim.ts which
          // rejects any non-guest source outright.
          if (input.event.type === "INITIAL_SESSION") {
            await dependencies.claimLocalData(input.userId, "guest")
          }
          await dependencies.syncFromDb(input.userId, input.generation)
          await dependencies.syncExpensesFromDb(input.userId, input.generation)
        }
      ),
    },
  })

  let actor: ReturnType<typeof createActor<typeof machine>> | null = null
  let startPromise: Promise<void> | null = null
  let started = false
  const pendingEvents: AuthEvent[] = []

  function getActor() {
    if (!actor) actor = createActor(machine)
    return actor
  }

  function phaseOf(snapshot: BootstrapSnapshot): BootstrapPhase {
    return PHASE_OF_VALUE[String(snapshot.value)] ?? "idle"
  }

  // Waits until the actor snapshot satisfies `predicate`, checking the current
  // snapshot first (actor.subscribe does not emit the snapshot at subscribe time).
  function waitForPhase(predicate: (phase: BootstrapPhase) => boolean): Promise<BootstrapPhase> {
    return new Promise((resolve) => {
      const a = getActor()
      const check = () => {
        const phase = phaseOf(a.getSnapshot())
        if (predicate(phase)) resolve(phase)
      }
      check()
      const sub = a.subscribe(() => check())
      // resolve() may already have fired synchronously; the subscription leaks
      // only in that case, which is fine for a per-bootstrap coordinator.
      void sub
    })
  }

  async function flush(): Promise<void> {
    // Startup may have failed (start() rejected); a later auth event must still
    // be able to recover the actor, so swallow the startup rejection here.
    await start().catch(() => {})

    // Deliver queued events one at a time, waiting for each to commit before the
    // next — a back-to-back delivery would let event B cancel event A's still-
    // resolving identity chain, and A would never reach its own sync.
    while (pendingEvents.length > 0) {
      const event = pendingEvents.shift()!
      getActor().send({ type: "AUTH_EVENT", event })
      await waitForPhase((phase) => COMMITTED_PHASES.has(phase))
    }

    await waitForPhase((phase) => RESTING_PHASES.has(phase) || phase === "error")
  }

  // Caches one promise: two calls (React StrictMode double effect) share the
  // same startup and never restart the actor.
  function start(): Promise<void> {
    if (!startPromise) {
      started = true
      getActor().start()
      startPromise = waitForPhase((phase) => RESTING_PHASES.has(phase) || phase === "error").then(
        (phase) => {
          if (phase === "error") {
            const error = getActor().getSnapshot().context.error ?? new Error("bootstrap failed")
            throw error
          }
        }
      )
    }
    return startPromise
  }

  const stateListeners = new Set<(state: BootstrapState) => void>()
  let lastState: BootstrapState = { phase: "idle", userId: null, error: null }

  function emitState() {
    lastState = {
      phase: started ? phaseOf(getActor().getSnapshot()) : "idle",
      userId: started ? (getActor().getSnapshot().context.userId ?? null) : null,
      error: started ? (getActor().getSnapshot().context.error ?? null) : null,
    }
    for (const listener of stateListeners) listener(lastState)
  }

  if (!actor) actor = createActor(machine)
  const emitter = actor.subscribe(() => emitState())

  return {
    getState: () => lastState,

    start,

    enqueueAuthEvent: (event: AuthEvent) => {
      if (!started) {
        pendingEvents.push(event)
        return
      }
      getActor().send({ type: "AUTH_EVENT", event })
    },

    flush,

    subscribe: (listener: (state: BootstrapState) => void) => {
      stateListeners.add(listener)
      listener(lastState)
      return () => stateListeners.delete(listener)
    },
  }
}
