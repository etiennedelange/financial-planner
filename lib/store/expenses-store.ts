"use client"

import type { Expense, ExpenseGroup } from "@/types/expenses"
import {
  fetchExpenses,
  upsertGroup,
  upsertExpense,
  deleteGroup,
  deleteExpense,
  clearAllExpenses,
  seedExpenses as seedExpensesDb,
  generateSeedData,
} from "@/lib/supabase/expenses"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { clampMonetaryAmount } from "@/lib/utils/monetary"

const groupSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
const expenseSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
let syncInProgress = false

function scheduleGroupSync(group: ExpenseGroup, sessionId: string) {
  const existing = groupSyncTimers.get(group.id)
  if (existing) clearTimeout(existing)
  groupSyncTimers.set(group.id, setTimeout(() => {
    upsertGroup(sessionId, group).catch(console.error)
    groupSyncTimers.delete(group.id)
  }, 800))
}

function scheduleExpenseSync(expense: Expense, group: ExpenseGroup, sessionId: string) {
  const existing = expenseSyncTimers.get(expense.id)
  if (existing) clearTimeout(existing)
  expenseSyncTimers.set(expense.id, setTimeout(async () => {
    try {
      // Group must exist before expense due to FK constraint — upsert is idempotent.
      await upsertGroup(sessionId, group)
      await upsertExpense(sessionId, expense)
    } catch (e) {
      console.error(e)
    }
    expenseSyncTimers.delete(expense.id)
  }, 800))
}

interface ExpensesState {
  sessionId: string | null
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number

  setSessionId: (id: string) => void
  syncFromDb: (sessionId: string) => Promise<void>
  loadSampleData: () => void
  clearAll: () => void

  addGroup: (name: string, color: string) => void
  updateGroup: (id: string, patch: Partial<Pick<ExpenseGroup, "name" | "color">>) => void
  removeGroup: (id: string) => void

  addExpense: (groupId: string, name: string, amount: number) => void
  updateExpense: (id: string, patch: Partial<Pick<Expense, "name" | "amount" | "inRetirement">>) => void
  removeExpense: (id: string) => void
  toggleRetirement: (id: string) => void

  setMonthlyIncome: (income: number) => void
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      groups: [],
      expenses: [],
      monthlyIncome: 56500,

      setSessionId: (id) => set({ sessionId: id }),

      syncFromDb: async (sessionId) => {
        if (syncInProgress) return
        syncInProgress = true
        try {
          set({ sessionId })
          const { groups, expenses } = await fetchExpenses(sessionId)
          set({ groups, expenses })
        } finally {
          syncInProgress = false
        }
      },

      loadSampleData: () => {
        const { sessionId } = get()
        const { groups: seedGroups, expenses: seedExpensesList } = generateSeedData()
        set({ groups: seedGroups, expenses: seedExpensesList })
        // Clear existing DB rows then seed — fire-and-forget, don't block UI.
        // clearAllExpenses cascades to expenses via FK, so one query is enough.
        if (sessionId) {
          clearAllExpenses(sessionId)
            .then(() => seedExpensesDb(sessionId))
            .catch(console.error)
        }
      },

      clearAll: () => {
        const { sessionId } = get()
        set({ groups: [], expenses: [] })
        // One bulk delete; cascade removes all child expenses automatically.
        if (sessionId) {
          clearAllExpenses(sessionId).catch(console.error)
        }
      },

      addGroup: (name, color) => {
        const { sessionId } = get()
        const group: ExpenseGroup = {
          id: crypto.randomUUID(),
          name,
          color,
          sortOrder: get().groups.length,
        }
        set((s) => ({ groups: [...s.groups, group] }))
        if (sessionId) scheduleGroupSync(group, sessionId)
      },

      updateGroup: (id, patch) => {
        const { sessionId } = get()
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }))
        const updated = get().groups.find((g) => g.id === id)
        if (updated && sessionId) scheduleGroupSync(updated, sessionId)
      },

      removeGroup: (id) => {
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          expenses: s.expenses.filter((e) => e.groupId !== id),
        }))
        deleteGroup(id).catch(console.error)
      },

      addExpense: (groupId, name, amount) => {
        const { sessionId } = get()
        const expense: Expense = {
          id: crypto.randomUUID(),
          groupId,
          name,
          amount,
          inRetirement: true,
          sortOrder: get().expenses.filter((e) => e.groupId === groupId).length,
        }
        set((s) => ({ expenses: [...s.expenses, expense] }))
        if (sessionId) {
          const group = get().groups.find((g) => g.id === groupId)
          if (group) scheduleExpenseSync(expense, group, sessionId)
        }
      },

      updateExpense: (id, patch) => {
        const { sessionId } = get()
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && sessionId) {
          const group = get().groups.find((g) => g.id === updated.groupId)
          if (group) scheduleExpenseSync(updated, group, sessionId)
        }
      },

      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
        deleteExpense(id).catch(console.error)
      },

      toggleRetirement: (id) => {
        const { sessionId } = get()
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, inRetirement: !e.inRetirement } : e
          ),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && sessionId) {
          const group = get().groups.find((g) => g.id === updated.groupId)
          if (group) scheduleExpenseSync(updated, group, sessionId)
        }
      },

      setMonthlyIncome: (income) => set({ monthlyIncome: income }),
    }),
    { name: "expenses-store-v2", skipHydration: true,
      version: 2,
      // Sanitize expense amounts / income persisted before the input bounds fix
      // (R1 trillion cap): stale absurd values are clamped on rehydrate so they can
      // neither break layout nor skew the 4% rule target. Version 1 predates the cap.
      migrate: (persistedState) => {
        const s = persistedState as ExpensesState
        return {
          ...s,
          monthlyIncome: clampMonetaryAmount(s.monthlyIncome ?? 0),
          expenses: (s.expenses ?? []).map((e) => ({
            ...e,
            amount: clampMonetaryAmount(e.amount ?? 0),
          })),
        }
      },
    }
  )
)
