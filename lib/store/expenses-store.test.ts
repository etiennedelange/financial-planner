import { describe, it, expect, vi, beforeEach } from 'vitest'

const SEED_GROUPS = [{ id: 'g-seed', name: 'Housing', color: '#fca5a5', sortOrder: 0 }]
const SEED_EXPENSES = [{ id: 'e-seed', groupId: 'g-seed', name: 'Rent', amount: 10000, inRetirement: true, sortOrder: 0 }]

vi.mock('@/lib/supabase/expenses', () => ({
  fetchExpenses: vi.fn(async () => ({ groups: [], expenses: [] })),
  seedExpenses: vi.fn(async () => ({ groups: SEED_GROUPS, expenses: SEED_EXPENSES })),
  generateSeedData: vi.fn(() => ({ groups: SEED_GROUPS, expenses: SEED_EXPENSES })),
  upsertGroup: vi.fn(async () => {}),
  upsertExpense: vi.fn(async () => {}),
  deleteGroup: vi.fn(async () => {}),
  deleteExpense: vi.fn(async () => {}),
}))

vi.mock('zustand/middleware', () => ({
  persist: (fn: unknown) => fn,
}))

import { generateSeedData, seedExpenses, deleteGroup, deleteExpense } from '@/lib/supabase/expenses'

let useExpensesStore: typeof import('./expenses-store').useExpensesStore

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  const mod = await import('./expenses-store')
  useExpensesStore = mod.useExpensesStore
  useExpensesStore.setState({ groups: [], expenses: [], monthlyIncome: 56500, sessionId: null })
})

describe('initial state', () => {
  it('starts with no groups', () => {
    expect(useExpensesStore.getState().groups).toHaveLength(0)
  })

  it('starts with no expenses', () => {
    expect(useExpensesStore.getState().expenses).toHaveLength(0)
  })

  it('does not auto-seed on store creation', () => {
    expect(generateSeedData).not.toHaveBeenCalled()
    expect(seedExpenses).not.toHaveBeenCalled()
  })
})

describe('loadSampleData', () => {
  it('populates groups and expenses synchronously', () => {
    useExpensesStore.getState().loadSampleData()
    const { groups, expenses } = useExpensesStore.getState()
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Housing')
    expect(expenses).toHaveLength(1)
    expect(expenses[0].name).toBe('Rent')
  })

  it('calls generateSeedData to build data locally', () => {
    useExpensesStore.getState().loadSampleData()
    expect(generateSeedData).toHaveBeenCalledTimes(1)
  })

  it('does not call seedExpenses (DB) when sessionId is null', () => {
    useExpensesStore.setState({ sessionId: null })
    useExpensesStore.getState().loadSampleData()
    expect(seedExpenses).not.toHaveBeenCalled()
  })

  it('fires DB sync in the background when sessionId is set', () => {
    useExpensesStore.setState({ sessionId: 'session-abc' })
    useExpensesStore.getState().loadSampleData()
    expect(seedExpenses).toHaveBeenCalledWith('session-abc')
  })

  it('works when called multiple times', () => {
    useExpensesStore.getState().loadSampleData()
    useExpensesStore.getState().loadSampleData()
    expect(useExpensesStore.getState().groups).toHaveLength(1)
  })
})

describe('clearAll', () => {
  it('removes all groups and expenses', () => {
    useExpensesStore.getState().loadSampleData()
    expect(useExpensesStore.getState().groups.length).toBeGreaterThan(0)
    useExpensesStore.getState().clearAll()
    expect(useExpensesStore.getState().groups).toHaveLength(0)
    expect(useExpensesStore.getState().expenses).toHaveLength(0)
  })

  it('does not call DB delete when sessionId is null', () => {
    useExpensesStore.setState({ sessionId: null })
    useExpensesStore.getState().loadSampleData()
    vi.clearAllMocks()
    useExpensesStore.getState().clearAll()
    expect(deleteGroup).not.toHaveBeenCalled()
    expect(deleteExpense).not.toHaveBeenCalled()
  })

  it('calls DB delete for each group and expense when sessionId is set', () => {
    useExpensesStore.setState({ sessionId: 'session-abc' })
    useExpensesStore.getState().loadSampleData()
    vi.clearAllMocks()
    useExpensesStore.getState().clearAll()
    expect(deleteGroup).toHaveBeenCalledWith('g-seed')
    expect(deleteExpense).toHaveBeenCalledWith('e-seed')
  })
})

describe('addGroup', () => {
  it('adds a group to the store', () => {
    useExpensesStore.getState().addGroup('Transport', '#3b82f6')
    const { groups } = useExpensesStore.getState()
    expect(groups).toHaveLength(1)
    expect(groups[0].name).toBe('Transport')
    expect(groups[0].color).toBe('#3b82f6')
  })
})

describe('addExpense', () => {
  it('adds an expense linked to a group with inRetirement=true by default', () => {
    useExpensesStore.getState().addGroup('Food', '#22c55e')
    const { groups } = useExpensesStore.getState()
    useExpensesStore.getState().addExpense(groups[0].id, 'Groceries', 5000)
    const { expenses } = useExpensesStore.getState()
    expect(expenses).toHaveLength(1)
    expect(expenses[0].name).toBe('Groceries')
    expect(expenses[0].amount).toBe(5000)
    expect(expenses[0].inRetirement).toBe(true)
  })
})

describe('removeGroup', () => {
  it('removes the group and its expenses', () => {
    useExpensesStore.getState().addGroup('Food', '#22c55e')
    const { groups } = useExpensesStore.getState()
    useExpensesStore.getState().addExpense(groups[0].id, 'Groceries', 5000)
    useExpensesStore.getState().removeGroup(groups[0].id)
    const state = useExpensesStore.getState()
    expect(state.groups).toHaveLength(0)
    expect(state.expenses).toHaveLength(0)
  })
})

describe('toggleRetirement', () => {
  it('flips the inRetirement flag', () => {
    useExpensesStore.getState().addGroup('Food', '#22c55e')
    const { groups } = useExpensesStore.getState()
    useExpensesStore.getState().addExpense(groups[0].id, 'Groceries', 5000)
    const { expenses } = useExpensesStore.getState()
    expect(expenses[0].inRetirement).toBe(true)
    useExpensesStore.getState().toggleRetirement(expenses[0].id)
    expect(useExpensesStore.getState().expenses[0].inRetirement).toBe(false)
    useExpensesStore.getState().toggleRetirement(expenses[0].id)
    expect(useExpensesStore.getState().expenses[0].inRetirement).toBe(true)
  })
})
