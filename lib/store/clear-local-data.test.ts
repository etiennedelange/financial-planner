import { describe, it, expect, beforeEach } from "vite-plus/test"
import { clearAllLocalData, removeLocalDataKeys } from "./clear-local-data"
import { CALCULATOR_STORAGE_KEY, useCalculatorStore } from "./calculator-store"
import { EXPENSES_STORAGE_KEY, useExpensesStore, DEFAULT_MONTHLY_INCOME } from "./expenses-store"

describe("removeLocalDataKeys", () => {
  beforeEach(() => localStorage.clear())

  it("removes the plan, expenses and backup marker — but not the theme or unrelated keys", () => {
    for (const key of [CALCULATOR_STORAGE_KEY, EXPENSES_STORAGE_KEY, "rc-last-backup-at"]) {
      localStorage.setItem(key, "x")
    }
    localStorage.setItem("theme", "dark")
    localStorage.setItem("something-else", "keep")
    const removed = removeLocalDataKeys(localStorage)
    expect(removed.sort()).toEqual(
      [CALCULATOR_STORAGE_KEY, EXPENSES_STORAGE_KEY, "rc-last-backup-at"].sort(),
    )
    expect(localStorage.getItem("theme")).toBe("dark")
    expect(localStorage.getItem("something-else")).toBe("keep")
  })
})

describe("clearAllLocalData", () => {
  beforeEach(() => localStorage.clear())

  it("resets the in-memory stores AND leaves no data keys behind", async () => {
    await useCalculatorStore.persist.rehydrate()
    await useExpensesStore.persist.rehydrate()
    useCalculatorStore.getState().setPersonalInfo({ currentAge: 61 })
    useExpensesStore.getState().addGroup("Housing", "#fff")
    useExpensesStore.getState().setMonthlyIncome(99999)
    expect(localStorage.getItem(CALCULATOR_STORAGE_KEY)).not.toBeNull()

    clearAllLocalData(localStorage)

    expect(localStorage.getItem(CALCULATOR_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(EXPENSES_STORAGE_KEY)).toBeNull()
    expect(useCalculatorStore.getState().personalInfo.currentAge).not.toBe(61)
    expect(useExpensesStore.getState().groups).toEqual([])
    expect(useExpensesStore.getState().monthlyIncome).toBe(DEFAULT_MONTHLY_INCOME)
  })

  it("does not let the persist middleware resurrect cleared data on the next edit's absence", async () => {
    await useCalculatorStore.persist.rehydrate()
    useCalculatorStore.getState().addAccount({
      id: "a",
      name: "RA",
      provider: "p",
      type: "retirement_annuity",
      currentBalance: 1,
      monthlyContribution: 1,
      expectedReturn: 10,
      annualFees: 1,
      contributionEscalation: 0,
    })
    clearAllLocalData(localStorage)
    expect(useCalculatorStore.getState().accounts).toEqual([])
    expect(localStorage.getItem(CALCULATOR_STORAGE_KEY)).toBeNull()
  })
})
