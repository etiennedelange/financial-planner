// lib/supabase/expenses.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExpenses, upsertGroup, upsertExpense, deleteGroup, deleteExpense, seedExpenses } from './expenses'
import type { Expense, ExpenseGroup } from '@/types/expenses'

vi.mock('./client', () => ({ createClient: vi.fn() }))
import { createClient } from './client'

function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['from', 'select', 'insert', 'upsert', 'delete', 'eq', 'order']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve)
  return chain
}

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = makeChain({ data, error })
  vi.mocked(createClient).mockReturnValue(chain as unknown as ReturnType<typeof createClient>)
  return chain
}

function mockSupabaseForFetch(
  groupsResult: { data?: unknown; error?: unknown },
  expensesResult: { data?: unknown; error?: unknown }
) {
  const makeSubChain = (result: { data?: unknown; error?: unknown }) => {
    const chain: Record<string, unknown> = {}
    const methods = ['select', 'eq', 'order']
    methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
    chain.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve)
    return chain
  }
  const groupChain = makeSubChain(groupsResult)
  const expenseChain = makeSubChain(expensesResult)
  const client = {
    from: vi.fn((table: string) =>
      table === 'expense_groups' ? groupChain : expenseChain
    ),
  }
  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return { groupChain, expenseChain }
}

const groupRow = { id: 'g-1', session_id: 's-1', name: 'Housing', color: '#ef4444', sort_order: 0 }
const expenseRow = { id: 'e-1', session_id: 's-1', group_id: 'g-1', name: 'Verband', amount: 12800, in_retirement: false, sort_order: 0 }

const group: ExpenseGroup = { id: 'g-1', name: 'Housing', color: '#ef4444', sortOrder: 0 }
const expense: Expense = { id: 'e-1', groupId: 'g-1', name: 'Verband', amount: 12800, inRetirement: false, sortOrder: 0 }

beforeEach(() => vi.clearAllMocks())

describe('fetchExpenses', () => {
  it('returns empty arrays when supabase is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    const result = await fetchExpenses('s-1')
    expect(result).toEqual({ groups: [], expenses: [] })
  })

  it('maps group rows to ExpenseGroup objects', async () => {
    mockSupabaseForFetch({ data: [groupRow], error: null }, { data: [], error: null })
    const result = await fetchExpenses('s-1')
    expect(result.groups).toHaveLength(1)
    expect(result.groups[0]).toEqual(group)
    expect(result.expenses).toHaveLength(0)
  })

  it('maps expense rows to Expense objects', async () => {
    mockSupabaseForFetch({ data: [], error: null }, { data: [expenseRow], error: null })
    const result = await fetchExpenses('s-1')
    expect(result.groups).toHaveLength(0)
    expect(result.expenses).toHaveLength(1)
    expect(result.expenses[0]).toEqual(expense)
  })

  it('throws when groups query errors', async () => {
    mockSupabaseForFetch({ data: null, error: new Error('db error') }, { data: null, error: null })
    await expect(fetchExpenses('s-1')).rejects.toThrow('db error')
  })

  it('throws when expenses query errors', async () => {
    mockSupabaseForFetch({ data: [], error: null }, { data: null, error: new Error('expense error') })
    await expect(fetchExpenses('s-1')).rejects.toThrow('expense error')
  })
})

describe('upsertGroup', () => {
  it('does nothing when supabase is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    await expect(upsertGroup('s-1', group)).resolves.toBeUndefined()
  })

  it('calls upsert with correct row shape', async () => {
    const chain = mockSupabase(null)
    await upsertGroup('s-1', group)
    expect(vi.mocked(chain.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      { id: 'g-1', session_id: 's-1', name: 'Housing', color: '#ef4444', sort_order: 0 },
      { onConflict: 'id' }
    )
  })
})

describe('upsertExpense', () => {
  it('does nothing when supabase is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    await expect(upsertExpense('s-1', expense)).resolves.toBeUndefined()
  })

  it('calls upsert with correct row shape', async () => {
    const chain = mockSupabase(null)
    await upsertExpense('s-1', expense)
    expect(vi.mocked(chain.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      { id: 'e-1', session_id: 's-1', group_id: 'g-1', name: 'Verband', amount: 12800, in_retirement: false, sort_order: 0 },
      { onConflict: 'id' }
    )
  })
})

describe('deleteGroup', () => {
  it('calls delete with correct id', async () => {
    const chain = mockSupabase(null)
    await deleteGroup('g-1')
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'g-1')
  })
})

describe('deleteExpense', () => {
  it('calls delete with correct id', async () => {
    const chain = mockSupabase(null)
    await deleteExpense('e-1')
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'e-1')
  })
})

describe('seedExpenses', () => {
  it('returns seed data when supabase is disabled (offline mode)', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    const result = await seedExpenses('s-1')
    expect(result.groups).toHaveLength(12)
    expect(result.expenses).toHaveLength(32)
  })

  it('returns 12 groups and 32 expenses', async () => {
    const chain = mockSupabase(null)
    const result = await seedExpenses('s-1')
    expect(result.groups).toHaveLength(12)
    expect(result.expenses).toHaveLength(32)
  })

  it('seeds Housing group with correct color', async () => {
    mockSupabase(null)
    const result = await seedExpenses('s-1')
    const housing = result.groups.find((g) => g.name === 'Housing')
    expect(housing?.color).toBe('#ef4444')
  })

  it('seeds Verband with inRetirement=false', async () => {
    mockSupabase(null)
    const result = await seedExpenses('s-1')
    const verband = result.expenses.find((e) => e.name === 'Verband')
    expect(verband?.inRetirement).toBe(false)
    expect(verband?.amount).toBe(12800)
  })
})
