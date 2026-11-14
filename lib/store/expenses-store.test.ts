import { describe, it, expect, beforeEach, vi } from "vite-plus/test"
import {
  DEFAULT_MONTHLY_INCOME,
  EXPENSES_STORAGE_KEY,
  sanitizeExpenses,
  useExpensesStore,
} from "./expenses-store"

const mockGroup = { id: "group-1", name: "Housing", color: "#818cf8", sortOrder: 0 }
const mockExpense = {
  id: "expense-1",
  groupId: "group-1",
  name: "Rent",
  amount: 15000,
  inRetirement: true,
  sortOrder: 0,
}
const mockExpense2 = {
  ...mockExpense,
  id: "expense-2",
  name: "Utilities",
  amount: 2000,
  sortOrder: 1,
}

describe("useExpensesStore", () => {
  beforeEach(() => {
    useExpensesStore.setState({ groups: [], expenses: [], monthlyIncome: DEFAULT_MONTHLY_INCOME })
  })

  describe("Initialization", () => {
    it("starts empty with the default monthly income", () => {
      const state = useExpensesStore.getState()
      expect(state.groups).toEqual([])
      expect(state.expenses).toEqual([])
      expect(state.monthlyIncome).toBe(56500)
    })

    it("has no identity or sync machinery left", () => {
      const state = useExpensesStore.getState() as unknown as Record<string, unknown>
      for (const gone of ["identity", "setIdentity", "syncFromDb"])
        expect(state[gone]).toBeUndefined()
    })
  })

  describe("Group operations", () => {
    it("adds groups with sequential sort order", () => {
      const { addGroup } = useExpensesStore.getState()
      addGroup("Housing", "#818cf8")
      addGroup("Utilities", "#60a5fa")
      addGroup("Groceries", "#4ade80")
      const { groups } = useExpensesStore.getState()
      expect(groups.map((g) => g.sortOrder)).toEqual([0, 1, 2])
      expect(groups[0].name).toBe("Housing")
      expect(groups[0].id).toBeDefined()
    })

    it("updates a group's name and colour", () => {
      useExpensesStore.setState({ groups: [mockGroup] })
      useExpensesStore
        .getState()
        .updateGroup("group-1", { name: "Accommodation", color: "#60a5fa" })
      expect(useExpensesStore.getState().groups[0]).toMatchObject({
        name: "Accommodation",
        color: "#60a5fa",
      })
    })

    it("removing a group removes its expenses but keeps other groups' expenses", () => {
      const group2 = { id: "group-2", name: "Utilities", color: "#4ade80", sortOrder: 1 }
      const expense3 = { ...mockExpense2, groupId: "group-2", id: "expense-3" }
      useExpensesStore.setState({
        groups: [mockGroup, group2],
        expenses: [mockExpense, mockExpense2, expense3],
      })
      useExpensesStore.getState().removeGroup("group-1")
      const state = useExpensesStore.getState()
      expect(state.groups).toEqual([group2])
      expect(state.expenses.map((e) => e.id)).toEqual(["expense-3"])
    })
  })

  describe("Expense operations", () => {
    beforeEach(() => useExpensesStore.setState({ groups: [mockGroup] }))

    it("adds expenses defaulting to in-retirement, with sequential sort order per group", () => {
      const { addExpense } = useExpensesStore.getState()
      addExpense("group-1", "Rent", 15000)
      addExpense("group-1", "Utilities", 2000)
      addExpense("group-1", "Insurance", 1500)
      const { expenses } = useExpensesStore.getState()
      expect(expenses.map((e) => e.sortOrder)).toEqual([0, 1, 2])
      expect(expenses.every((e) => e.inRetirement)).toBe(true)
    })

    it("allows a zero-amount expense", () => {
      useExpensesStore.getState().addExpense("group-1", "Optional", 0)
      expect(useExpensesStore.getState().expenses[0].amount).toBe(0)
    })

    it("updates, toggles and removes an expense", () => {
      useExpensesStore.setState({ expenses: [mockExpense, mockExpense2] })
      const s = useExpensesStore.getState()
      s.updateExpense("expense-1", { amount: 16000, name: "Bond" })
      s.toggleRetirement("expense-2")
      expect(useExpensesStore.getState().expenses[0]).toMatchObject({ amount: 16000, name: "Bond" })
      expect(useExpensesStore.getState().expenses[1].inRetirement).toBe(false)
      s.removeExpense("expense-1")
      expect(useExpensesStore.getState().expenses.map((e) => e.id)).toEqual(["expense-2"])
    })

    it("ignores updates to an unknown expense", () => {
      useExpensesStore.setState({ expenses: [mockExpense] })
      useExpensesStore.getState().updateExpense("nope", { amount: 5000 })
      expect(useExpensesStore.getState().expenses).toEqual([mockExpense])
    })
  })

  describe("Sample data, clear and import", () => {
    it("loads a populated sample budget", () => {
      useExpensesStore.getState().loadSampleData()
      const { groups, expenses } = useExpensesStore.getState()
      expect(groups.length).toBeGreaterThan(0)
      expect(expenses.length).toBeGreaterThan(0)
      expect(expenses.every((e) => groups.some((g) => g.id === e.groupId))).toBe(true)
    })

    it("clearAll empties groups and expenses but keeps income", () => {
      useExpensesStore.setState({
        groups: [mockGroup],
        expenses: [mockExpense],
        monthlyIncome: 70000,
      })
      useExpensesStore.getState().clearAll()
      const state = useExpensesStore.getState()
      expect(state.groups).toEqual([])
      expect(state.expenses).toEqual([])
      expect(state.monthlyIncome).toBe(70000)
    })

    it("loadExpenses replaces everything, income included (backup restore)", () => {
      useExpensesStore.setState({ groups: [mockGroup], expenses: [mockExpense] })
      useExpensesStore
        .getState()
        .loadExpenses({ groups: [], expenses: [mockExpense2], monthlyIncome: 12345 })
      const state = useExpensesStore.getState()
      expect(state.groups).toEqual([])
      expect(state.expenses).toEqual([mockExpense2])
      expect(state.monthlyIncome).toBe(12345)
    })

    it("sets monthly income", () => {
      useExpensesStore.getState().setMonthlyIncome(60000)
      expect(useExpensesStore.getState().monthlyIncome).toBe(60000)
    })
  })
})

describe("persist migration v1 → v2 (monetary cap)", () => {
  const absurd = 8.798456465498799e39
  const migrate = useExpensesStore.persist.getOptions().migrate

  it("clamps stale absurd expense amounts and income on rehydrate", () => {
    const migrated = migrate!(
      { monthlyIncome: absurd, expenses: [{ ...mockExpense, amount: absurd }] } as unknown,
      1,
    ) as { monthlyIncome: number; expenses: { amount: number }[] }
    expect(migrated.monthlyIncome).toBe(1_000_000_000_000)
    expect(migrated.expenses[0].amount).toBe(1_000_000_000_000)
  })

  it("preserves finite values untouched", () => {
    const migrated = migrate!(
      { monthlyIncome: 56500, expenses: [{ ...mockExpense, amount: 15000 }] } as unknown,
      1,
    ) as { monthlyIncome: number; expenses: { amount: number }[] }
    expect(migrated.monthlyIncome).toBe(56500)
    expect(migrated.expenses[0].amount).toBe(15000)
  })

  it("handles incomplete persisted state with safe fallbacks", () => {
    const migrated = migrate!({} as unknown, 1) as {
      monthlyIncome: number
      expenses: unknown[]
      groups: unknown[]
    }
    expect(migrated.monthlyIncome).toBe(0)
    expect(migrated.expenses).toEqual([])
    expect(migrated.groups).toEqual([])
  })

  it("sanitizeExpenses is idempotent", () => {
    const once = sanitizeExpenses({
      groups: [mockGroup],
      expenses: [mockExpense],
      monthlyIncome: absurd,
    })
    expect(sanitizeExpenses(once)).toEqual(once)
  })
})

describe("useExpensesStore persist rehydrate", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("restores persisted expenses and persists later writes under the plain key", async () => {
    expect(EXPENSES_STORAGE_KEY).toBe("expenses-store-v2")
    localStorage.setItem(
      EXPENSES_STORAGE_KEY,
      JSON.stringify({
        state: { groups: [mockGroup], expenses: [mockExpense, mockExpense2], monthlyIncome: 80000 },
        version: 2,
      }),
    )
    await useExpensesStore.persist.rehydrate()

    expect(useExpensesStore.getState().groups).toEqual([mockGroup])
    expect(useExpensesStore.getState().expenses).toHaveLength(2)
    expect(useExpensesStore.getState().monthlyIncome).toBe(80000)

    useExpensesStore.getState().setMonthlyIncome(95000)
    expect(JSON.parse(localStorage.getItem(EXPENSES_STORAGE_KEY)!).state.monthlyIncome).toBe(95000)
  })
})

describe("expenses persistence payload", () => {
  it("persists exactly groups, expenses and monthlyIncome", () => {
    const payload = useExpensesStore.persist
      .getOptions()
      .partialize?.(useExpensesStore.getState()) as Record<string, unknown>
    expect(Object.keys(payload).sort()).toEqual(["expenses", "groups", "monthlyIncome"])
  })
})

describe("persist write-gate", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.resetModules()
  })

  it("a set() before the first rehydrate cannot overwrite saved expenses", async () => {
    localStorage.setItem(
      EXPENSES_STORAGE_KEY,
      JSON.stringify({
        state: { groups: [mockGroup], expenses: [mockExpense], monthlyIncome: 80000 },
        version: 2,
      }),
    )
    const { useExpensesStore: fresh } = await import("./expenses-store")
    fresh.getState().setMonthlyIncome(1) // lands before hydration
    await fresh.persist.rehydrate()
    expect(fresh.getState().monthlyIncome).toBe(80000)
    expect(JSON.parse(localStorage.getItem(EXPENSES_STORAGE_KEY)!).state.monthlyIncome).toBe(80000)
  })
})
