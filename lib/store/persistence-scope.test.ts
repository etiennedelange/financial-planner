import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useCalculatorStore } from "./calculator-store"
import { useExpensesStore } from "./expenses-store"
import { setScope, type PersistenceScope } from "./persistence-scope"
import { migrateLegacyKeys } from "./legacy-scope-migration"

// Scoped storage policy tests: guest/user keys, switching users, and the
// scope-switch gate — the highest-risk interaction in the plan (a write in the
// window between setScope(user) and the user-scoped rehydrate settling would
// persist guest-shaped state into the user's key).

function storedCalculator(scopedKey: string): unknown {
  const raw = localStorage.getItem(scopedKey)
  return raw ? JSON.parse(raw) : null
}

describe("persistence scopes", () => {
  beforeEach(() => {
    localStorage.clear()
    setScope({ kind: "guest" })
    // Fresh stores each test: the persist middleware re-uses module state, so
    // reset the in-memory state explicitly.
    useCalculatorStore.setState({
      accounts: [],
      activeScenarioId: null,
      scenarioList: [],
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("writes guest state to the guest key", async () => {
    setScope({ kind: "guest" })
    await useCalculatorStore.persist.rehydrate() // releases the gate

    useCalculatorStore.getState().setDisplayMode("nominal")

    expect(localStorage.getItem("financial-planner-storage:guest")).not.toBeNull()
    expect(localStorage.getItem("financial-planner-storage:user:user-a")).toBeNull()
  })

  it("writes user state to the user-scoped key", async () => {
    setScope({ kind: "user", userId: "user-a" })
    await useCalculatorStore.persist.rehydrate()

    useCalculatorStore.getState().setDisplayMode("real")

    expect(localStorage.getItem("financial-planner-storage:user:user-a")).not.toBeNull()
    expect(localStorage.getItem("financial-planner-storage:guest")).toBeNull()
  })

  it("keeps user A's key distinct from user B's key", async () => {
    setScope({ kind: "user", userId: "user-a" })
    await useCalculatorStore.persist.rehydrate()
    useCalculatorStore.getState().setDisplayMode("real")

    setScope({ kind: "user", userId: "user-b" })
    await useCalculatorStore.persist.rehydrate()
    useCalculatorStore.getState().setDisplayMode("nominal")

    const a = storedCalculator("financial-planner-storage:user:user-a") as {
      state: { displayMode?: string }
    }
    const b = storedCalculator("financial-planner-storage:user:user-b") as {
      state: { displayMode?: string }
    }
    expect(a.state.displayMode).toBe("real")
    expect(b.state.displayMode).toBe("nominal")
  })

  it("re-closes the write gate on scope switch so guest state cannot leak into the user key", async () => {
    setScope({ kind: "guest" })
    await useCalculatorStore.persist.rehydrate() // releases the gate

    setScope({ kind: "user", userId: "user-a" }) // gate must re-close HERE
    // A write in the window before the user-scoped rehydrate settles:
    useCalculatorStore.getState().setDisplayMode("real")

    expect(localStorage.getItem("financial-planner-storage:user:user-a")).toBeNull()

    await useCalculatorStore.persist.rehydrate()
    // Only after the user scope has hydrated may writes land.
    useCalculatorStore.getState().setDisplayMode("nominal")
    expect(localStorage.getItem("financial-planner-storage:user:user-a")).not.toBeNull()
  })

  it("re-gates every registered store instance, not just the first", async () => {
    setScope({ kind: "guest" })
    await Promise.all([
      useCalculatorStore.persist.rehydrate(),
      useExpensesStore.persist.rehydrate(),
    ])

    setScope({ kind: "user", userId: "user-a" })
    useExpensesStore.getState().setMonthlyIncome(50_000)

    expect(localStorage.getItem("expenses-store-v2:user:user-a")).toBeNull()
  })

  describe("legacy un-scoped key migration", () => {
    it("moves a legacy payload with a sessionId into that user's scoped key", () => {
      localStorage.setItem(
        "financial-planner-storage",
        JSON.stringify({ state: { sessionId: "user-legacy", accounts: [] }, version: 2 })
      )
      localStorage.setItem(
        "expenses-store-v2",
        JSON.stringify({ state: { sessionId: "user-legacy" }, version: 2 })
      )

      const ambiguous = migrateLegacyKeys()

      expect(localStorage.getItem("financial-planner-storage")).toBeNull()
      expect(localStorage.getItem("expenses-store-v2")).toBeNull()
      expect(localStorage.getItem("financial-planner-storage:user:user-legacy")).not.toBeNull()
      expect(localStorage.getItem("expenses-store-v2:user:user-legacy")).not.toBeNull()
      expect(ambiguous).toEqual([])
    })

    it("routes a sessionId:null legacy payload to the ambiguous holding area, never auto-claimed", () => {
      localStorage.setItem(
        "financial-planner-storage",
        JSON.stringify({ state: { sessionId: null, accounts: [] }, version: 2 })
      )
      localStorage.setItem(
        "expenses-store-v2",
        JSON.stringify({ state: { sessionId: null }, version: 2 })
      )

      const ambiguous = migrateLegacyKeys()

      // Moved out of the un-scoped keys, but not claimed by any account.
      expect(localStorage.getItem("financial-planner-storage")).toBeNull()
      expect(localStorage.getItem("financial-planner-storage:user:user-a")).toBeNull()
      expect(ambiguous).toHaveLength(2)
      expect(ambiguous[0].scope).toEqual({ kind: "guest" })
      expect(ambiguous[0].payload).toEqual(
        expect.objectContaining({ state: expect.objectContaining({ sessionId: null }) })
      )
    })

    it("leaves the legacy key intact for retry when a copy fails", () => {
      localStorage.setItem(
        "financial-planner-storage",
        JSON.stringify({ state: { sessionId: "user-a", accounts: [] }, version: 2 })
      )
      // Make the scoped-key write throw by freezing storage mid-migration — the
      // delete must happen only after a successful copy.
      const originalSetItem = window.localStorage.setItem
      let failWrites = true
      const spy = vi.spyOn(window.localStorage, "setItem").mockImplementation(function (
        key: string,
        value: string
      ) {
        if (failWrites) throw new Error("quota exceeded")
        return originalSetItem.call(window.localStorage, key, value)
      })

      let threw = false
      try {
        migrateLegacyKeys()
      } catch {
        threw = true
      } finally {
        failWrites = false
        spy.mockRestore()
      }

      expect(threw).toBe(true)
      // Legacy key survives a failed migration for retry.
      expect(localStorage.getItem("financial-planner-storage")).not.toBeNull()
    })

    it("is a no-op when no legacy keys exist", () => {
      expect(migrateLegacyKeys()).toEqual([])
    })

    it("still clamps a v1 payload's out-of-range monetary fields after migration", async () => {
      // The version decision (plan Task 3 Step 3): do NOT bump the store
      // version — the copy preserves the payload's own version, so a v1
      // payload still runs the load-bearing monetary clamp migrate on
      // rehydrate. Without the clamp, pre-cap absurd values resurface.
      localStorage.setItem(
        "financial-planner-storage",
        JSON.stringify({
          state: { sessionId: "user-a", personalInfo: { annualIncome: 1e15 } },
          version: 1,
        })
      )

      migrateLegacyKeys()
      setScope({ kind: "user", userId: "user-a" })
      await useCalculatorStore.persist.rehydrate()

      expect(useCalculatorStore.getState().personalInfo.annualIncome).toBeLessThanOrEqual(
        Number.MAX_SAFE_INTEGER
      )
    })
  })
})

// Keep TS happy about the unused import above for the scope type alias.
void (null as unknown as PersistenceScope)
