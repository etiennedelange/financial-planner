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
import { createGatedPersistStorage } from "@/lib/store/persist-gate"
import {
  evictUserScopedKeys,
  registerStorageBaseName,
  setScope,
  type PersistenceScope,
} from "@/lib/store/persistence-scope"
import { clampMonetaryAmount } from "@/lib/utils/monetary"

// Sign-out must be able to evict this store's user-scoped keys.
registerStorageBaseName("expenses-store-v2")

const groupSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
const expenseSyncTimers = new Map<string, ReturnType<typeof setTimeout>>()
// Per-(userId, generation) in-flight sync map: a re-run for the same identity
// does not duplicate fetches; a newer generation supersedes an older one.
const syncInFlight = new Map<string, Promise<void>>()
let latestGeneration = 0

// See persist-gate.ts: writes are held back until the first rehydrate() settles,
// so auth-driven set() calls that race the layout's manual rehydrate can never
// clobber the user's persisted expenses with the pre-hydration defaults.
// NOTE: `identity` is deliberately NOT persisted — the storage key encodes the
// scope (see persistence-scope.ts), so the payload needs no owner marker.
type PersistedExpensesState = {
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number
}
const storage = createGatedPersistStorage<PersistedExpensesState>()

function cancelGroupSync(id: string) {
  const timer = groupSyncTimers.get(id)
  if (timer) clearTimeout(timer)
  groupSyncTimers.delete(id)
}

function cancelExpenseSync(id: string) {
  const timer = expenseSyncTimers.get(id)
  if (timer) clearTimeout(timer)
  expenseSyncTimers.delete(id)
}

/** Cancels every pending debounced write (after a bulk clear or reseed) */
function cancelAllSyncs() {
  for (const id of [...groupSyncTimers.keys()]) cancelGroupSync(id)
  for (const id of [...expenseSyncTimers.keys()]) cancelExpenseSync(id)
}

function scheduleGroupSync(group: ExpenseGroup, sessionId: string) {
  const existing = groupSyncTimers.get(group.id)
  if (existing) clearTimeout(existing)
  groupSyncTimers.set(
    group.id,
    setTimeout(() => {
      groupSyncTimers.delete(group.id)
      // Re-check the owner at fire time: a sign-out between schedule and fire
      // must not upsert under a previous user's identity.
      const { identity } = useExpensesStore.getState()
      if (identity.kind !== "user" || identity.userId !== sessionId) return
      // Write the group as it is NOW; if it was deleted meanwhile, writing the captured
      // copy would resurrect the row in the database
      const current = useExpensesStore.getState().groups.find((g) => g.id === group.id)
      if (!current) return
      upsertGroup(sessionId, current).catch(console.error)
    }, 800),
  )
}

function scheduleExpenseSync(expense: Expense, group: ExpenseGroup, sessionId: string) {
  const existing = expenseSyncTimers.get(expense.id)
  if (existing) clearTimeout(existing)
  expenseSyncTimers.set(
    expense.id,
    setTimeout(async () => {
      expenseSyncTimers.delete(expense.id)
      // Re-check the owner at fire time (see scheduleGroupSync).
      const { identity } = useExpensesStore.getState()
      if (identity.kind !== "user" || identity.userId !== sessionId) return
      // Write the rows as they are NOW; a deleted expense or group must not be resurrected
      const state = useExpensesStore.getState()
      const currentExpense = state.expenses.find((e) => e.id === expense.id)
      const currentGroup = state.groups.find((g) => g.id === group.id)
      if (!currentExpense || !currentGroup) return
      try {
        // Group must exist before expense due to FK constraint — upsert is idempotent.
        await upsertGroup(sessionId, currentGroup)
        await upsertExpense(sessionId, currentExpense)
      } catch (e) {
        console.error(e)
      }
    }, 800),
  )
}

interface ExpensesState {
  identity: PersistenceScope
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number

  setIdentity: (scope: PersistenceScope) => void
  syncFromDb: (userId: string, generation?: number) => Promise<void>
  loadSampleData: () => void
  clearAll: () => void

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

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      identity: { kind: "guest" } as PersistenceScope,
      groups: [],
      expenses: [],
      monthlyIncome: 56500,

      setIdentity: (scope) => {
        const prev = get().identity
        set({ identity: scope })
        // Sign-out transition: cancel pending sync timers, switch persistence
        // back to the guest scope, and evict the signed-out user's scoped keys.
        if (scope.kind === "guest" && prev.kind === "user") {
          for (const timer of groupSyncTimers.values()) clearTimeout(timer)
          for (const timer of expenseSyncTimers.values()) clearTimeout(timer)
          groupSyncTimers.clear()
          expenseSyncTimers.clear()
          setScope({ kind: "guest" })
          evictUserScopedKeys(prev.userId)
        }
      },

      // userId + generation are explicit: the coordinator passes the transition
      // generation so a late response can be dropped at the store, not just by
      // actor cancellation.
      syncFromDb: (userId: string, generation = 0) => {
        const key = `${userId}:${generation}`
        const existing = syncInFlight.get(key)
        if (existing) return existing

        latestGeneration = Math.max(latestGeneration, generation)

        // The in-flight entry is registered BEFORE the async body runs (via
        // Promise.resolve().then) so a synchronous early-return can never leave
        // a stale completed promise behind.
        const promise = Promise.resolve().then(async () => {
          try {
            const { groups, expenses } = await fetchExpenses(userId)

            // Stale check before committing: the same user must still own the
            // store, and no newer generation may have superseded this one.
            const current = get().identity
            if (
              current.kind !== "user" ||
              current.userId !== userId ||
              generation < latestGeneration
            ) {
              return
            }
            set({ identity: { kind: "user", userId }, groups, expenses })
          } finally {
            syncInFlight.delete(key)
          }
        })
        syncInFlight.set(key, promise)
        return promise
      },

      loadSampleData: () => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        const { groups: seedGroups, expenses: seedExpensesList } = generateSeedData()
        cancelAllSyncs()
        set({ groups: seedGroups, expenses: seedExpensesList })
        // Clear existing DB rows then seed — fire-and-forget, don't block UI.
        // clearAllExpenses cascades to expenses via FK, so one query is enough.
        if (userId) {
          clearAllExpenses(userId)
            .then(() => seedExpensesDb(userId))
            .catch(console.error)
        }
      },

      clearAll: () => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        cancelAllSyncs()
        set({ groups: [], expenses: [] })
        // One bulk delete; cascade removes all child expenses automatically.
        if (userId) {
          clearAllExpenses(userId).catch(console.error)
        }
      },

      addGroup: (name, color) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        const group: ExpenseGroup = {
          id: crypto.randomUUID(),
          name,
          color,
          sortOrder: get().groups.length,
        }
        set((s) => ({ groups: [...s.groups, group] }))
        if (userId) scheduleGroupSync(group, userId)
      },

      updateGroup: (id, patch) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }))
        const updated = get().groups.find((g) => g.id === id)
        if (updated && userId) scheduleGroupSync(updated, userId)
      },

      removeGroup: (id) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        cancelGroupSync(id)
        for (const e of get().expenses) if (e.groupId === id) cancelExpenseSync(e.id)
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          expenses: s.expenses.filter((e) => e.groupId !== id),
        }))
        // Only delete remotely while still signed in as the owner.
        const current = get().identity
        if (current.kind === "user" && current.userId === userId && userId != null) {
          deleteGroup(id).catch(console.error)
        }
      },

      addExpense: (groupId, name, amount) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        const expense: Expense = {
          id: crypto.randomUUID(),
          groupId,
          name,
          amount,
          inRetirement: true,
          sortOrder: get().expenses.filter((e) => e.groupId === groupId).length,
        }
        set((s) => ({ expenses: [...s.expenses, expense] }))
        if (userId) {
          const group = get().groups.find((g) => g.id === groupId)
          if (group) scheduleExpenseSync(expense, group, userId)
        }
      },

      updateExpense: (id, patch) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && userId) {
          const group = get().groups.find((g) => g.id === updated.groupId)
          if (group) scheduleExpenseSync(updated, group, userId)
        }
      },

      removeExpense: (id) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        cancelExpenseSync(id)
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
        // Only delete remotely while still signed in as the owner.
        const current = get().identity
        if (current.kind === "user" && current.userId === userId && userId != null) {
          deleteExpense(id).catch(console.error)
        }
      },

      toggleRetirement: (id) => {
        const { identity } = get()
        const userId = identity.kind === "user" ? identity.userId : null
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, inRetirement: !e.inRetirement } : e,
          ),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && userId) {
          const group = get().groups.find((g) => g.id === updated.groupId)
          if (group) scheduleExpenseSync(updated, group, userId)
        }
      },

      setMonthlyIncome: (income) => set({ monthlyIncome: income }),
    }),
    {
      name: "expenses-store-v2",
      storage,
      skipHydration: true,
      version: 2,
      // `identity` must not be persisted (the storage key encodes the scope): without
      // this, rehydrate merged a stale persisted identity over the in-memory one
      partialize: (s): PersistedExpensesState => ({
        groups: s.groups,
        expenses: s.expenses,
        monthlyIncome: s.monthlyIncome,
      }),
      onRehydrateStorage: () => () => storage?.release(),
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
    },
  ),
)
