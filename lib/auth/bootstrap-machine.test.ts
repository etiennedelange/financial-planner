import { describe, it, expect, vi } from "vitest"
import { createActor, fromPromise, waitFor } from "xstate"
import type { User } from "@supabase/supabase-js"
import { bootstrapMachine, type AuthEvent } from "./bootstrap-machine"

// State-chart-level tests: reachable states, guard behaviour, hydration-state
// event capture, and invoke cancellation — verified directly against the machine
// rather than re-derived by hand through the coordinator wrapper.

function makeDeferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

const stubActors = {
  hydrateGuestScope: fromPromise<void, void>(async () => {}),
  resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(async ({ input }) => {
    return input.pendingEvent?.userId != null ? ({ id: input.pendingEvent.userId } as User) : null
  }),
  hydrateUserScope: fromPromise<void, { userId: string }>(async ({ input }) => {
    void input.userId
  }),
  applyTransition: fromPromise<void, { event: AuthEvent; generation: number }>(
    async ({ input }) => {
      void input.event
      void input.generation
    }
  ),
  checkAal: fromPromise<{ current: string | null; next: string | null }, { userId: string }>(
    async () => ({ current: "aal2", next: null })
  ),
  claimAndSync: fromPromise<void, { userId: string; event: AuthEvent; generation: number }>(
    async ({ input }) => {
      void input
    }
  ),
}

function makeMachine(overrides: Partial<typeof stubActors> = {}) {
  return bootstrapMachine.provide({ actors: { ...stubActors, ...overrides } })
}

function startWith(...events: AuthEvent[]) {
  const actor = createActor(makeMachine())
  actor.start()
  return actor
}

describe("bootstrapMachine", () => {
  it("starts in hydratingGuest and reaches ready for a signed-out startup", async () => {
    const actor = startWith()

    await waitFor(actor, (s) => s.matches("ready"))

    expect(actor.getSnapshot().context.userId).toBeNull()
  })

  it("captures an AUTH_EVENT during guest hydration without cancelling the migration", async () => {
    const deferred = makeDeferred()
    let hydrateCalls = 0
    const actor = createActor(
      makeMachine({
        hydrateGuestScope: fromPromise(async () => {
          hydrateCalls += 1
          await deferred.promise
        }),
      })
    )
    actor.start()

    // The listener is registered before start(), so INITIAL_SESSION lands while
    // hydratingGuest is still running. It must be captured, not re-targeted —
    // a re-target would exit hydratingGuest and cancel the in-flight migration.
    actor.send({ type: "AUTH_EVENT", event: { type: "INITIAL_SESSION", userId: null, hasSession: false } })

    expect(actor.getSnapshot().matches("hydratingGuest")).toBe(true)
    expect(actor.getSnapshot().context.pendingEvent).toEqual({
      type: "INITIAL_SESSION",
      userId: null,
      hasSession: false,
    })
    expect(actor.getSnapshot().context.generation).toBe(1)

    deferred.resolve()
    await waitFor(actor, (s) => s.matches("ready"))
    expect(hydrateCalls).toBe(1)
  })

  it("captures a SIGNED_OUT during user-scoped hydration and applies it after settling", async () => {
    const deferred = makeDeferred()
    const applied: AuthEvent[] = []
    const actor = createActor(
      makeMachine({
        resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(
          async () => ({ id: "user-a" } as User)
        ),
        hydrateUserScope: fromPromise(async () => {
          await deferred.promise
        }),
        applyTransition: fromPromise(
          async ({ input }: { input: { event: AuthEvent; generation: number } }) => {
            applied.push(input.event)
          }
        ),
      })
    )
    actor.start()

    await waitFor(actor, (s) => s.matches("hydratingUser"))

    actor.send({ type: "AUTH_EVENT", event: { type: "SIGNED_OUT", userId: null, hasSession: false } })
    expect(actor.getSnapshot().matches("hydratingUser")).toBe(true)

    deferred.resolve()
    await waitFor(actor, (s) => s.matches("ready"))

    // The captured sign-out was applied via applyingTransition — never dropped.
    expect(applied).toHaveLength(1)
    expect(applied[0].type).toBe("SIGNED_OUT")
  })

  it("re-targets authenticating from ready when a new event arrives", async () => {
    const actor = startWith()
    await waitFor(actor, (s) => s.matches("ready"))

    actor.send({ type: "AUTH_EVENT", event: { type: "SIGNED_IN", userId: "user-a", hasSession: true } })

    await waitFor(actor, (s) => s.matches("ready"))
    expect(actor.getSnapshot().context.userId).toBe("user-a")
    expect(actor.getSnapshot().context.generation).toBe(1)
  })

  it("cancels the in-flight claim+sync actor when a newer event supersedes it", async () => {
    // A's sync never resolves; B arriving mid-flight must cancel A's invoked
    // claimAndSync actor — this is the state-chart equivalent of the generation
    // re-check that guarded every commit() call in the plain version.
    const started: string[] = []
    const completed: string[] = []
    const neverResolves = () => new Promise<void>(() => {})
    const actor = createActor(
      makeMachine({
        claimAndSync: fromPromise(
          async ({ input }: { input: { userId: string; event: AuthEvent; generation: number } }) => {
            started.push(input.userId)
            if (input.userId === "user-a") {
              await neverResolves()
            }
            completed.push(input.userId)
          }
        ),
      })
    )
    actor.start()

    await waitFor(actor, (s) => s.matches("ready"))
    actor.send({ type: "AUTH_EVENT", event: { type: "SIGNED_IN", userId: "user-a", hasSession: true } })
    await waitFor(actor, (s) => s.matches("syncing"))
    actor.send({ type: "AUTH_EVENT", event: { type: "SIGNED_IN", userId: "user-b", hasSession: true } })

    await waitFor(actor, (s) => s.matches("ready"))
    expect(started).toEqual(["user-a", "user-b"])
    // User A's actor was cancelled mid-sync — it never completed.
    expect(completed).toEqual(["user-b"])
  })

  it("guards claim+sync on event type: TOKEN_REFRESHED never claims or syncs", async () => {
    const syncCalls: string[] = []
    const actor = createActor(
      makeMachine({
        claimAndSync: fromPromise<void, { userId: string; event: AuthEvent; generation: number }>(
          async ({ input }) => {
            syncCalls.push(`${input.event.type}:${input.userId}`)
          }
        ),
      })
    )
    actor.start()

    await waitFor(actor, (s) => s.matches("ready"))
    actor.send({ type: "AUTH_EVENT", event: { type: "TOKEN_REFRESHED", userId: "user-a", hasSession: true } })

    await waitFor(actor, (s) => s.matches("ready"))
    expect(syncCalls).toEqual([])
  })

  it("enters mfaRequired when currentAal is aal1 with next aal2", async () => {
    const actor = createActor(
      makeMachine({
        resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(
          async () => ({ id: "user-a" } as User)
        ),
        checkAal: fromPromise<{ current: string | null; next: string | null }, { userId: string }>(
          async () => ({ current: "aal1", next: "aal2" })
        ),
      })
    )
    actor.start()

    await waitFor(actor, (s) => s.matches("mfaRequired"))
    expect(actor.getSnapshot().context.userId).toBe("user-a")
  })

  it("keeps error non-final so a later AUTH_EVENT still processes", async () => {
    const actor = createActor(
      makeMachine({
        // Mirrors the coordinator's resolveIdentity: identity comes from the held
        // event when one exists; getUser() (which throws here) is startup-only.
        resolveIdentity: fromPromise<User | null, { pendingEvent: AuthEvent | null }>(
          async ({ input }) => {
            if (input.pendingEvent != null) {
              return input.pendingEvent.userId != null
                ? ({ id: input.pendingEvent.userId } as User)
                : null
            }
            throw new Error("network down")
          }
        ),
      })
    )
    actor.start()

    await waitFor(actor, (s) => s.matches("error"))

    actor.send({ type: "AUTH_EVENT", event: { type: "SIGNED_OUT", userId: null, hasSession: false } })
    await waitFor(actor, (s) => s.matches("ready"))
  })
})
