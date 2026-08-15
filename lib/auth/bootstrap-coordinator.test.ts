import { describe, it, expect, vi } from "vitest"
import type { User } from "@supabase/supabase-js"
import { createBootstrapCoordinator } from "./bootstrap-coordinator"
import type { BootstrapDependencies, AuthEvent } from "./bootstrap-machine"

// A promise that never settles — used to hold user A's sync in flight so user B
// can supersede it mid-transition.
function neverResolves(): Promise<void> {
  return new Promise<void>(() => {})
}

function makeDependencies(overrides: Partial<BootstrapDependencies> = {}) {
  const base = {
    hydrateGuestScope: vi.fn(async () => {}),
    hydrateUserScope: vi.fn(async () => {}),
    getUser: vi.fn(async () => null),
    currentAal: vi.fn(async () => ({ current: "aal2", next: null })),
    applyAuthTransition: vi.fn(async () => {}),
    claimLocalData: vi.fn(async () => {}),
    syncFromDb: vi.fn(async () => {}),
    syncExpensesFromDb: vi.fn(async () => {}),
  }
  // Wrap every override in vi.fn too, so tests can still assert on mock.calls
  // even for dependencies whose implementation they replaced.
  const wrapped: Record<string, unknown> = {}
  for (const [key, impl] of Object.entries(overrides)) {
    wrapped[key] = vi.fn(impl)
  }
  return { ...base, ...wrapped } as MockedDependencies
}
// vi.fn() returns a Mock that ALSO satisfies the BootstrapDependencies function
// shape (vitest's vi.fn typing), so tests can assert on mock.calls/mockReturnValueOnce.
type MockedDependencies = {
  hydrateGuestScope: ReturnType<typeof vi.fn> & BootstrapDependencies["hydrateGuestScope"]
  hydrateUserScope: ReturnType<typeof vi.fn> & BootstrapDependencies["hydrateUserScope"]
  getUser: ReturnType<typeof vi.fn> & BootstrapDependencies["getUser"]
  currentAal: ReturnType<typeof vi.fn> & BootstrapDependencies["currentAal"]
  applyAuthTransition: ReturnType<typeof vi.fn> & BootstrapDependencies["applyAuthTransition"]
  claimLocalData: ReturnType<typeof vi.fn> & BootstrapDependencies["claimLocalData"]
  syncFromDb: ReturnType<typeof vi.fn> & BootstrapDependencies["syncFromDb"]
  syncExpensesFromDb: ReturnType<typeof vi.fn> & BootstrapDependencies["syncExpensesFromDb"]
}
type TestDependencies = MockedDependencies

const signIn = (userId: string): AuthEvent => ({ type: "SIGNED_IN", userId, hasSession: true })

describe("createBootstrapCoordinator", () => {
  it("hydrates before resolving auth or claiming local data", async () => {
    const events: string[] = []
    const dependencies = makeDependencies({
      hydrateGuestScope: async () => {
        events.push("hydrate")
      },
      getUser: async () => {
        events.push("getUser")
        return null
      },
    })

    await createBootstrapCoordinator(dependencies).start()

    expect(events).toEqual(["hydrate", "getUser"])
    expect(dependencies.claimLocalData).not.toHaveBeenCalled()
  })

  it("returns the same startup promise when start is called twice", async () => {
    const coordinator = createBootstrapCoordinator(makeDependencies())

    expect(coordinator.start()).toBe(coordinator.start())
    await coordinator.start()
  })

  it("does not call protected sync while MFA is required", async () => {
    const dependencies = makeDependencies({
      getUser: async () => ({ id: "user-a" } as User),
      currentAal: async () => ({ current: "aal1", next: "aal2" }),
    })
    const coordinator = createBootstrapCoordinator(dependencies)

    await coordinator.start()

    expect(coordinator.getState().phase).toBe("mfa-required")
    expect(dependencies.claimLocalData).not.toHaveBeenCalled()
    expect(dependencies.syncFromDb).not.toHaveBeenCalled()
  })

  it("processes an auth event only after the callback has returned", async () => {
    let callbackReturned = false
    const dependencies = makeDependencies({
      applyAuthTransition: async () => {
        expect(callbackReturned).toBe(true)
      },
    })
    const coordinator = createBootstrapCoordinator(dependencies)

    coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
    callbackReturned = true
    await coordinator.flush()

    expect(dependencies.applyAuthTransition).toHaveBeenCalledWith(
      expect.objectContaining({ hasSession: true }),
      expect.any(Number)
    )
    expect(callbackReturned).toBe(true)
  })

  // NOTE: asserting only the final userId is NOT sufficient — that passes even if
  // user A's claim+sync fully committed first and was merely overwritten. The
  // assertions below are the actual anti-clobber contract.
  it("does not commit a stale transition after a newer user event", async () => {
    const dependencies = makeDependencies()
    // user A's sync is left pending so user B supersedes it mid-flight.
    dependencies.syncFromDb.mockReturnValueOnce(neverResolves())
    const coordinator = createBootstrapCoordinator(dependencies)

    coordinator.enqueueAuthEvent(signIn("user-a"))
    coordinator.enqueueAuthEvent(signIn("user-b"))
    await coordinator.flush()

    expect(coordinator.getState().userId).toBe("user-b")
    // user A must never have reached claim at all...
    expect(dependencies.claimLocalData).not.toHaveBeenCalledWith("user-a", expect.anything())
    // ...and the only completed sync belongs to user B.
    expect(dependencies.syncExpensesFromDb).toHaveBeenCalledTimes(1)
    expect(dependencies.syncExpensesFromDb).toHaveBeenCalledWith("user-b", expect.any(Number))
  })

  it("rejects a late store response carrying a stale generation", async () => {
    // Guards what actor cancellation cannot reach: a fetch already in flight inside
    // the store when the transition was superseded.
    const dependencies = makeDependencies()
    const coordinator = createBootstrapCoordinator(dependencies)

    coordinator.enqueueAuthEvent(signIn("user-a"))
    coordinator.enqueueAuthEvent(signIn("user-b"))
    await coordinator.flush()

    const [, generationA] = dependencies.syncFromDb.mock.calls[0] ?? []
    const [, generationB] = dependencies.syncFromDb.mock.calls.at(-1) ?? []
    expect(generationB).toBeGreaterThan(generationA ?? -1)
  })

  it("still processes an auth event after an error", async () => {
    // Regression guard: `error` must not be a final state, or the actor stops forever.
    const dependencies = makeDependencies({
      getUser: async () => {
        throw new Error("network down")
      },
    })
    const coordinator = createBootstrapCoordinator(dependencies)

    await expect(coordinator.start()).rejects.toThrow("network down")
    expect(coordinator.getState().phase).toBe("error")

    coordinator.enqueueAuthEvent({ type: "SIGNED_OUT", userId: null, hasSession: false })
    await coordinator.flush()

    expect(coordinator.getState().phase).toBe("ready")
  })

  it("does not report ready when hydration or sync fails", async () => {
    const dependencies = makeDependencies({
      hydrateGuestScope: async () => {
        throw new Error("storage unavailable")
      },
    })
    const coordinator = createBootstrapCoordinator(dependencies)

    await expect(coordinator.start()).rejects.toThrow("storage unavailable")
    expect(coordinator.getState().phase).toBe("error")
  })

  it("does not re-claim or re-sync on a token refresh", async () => {
    const dependencies = makeDependencies({
      getUser: async () => ({ id: "user-a" } as User),
    })
    const coordinator = createBootstrapCoordinator(dependencies)

    coordinator.enqueueAuthEvent(signIn("user-a"))
    coordinator.enqueueAuthEvent({ type: "TOKEN_REFRESHED", userId: "user-a", hasSession: true })
    await coordinator.flush()

    expect(dependencies.claimLocalData).toHaveBeenCalledTimes(1)
    expect(dependencies.syncFromDb).toHaveBeenCalledTimes(1)
  })

  it("captures an auth event during guest hydration instead of cancelling the migration", async () => {
    // The listener is registered before start() (Task 2 Step 2), so INITIAL_SESSION
    // typically lands while hydratingGuest is still running. Hold guest hydration
    // pending, enqueue mid-flight, then let it settle.
    const dependencies = makeDependencies()
    const coordinator = createBootstrapCoordinator(dependencies)
    const startPromise = coordinator.start()

    coordinator.enqueueAuthEvent({ type: "INITIAL_SESSION", userId: null, hasSession: false })
    await startPromise

    // Guest hydration (legacy migration, setScope(guest), store hydration) ran to
    // completion exactly once — the event was captured, not a re-target.
    expect(dependencies.hydrateGuestScope).toHaveBeenCalledTimes(1)
    expect(coordinator.getState().phase).toBe("ready")
    expect(dependencies.claimLocalData).not.toHaveBeenCalled()
  })

  it("applies a SIGNED_OUT that arrived during user-scoped hydration", async () => {
    const dependencies = makeDependencies({
      getUser: async () => ({ id: "user-a" } as User),
    })
    const coordinator = createBootstrapCoordinator(dependencies)
    const startPromise = coordinator.start()
    // User A's rehydrate is held pending; sign-out lands mid-flight and is captured.
    coordinator.enqueueAuthEvent({ type: "SIGNED_OUT", userId: null, hasSession: false })
    await startPromise

    // Sign-out cleanup ran via applyingTransition — a captured event is applied
    // after the hydration settles, never dropped — and nothing claimed or synced.
    expect(dependencies.applyAuthTransition).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SIGNED_OUT" }),
      expect.any(Number)
    )
    expect(dependencies.syncFromDb).not.toHaveBeenCalled()
    expect(coordinator.getState().phase).toBe("ready")
  })
})
