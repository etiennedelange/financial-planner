// lib/supabase/expenses.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExpenses, upsertGroup, upsertExpense, deleteGroup, deleteExpense, seedExpenses, migrateExpensesToSession } from './expenses'
import type { Expense, ExpenseGroup } from '@/types/expenses'

vi.mock('./client', () => ({ createClient: vi.fn() }))
import { createClient } from './client'

function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['from', 'select', 'insert', 'upsert', 'delete', 'eq', 'order', 'limit']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve)
  return chain
}

// Mock for migrateExpensesToSession: tracks inserts across 3 sequential DB calls
// (existence check → group insert → expense insert) on the same client instance.
function mockMigrateClient({
  existingGroups = [] as unknown[],
  groupInsertError = null as unknown,
  expenseInsertError = null as unknown,
} = {}) {
  const insertedGroupRows: unknown[] = []
  const insertedExpenseRows: unknown[] = []
  let groupCallIdx = 0

  function makeResolvable(resolveWith: unknown) {
    const c: Record<string, unknown> = {}
    ;['select', 'eq', 'order', 'limit'].forEach((m) => { c[m] = vi.fn(() => c) })
    c.insert = vi.fn((rows: unknown) => {
      const inner: Record<string, unknown> = {}
      inner.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(resolveWith).then(resolve)
      return inner
    })
    c.then = (resolve: (v: unknown) => unknown) =>
      Promise.resolve(resolveWith).then(resolve)
    return c
  }

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'expense_groups') {
        const idx = groupCallIdx++
        if (idx === 0) {
          // existence check — return existing data, no insert
          return makeResolvable({ data: existingGroups, error: null })
        }
        // group insert — capture rows
        const c = makeResolvable({ data: null, error: groupInsertError })
        const origInsert = c.insert as ReturnType<typeof vi.fn>
        c.insert = vi.fn((rows: unknown) => {
          insertedGroupRows.push(...(rows as unknown[]))
          return origInsert(rows)
        })
        return c
      }
      // expense insert — capture rows
      const c = makeResolvable({ data: null, error: expenseInsertError })
      const origInsert = c.insert as ReturnType<typeof vi.fn>
      c.insert = vi.fn((rows: unknown) => {
        insertedExpenseRows.push(...(rows as unknown[]))
        return origInsert(rows)
      })
      return c
    }),
  }

  vi.mocked(createClient).mockReturnValue(client as unknown as ReturnType<typeof createClient>)
  return { insertedGroupRows, insertedExpenseRows, client }
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

describe('seedExpenses', () => {
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
    expect(housing?.color).toBe('#fca5a5')
  })

  it('seeds Verband with inRetirement=false', async () => {
    mockSupabase(null)
    const result = await seedExpenses('s-1')
    const verband = result.expenses.find((e) => e.name === 'Verband')
    expect(verband?.inRetirement).toBe(false)
    expect(verband?.amount).toBe(12800)
  })
})

describe('migrateExpensesToSession', () => {
  const srcGroup: ExpenseGroup = { id: 'g-src', name: 'Housing', color: '#fca5a5', sortOrder: 0 }
  const srcExpense: Expense = { id: 'e-src', groupId: 'g-src', name: 'Verband', amount: 12800, inRetirement: false, sortOrder: 0 }

  it('returns early without hitting DB when groups array is empty', async () => {
    const { client } = mockMigrateClient()
    await migrateExpensesToSession('new-session', [], [])
    expect(client.from).not.toHaveBeenCalled()
  })

  it('returns early without inserting when new session already has expense groups', async () => {
    const { client, insertedGroupRows } = mockMigrateClient({ existingGroups: [{ id: 'existing' }] })
    await migrateExpensesToSession('new-session', [srcGroup], [srcExpense])
    expect(client.from).toHaveBeenCalledTimes(1) // only the existence check
    expect(insertedGroupRows).toHaveLength(0)
  })

  it('inserts groups and expenses with remapped UUIDs and correct session_id', async () => {
    const { insertedGroupRows, insertedExpenseRows } = mockMigrateClient()
    await migrateExpensesToSession('new-session', [srcGroup], [srcExpense])

    expect(insertedGroupRows).toHaveLength(1)
    const insertedGroup = insertedGroupRows[0] as Record<string, unknown>
    expect(insertedGroup.session_id).toBe('new-session')
    expect(insertedGroup.name).toBe('Housing')
    expect(insertedGroup.color).toBe('#fca5a5')
    expect(insertedGroup.id).not.toBe('g-src') // new UUID

    expect(insertedExpenseRows).toHaveLength(1)
    const insertedExpense = insertedExpenseRows[0] as Record<string, unknown>
    expect(insertedExpense.session_id).toBe('new-session')
    expect(insertedExpense.name).toBe('Verband')
    expect(insertedExpense.amount).toBe(12800)
    expect(insertedExpense.id).not.toBe('e-src') // new UUID
    expect(insertedExpense.group_id).toBe(insertedGroup.id) // FK matches new group UUID
  })

  it('skips expense insert when there are no expenses', async () => {
    const { insertedGroupRows, insertedExpenseRows } = mockMigrateClient()
    await migrateExpensesToSession('new-session', [srcGroup], [])
    expect(insertedGroupRows).toHaveLength(1)
    expect(insertedExpenseRows).toHaveLength(0)
  })

  it('throws when group insert fails', async () => {
    mockMigrateClient({ groupInsertError: new Error('group insert failed') })
    await expect(
      migrateExpensesToSession('new-session', [srcGroup], [srcExpense])
    ).rejects.toThrow('group insert failed')
  })

  it('throws when expense insert fails', async () => {
    mockMigrateClient({ expenseInsertError: new Error('expense insert failed') })
    await expect(
      migrateExpensesToSession('new-session', [srcGroup], [srcExpense])
    ).rejects.toThrow('expense insert failed')
  })
})
