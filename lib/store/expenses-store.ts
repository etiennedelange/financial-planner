"use client"

import type { Expense, ExpenseGroup } from "@/types/expenses"
import { generateSeedData } from "@/lib/constants/expense-seed"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createGatedPersistStorage } from "@/lib/store/persist-gate"
import { clampMonetaryAmount } from "@/lib/utils/monetary"

export const EXPENSES_STORAGE_KEY = "expenses-store-v2"

// See persist-gate.ts: writes are held back until the first rehydrate() settles,
// so an early set() can never clobber the user's saved expenses with the defaults.
export type PersistedExpensesState = {
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number
}
const storage = createGatedPersistStorage<PersistedExpensesState>()

/**
 * Clamps expense amounts / income loaded from anywhere untrusted — an older
 * persisted payload (migrate) or an imported backup (plan-io). Idempotent; shared
 * so both callers use ONE implementation.
 */
export function sanitizeExpenses<T extends Partial<PersistedExpensesState>>(s: T) {
  return {
    ...s,
    groups: s.groups ?? [],
    monthlyIncome: clampMonetaryAmount(s.monthlyIncome ?? 0),
    expenses: (s.expenses ?? []).map((e) => ({
      ...e,
      amount: clampMonetaryAmount(e.amount ?? 0),
    })),
  }
}

interface ExpensesState {
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number

  loadSampleData: () => void
  clearAll: () => void
  /** Replaces everything (backup import). */
  loadExpenses: (data: PersistedExpensesState) => void

  addGroup: (name: string, color: string) => void
  updateGroup: (id: string, patch: Partial<Pick<ExpenseGroup, "name" | "color">>) => void
  removeGroup: (id: string) => void

  addExpense: (groupId: string, name: string, amount: number) => void
  updateExpense: (
    id: string,
    patch: Partial<Pick<Expense, "name" | "amount" | "inRetirement">>,
  ) => void
  removeExpense: (id: string) => void
  toggleRetirement: (id: string) => void

  setMonthlyIncome: (income: number) => void
}

export const DEFAULT_MONTHLY_INCOME = 56500

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      groups: [],
      expenses: [],
      monthlyIncome: DEFAULT_MONTHLY_INCOME,

      loadSampleData: () => {
        const { groups, expenses } = generateSeedData()
        set({ groups, expenses })
      },

      clearAll: () => set({ groups: [], expenses: [] }),

      loadExpenses: (data) =>
        set({ groups: data.groups, expenses: data.expenses, monthlyIncome: data.monthlyIncome }),

      addGroup: (name, color) =>
        set((s) => ({
          groups: [
            ...s.groups,
            { id: crypto.randomUUID(), name, color, sortOrder: s.groups.length },
          ],
        })),

      updateGroup: (id, patch) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })),

      removeGroup: (id) =>
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          expenses: s.expenses.filter((e) => e.groupId !== id),
        })),

      addExpense: (groupId, name, amount) => {
        const expense: Expense = {
          id: crypto.randomUUID(),
          groupId,
          name,
          amount,
          inRetirement: true,
          sortOrder: get().expenses.filter((e) => e.groupId === groupId).length,
        }
        set((s) => ({ expenses: [...s.expenses, expense] }))
      },

      updateExpense: (id, patch) =>
        set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)) })),

      removeExpense: (id) => set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) })),

      toggleRetirement: (id) =>
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, inRetirement: !e.inRetirement } : e,
          ),
        })),

      setMonthlyIncome: (income) => set({ monthlyIncome: income }),
    }),
    {
      name: EXPENSES_STORAGE_KEY,
      storage,
      skipHydration: true,
      version: 2,
      partialize: (s): PersistedExpensesState => ({
        groups: s.groups,
        expenses: s.expenses,
        monthlyIncome: s.monthlyIncome,
      }),
      onRehydrateStorage: () => () => storage?.release(),
      // Sanitize expense amounts / income persisted before the input bounds fix
      // (R1 trillion cap): stale absurd values are clamped on rehydrate so they can
      // neither break layout nor skew the 4% rule target. Version 1 predates the cap.
      migrate: (persistedState) =>
        sanitizeExpenses(
          persistedState as Partial<PersistedExpensesState>,
        ) as PersistedExpensesState,
    },
  ),
)
