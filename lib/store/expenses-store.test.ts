import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { useExpensesStore } from "./expenses-store"
import * as expensesApi from "@/lib/supabase/expenses"

vi.mock("@/lib/supabase/expenses")

const mockGroup = {
  id: "group-1",
  name: "Housing",
  color: "#818cf8",
  sortOrder: 0,
}

const mockExpense = {
  id: "expense-1",
  groupId: "group-1",
  name: "Rent",
  amount: 15000,
  inRetirement: true,
  sortOrder: 0,
}

const mockExpense2 = {
  id: "expense-2",
  groupId: "group-1",
  name: "Utilities",
  amount: 2000,
  inRetirement: true,
  sortOrder: 1,
}

describe("useExpensesStore", () => {
  beforeEach(() => {
    useExpensesStore.setState({
      identity: { kind: "guest" },
      groups: [],
      expenses: [],
      monthlyIncome: 56500,
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("Initialization", () => {
    it("should initialize with default values", () => {
      const state = useExpensesStore.getState()
      expect(state.identity).toEqual({ kind: "guest" })
      expect(state.groups).toEqual([])
      expect(state.expenses).toEqual([])
      expect(state.monthlyIncome).toBe(56500)
    })
  })

  describe("Session management", () => {
    it("should set session ID", () => {
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-123" })
      expect(useExpensesStore.getState().identity).toEqual({ kind: "user", userId: "session-123" })
    })
  })

  describe("Group operations", () => {
    it("should add new group", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })

      useExpensesStore.getState().addGroup("Housing", "#818cf8")

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(1)
      expect(state.groups[0].name).toBe("Housing")
      expect(state.groups[0].color).toBe("#818cf8")
      expect(state.groups[0].id).toBeDefined()
    })

    it("should not sync group to DB if no session", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)

      useExpensesStore.getState().addGroup("Housing", "#818cf8")

      expect(expensesApi.upsertGroup).not.toHaveBeenCalled()
    })

    it("should update group name and color", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      useExpensesStore.setState({ groups: [mockGroup], identity: { kind: "user", userId: "session-1" } })

      useExpensesStore.getState().updateGroup("group-1", { name: "Accommodation", color: "#60a5fa" })

      const state = useExpensesStore.getState()
      expect(state.groups[0].name).toBe("Accommodation")
      expect(state.groups[0].color).toBe("#60a5fa")
    })

    it("should remove group and its expenses", () => {
      vi.spyOn(expensesApi, "deleteGroup").mockResolvedValue(undefined)
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useExpensesStore.setState({
        groups: [mockGroup],
        expenses: [mockExpense, mockExpense2],
      })

      useExpensesStore.getState().removeGroup("group-1")

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(0)
      expect(state.expenses).toHaveLength(0)
      expect(expensesApi.deleteGroup).toHaveBeenCalledWith("group-1")
    })

    it("should preserve expenses from other groups when removing", () => {
      vi.spyOn(expensesApi, "deleteGroup").mockResolvedValue(undefined)
      const group2 = { id: "group-2", name: "Utilities", color: "#4ade80", sortOrder: 1 }
      const expense3 = { ...mockExpense2, groupId: "group-2", id: "expense-3" }

      useExpensesStore.setState({
        groups: [mockGroup, group2],
        expenses: [mockExpense, expense3],
      })

      useExpensesStore.getState().removeGroup("group-1")

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(1)
      expect(state.expenses).toHaveLength(1)
      expect(state.expenses[0].id).toBe("expense-3")
    })
  })

  describe("Expense operations", () => {
    beforeEach(() => {
      useExpensesStore.setState({ groups: [mockGroup] })
    })

    it("should add new expense to group", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })

      useExpensesStore.getState().addExpense("group-1", "Rent", 15000)

      const state = useExpensesStore.getState()
      expect(state.expenses).toHaveLength(1)
      expect(state.expenses[0].name).toBe("Rent")
      expect(state.expenses[0].amount).toBe(15000)
      expect(state.expenses[0].inRetirement).toBe(true)
      expect(state.expenses[0].groupId).toBe("group-1")
    })

    it("should not sync expense if no session", () => {
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)

      useExpensesStore.getState().addExpense("group-1", "Rent", 15000)

      expect(expensesApi.upsertExpense).not.toHaveBeenCalled()
    })

    it("should update expense details", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)
      useExpensesStore.setState({ expenses: [mockExpense], identity: { kind: "user", userId: "session-1" } })

      useExpensesStore.getState().updateExpense("expense-1", { amount: 16000, name: "Monthly Rent" })

      const state = useExpensesStore.getState()
      expect(state.expenses[0].amount).toBe(16000)
      expect(state.expenses[0].name).toBe("Monthly Rent")
    })

    it("should remove single expense", () => {
      vi.spyOn(expensesApi, "deleteExpense").mockResolvedValue(undefined)
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      useExpensesStore.setState({ expenses: [mockExpense, mockExpense2] })

      useExpensesStore.getState().removeExpense("expense-1")

      const state = useExpensesStore.getState()
      expect(state.expenses).toHaveLength(1)
      expect(state.expenses[0].id).toBe("expense-2")
      expect(expensesApi.deleteExpense).toHaveBeenCalledWith("expense-1")
    })

    it("should toggle inRetirement flag", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)
      useExpensesStore.setState({ expenses: [mockExpense], identity: { kind: "user", userId: "session-1" } })

      useExpensesStore.getState().toggleRetirement("expense-1")

      const state = useExpensesStore.getState()
      expect(state.expenses[0].inRetirement).toBe(false)

      useExpensesStore.getState().toggleRetirement("expense-1")
      expect(useExpensesStore.getState().expenses[0].inRetirement).toBe(true)
    })

    it("should assign sort order based on group position", () => {
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)
      useExpensesStore.setState({ expenses: [mockExpense], identity: { kind: "user", userId: "session-1" } })

      useExpensesStore.getState().addExpense("group-1", "Utilities", 2000)

      const state = useExpensesStore.getState()
      expect(state.expenses[1].sortOrder).toBe(1)
    })
  })

  describe("Sample data loading", () => {
    it("should load sample data into state", () => {
      vi.spyOn(expensesApi, "generateSeedData").mockReturnValue({
        groups: [mockGroup],
        expenses: [mockExpense],
      })
      vi.spyOn(expensesApi, "clearAllExpenses").mockResolvedValue(undefined)
      vi.spyOn(expensesApi, "seedExpenses").mockResolvedValue({
        groups: [mockGroup],
        expenses: [mockExpense],
      })

      useExpensesStore.getState().loadSampleData()

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(1)
      expect(state.expenses).toHaveLength(1)
    })
  })

  describe("Clear all", () => {
    it("should clear all groups and expenses from state", () => {
      useExpensesStore.setState({
        groups: [mockGroup],
        expenses: [mockExpense],
      })

      vi.spyOn(expensesApi, "clearAllExpenses").mockResolvedValue(undefined)

      useExpensesStore.getState().clearAll()

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(0)
      expect(state.expenses).toHaveLength(0)
    })

    it("should clear DB when session exists", () => {
      useExpensesStore.setState({
        identity: { kind: "user", userId: "session-1" },
        groups: [mockGroup],
        expenses: [mockExpense],
      })
      vi.spyOn(expensesApi, "clearAllExpenses").mockResolvedValue(undefined)

      useExpensesStore.getState().clearAll()

      expect(expensesApi.clearAllExpenses).toHaveBeenCalledWith("session-1")
    })

    it("should skip DB clear if no session", () => {
      useExpensesStore.setState({
        groups: [mockGroup],
        expenses: [mockExpense],
      })
      vi.spyOn(expensesApi, "clearAllExpenses").mockResolvedValue(undefined)

      useExpensesStore.getState().clearAll()

      expect(expensesApi.clearAllExpenses).not.toHaveBeenCalled()
    })
  })

  describe("syncFromDb", () => {
    it("should fetch and load expenses from DB", async () => {
      // The coordinator sets identity (hydrateUserScope) before calling sync.
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })
      vi.spyOn(expensesApi, "fetchExpenses").mockResolvedValue({
        groups: [mockGroup],
        expenses: [mockExpense],
      })

      await useExpensesStore.getState().syncFromDb("session-1")

      const state = useExpensesStore.getState()
      expect(state.identity).toEqual({ kind: "user", userId: "session-1" })
      expect(state.groups).toEqual([mockGroup])
      expect(state.expenses).toEqual([mockExpense])
    })

    it("should not sync if already in progress", async () => {
      vi.spyOn(expensesApi, "fetchExpenses").mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return { groups: [mockGroup], expenses: [mockExpense] }
      })

      const promise1 = useExpensesStore.getState().syncFromDb("session-1")
      const promise2 = useExpensesStore.getState().syncFromDb("session-1")

      await Promise.all([promise1, promise2])

      expect(expensesApi.fetchExpenses).toHaveBeenCalledTimes(1)
    })
  })

  describe("Monthly income", () => {
    it("should set monthly income", () => {
      useExpensesStore.getState().setMonthlyIncome(60000)
      expect(useExpensesStore.getState().monthlyIncome).toBe(60000)
    })
  })

  describe("Concurrent operations", () => {
    it("should handle multiple group additions", () => {
      vi.spyOn(expensesApi, "upsertGroup").mockResolvedValue(undefined)
      useExpensesStore.getState().setIdentity({ kind: "user", userId: "session-1" })

      useExpensesStore.getState().addGroup("Housing", "#818cf8")
      useExpensesStore.getState().addGroup("Utilities", "#60a5fa")
      useExpensesStore.getState().addGroup("Groceries", "#4ade80")

      const state = useExpensesStore.getState()
      expect(state.groups).toHaveLength(3)
      expect(state.groups[0].sortOrder).toBe(0)
      expect(state.groups[1].sortOrder).toBe(1)
      expect(state.groups[2].sortOrder).toBe(2)
    })

    it("should handle multiple expense additions to same group", () => {
      useExpensesStore.setState({ groups: [mockGroup] })

      useExpensesStore.getState().addExpense("group-1", "Rent", 15000)
      useExpensesStore.getState().addExpense("group-1", "Utilities", 2000)
      useExpensesStore.getState().addExpense("group-1", "Insurance", 1500)

      const state = useExpensesStore.getState()
      expect(state.expenses).toHaveLength(3)
      expect(state.expenses[0].sortOrder).toBe(0)
      expect(state.expenses[1].sortOrder).toBe(1)
      expect(state.expenses[2].sortOrder).toBe(2)
    })
  })

  describe("Edge cases", () => {
    it("should handle missing group when adding expense", () => {
      useExpensesStore.getState().addExpense("nonexistent-group", "Expense", 1000)

      const state = useExpensesStore.getState()
      expect(state.expenses).toHaveLength(1)
      expect(state.expenses[0].groupId).toBe("nonexistent-group")
    })

    it("should handle update of non-existent expense", () => {
      useExpensesStore.setState({ expenses: [mockExpense] })
      vi.spyOn(expensesApi, "upsertExpense").mockResolvedValue(undefined)

      useExpensesStore.getState().updateExpense("nonexistent", { amount: 5000 })

      expect(expensesApi.upsertExpense).not.toHaveBeenCalled()
    })

    it("should allow zero amount expenses", () => {
      useExpensesStore.setState({ groups: [mockGroup] })

      useExpensesStore.getState().addExpense("group-1", "Optional", 0)

      const state = useExpensesStore.getState()
      expect(state.expenses[0].amount).toBe(0)
    })
  })
})

describe("persist migration v1 → v2 (monetary cap)", () => {
  const absurd = 8.798456465498799e39

  const migrate = useExpensesStore.persist.getOptions().migrate

  it("clamps stale absurd expense amounts and income on rehydrate", () => {
    const migrated = migrate!(
      {
        monthlyIncome: absurd,
        expenses: [{ ...mockExpense, amount: absurd }],
      } as unknown,
      1
    ) as { monthlyIncome: number; expenses: { amount: number }[] }

    expect(migrated.monthlyIncome).toBe(1_000_000_000_000)
    expect(migrated.expenses[0].amount).toBe(1_000_000_000_000)
  })

  it("preserves finite values untouched", () => {
    const migrated = migrate!(
      {
        monthlyIncome: 56500,
        expenses: [{ ...mockExpense, amount: 15000 }],
      } as unknown,
      1
    ) as { monthlyIncome: number; expenses: { amount: number }[] }

    expect(migrated.monthlyIncome).toBe(56500)
    expect(migrated.expenses[0].amount).toBe(15000)
  })

  it("handles incomplete persisted state with safe fallbacks", () => {
    const migrated = migrate!({} as unknown, 1) as { monthlyIncome: number; expenses: { amount: number }[] }

    expect(migrated.monthlyIncome).toBe(0)
    expect(migrated.expenses).toEqual([])
  })
})

describe("useExpensesStore persist rehydrate", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("restores persisted expenses on rehydrate and persists later writes", async () => {
    localStorage.setItem(
      "expenses-store-v2:guest",
      JSON.stringify({
        state: {
          identity: { kind: "guest" },
          groups: [mockGroup],
          expenses: [mockExpense, mockExpense2],
          monthlyIncome: 80000,
        },
        version: 2,
      })
    )

    await useExpensesStore.persist.rehydrate()

    expect(useExpensesStore.getState().groups).toEqual([mockGroup])
    expect(useExpensesStore.getState().expenses).toHaveLength(2)
    expect(useExpensesStore.getState().monthlyIncome).toBe(80000)

    useExpensesStore.getState().setMonthlyIncome(95000)
    const stored = JSON.parse(localStorage.getItem("expenses-store-v2:guest")!)
    expect(stored.state.monthlyIncome).toBe(95000)

    useExpensesStore.setState({ identity: { kind: "guest" }, groups: [], expenses: [], monthlyIncome: 56500 })
  })
})

describe("identity transitions and stale-write guards (expenses)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useExpensesStore.setState({
      identity: { kind: "guest" },
      groups: [],
      expenses: [],
      monthlyIncome: 56500,
    })
  })

  it("does not delete a previous user's expense after sign-out", () => {
    useExpensesStore.getState().setIdentity({ kind: "guest" })
    useExpensesStore.getState().removeExpense("user-a-expense")

    expect(expensesApi.deleteExpense).not.toHaveBeenCalled()
  })

  it("resets in-memory expenses to defaults on sign-out so a previous user's data cannot linger", () => {
    useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useExpensesStore.setState({ groups: [mockGroup], expenses: [mockExpense], monthlyIncome: 120000 })

    useExpensesStore.getState().setIdentity({ kind: "guest" })

    const state = useExpensesStore.getState()
    expect(state.groups).toEqual([])
    expect(state.expenses).toEqual([])
    expect(state.monthlyIncome).toBe(56500)
    expect(state.identity).toEqual({ kind: "guest" })
  })

  it("does not delete a previous user's group after sign-out", () => {
    useExpensesStore.getState().setIdentity({ kind: "guest" })
    useExpensesStore.getState().removeGroup("user-a-group")

    expect(expensesApi.deleteGroup).not.toHaveBeenCalled()
  })

  it("cancels pending expense sync timers on sign-out", async () => {
    useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    useExpensesStore.getState().addGroup("Groceries", "#000000")
    const group = useExpensesStore.getState().groups[0]
    useExpensesStore.getState().setIdentity({ kind: "guest" })
    await vi.advanceTimersByTimeAsync(1000)

    expect(expensesApi.upsertGroup).not.toHaveBeenCalled()
    expect(group).toBeTruthy()
  })

  it("does not commit user A's expense sync after switching to user B", async () => {
    let resolveFetch!: (value: { groups: typeof mockGroup[]; expenses: typeof mockExpense[] }) => void
    vi.spyOn(expensesApi, "fetchExpenses").mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )

    useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    const sync = useExpensesStore.getState().syncFromDb("user-a")
    // User B supersedes user A while A's fetch is still pending.
    useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-b" })
    resolveFetch({ groups: [mockGroup], expenses: [mockExpense] })
    await sync

    expect(useExpensesStore.getState().identity).toEqual({ kind: "user", userId: "user-b" })
    expect(useExpensesStore.getState().groups).toEqual([])
  })

  it("rejects a stale generation's late response", async () => {
    // Generation 1 and 2 fetch different payloads; the newer generation must
    // win, and generation 1's late resolution must not overwrite it.
    const gen1Deferred = { resolve: null as null | ((v: unknown) => void), promise: null as null | Promise<unknown> }
    gen1Deferred.promise = new Promise((resolve) => {
      gen1Deferred.resolve = resolve
    })
    const gen2Payload = { groups: [mockGroup], expenses: [mockExpense] }
    vi.spyOn(expensesApi, "fetchExpenses")
      .mockReturnValueOnce(gen1Deferred.promise as never)
      .mockResolvedValueOnce(gen2Payload)

    useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-a" })
    const sync1 = useExpensesStore.getState().syncFromDb("user-a", 1)
    // A newer transition for the same user supersedes generation 1.
    const sync2 = useExpensesStore.getState().syncFromDb("user-a", 2)
    await sync2
    // Generation 1's fetch resolves late — it must be dropped.
    gen1Deferred.resolve!({ groups: [], expenses: [] })
    await sync1

    expect(useExpensesStore.getState().groups).toEqual([mockGroup])
  })
})

describe("expense sync owner re-check", () => {
  it("drops a debounced expense sync when the owner changed at fire time", async () => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    useExpensesStore.setState({ identity: { kind: "user", userId: "user-a" }, groups: [mockGroup], expenses: [] })
    useExpensesStore.getState().addExpense("group-1", "Rent", 15000)
    // Owner signs out before the 800ms debounce fires.
    useExpensesStore.getState().setIdentity({ kind: "guest" })

    await vi.advanceTimersByTimeAsync(1000)

    expect(expensesApi.upsertExpense).not.toHaveBeenCalled()
    expect(expensesApi.upsertGroup).not.toHaveBeenCalled()
  })

  it("skips the DB seed when signed out", () => {
    vi.clearAllMocks()
    useExpensesStore.setState({ identity: { kind: "guest" }, groups: [], expenses: [] })

    useExpensesStore.getState().loadSampleData()

    expect(expensesApi.clearAllExpenses).not.toHaveBeenCalled()
    expect(expensesApi.seedExpenses).not.toHaveBeenCalled()
  })
})
