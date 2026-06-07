// lib/supabase/expenses.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExpenses, upsertGroup, upsertExpense, deleteGroup, deleteExpense } from './expenses'
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
  vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
  return chain
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
    const chain = makeChain({ data: [groupRow], error: null })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    const result = await fetchExpenses('s-1')
    expect(result.groups[0]).toEqual(group)
  })

  it('maps expense rows to Expense objects', async () => {
    const chain = makeChain({ data: [expenseRow], error: null })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    const result = await fetchExpenses('s-1')
    expect(result.expenses[0]).toEqual(expense)
  })

  it('throws on DB error', async () => {
    const chain = makeChain({ data: null, error: new Error('db error') })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    await expect(fetchExpenses('s-1')).rejects.toThrow('db error')
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
