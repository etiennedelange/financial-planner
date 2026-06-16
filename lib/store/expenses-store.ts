"use client"

import type { Expense, ExpenseGroup } from "@/types/expenses"
import {
  fetchExpenses,
  upsertGroup,
  upsertExpense,
  deleteGroup,
  deleteExpense,
  seedExpenses as seedExpensesDb,
  generateSeedData,
} from "@/lib/supabase/expenses"
import { create } from "zustand"
import { persist } from "zustand/middleware"

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

function scheduleExpenseSync(expense: Expense, sessionId: string) {
  const existing = expenseSyncTimers.get(expense.id)
  if (existing) clearTimeout(existing)
  expenseSyncTimers.set(expense.id, setTimeout(() => {
    upsertExpense(sessionId, expense).catch(console.error)
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
          if (groups.length === 0) {
            const seeded = await seedExpensesDb(sessionId)
            set({ groups: seeded.groups, expenses: seeded.expenses })
          } else {
            set({ groups, expenses })
          }
        } finally {
          syncInProgress = false
        }
      },

      loadSampleData: () => {
        const { groups: seedGroups, expenses: seedExpensesList } = generateSeedData()
        set({ groups: seedGroups, expenses: seedExpensesList })
        // Fire-and-forget DB sync; don't block the UI on it
        const { sessionId } = get()
        if (sessionId) {
          seedExpensesDb(sessionId).catch(console.error)
        }
      },

      clearAll: () => {
        const { groups, expenses, sessionId } = get()
        set({ groups: [], expenses: [] })
        if (sessionId) {
          const groupIds = groups.map((g) => g.id)
          const expenseIds = expenses.map((e) => e.id)
          Promise.all([
            ...groupIds.map((id) => deleteGroup(id)),
            ...expenseIds.map((id) => deleteExpense(id)),
          ]).catch(console.error)
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
        if (sessionId) scheduleExpenseSync(expense, sessionId)
      },

      updateExpense: (id, patch) => {
        const { sessionId } = get()
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && sessionId) scheduleExpenseSync(updated, sessionId)
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
        if (updated && sessionId) scheduleExpenseSync(updated, sessionId)
      },

      setMonthlyIncome: (income) => set({ monthlyIncome: income }),
    }),
    { name: "expenses-store-v2", skipHydration: true }
  )
)
