import { describe, it, expect, vi, beforeEach } from 'vitest'

const getUser = vi.fn()
const selectEq = vi.fn()
const selectIn = vi.fn()
const from = vi.fn((table: string) => ({
  select: () => ({
    eq: (_col: string, _val: string) => selectEq(table),
    in: (_col: string, _vals: string[]) => selectIn(table),
  }),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve({ auth: { getUser }, from }),
}))

import { GET } from './route'

interface TableResult {
  data: unknown[] | null
  error: { message: string } | null
}

function mockTables(tables: {
  scenarios: TableResult
  expenseGroups: TableResult
  expenses: TableResult
  accounts: TableResult
}) {
  selectEq.mockImplementation((table: string) => {
    if (table === 'scenarios') return Promise.resolve(tables.scenarios)
    if (table === 'expense_groups') return Promise.resolve(tables.expenseGroups)
    if (table === 'expenses') return Promise.resolve(tables.expenses)
    throw new Error(`unexpected eq() table: ${table}`)
  })
  selectIn.mockImplementation((table: string) => {
    if (table === 'accounts') return Promise.resolve(tables.accounts)
    throw new Error(`unexpected in() table: ${table}`)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'user@example.com', created_at: '2026-01-01T00:00:00Z' } } })
  mockTables({
    scenarios: { data: [], error: null },
    expenseGroups: { data: [], error: null },
    expenses: { data: [], error: null },
    accounts: { data: [], error: null },
  })
})

describe('GET /api/account/export', () => {
  it('rejects an unauthenticated request without querying any table', async () => {
    getUser.mockResolvedValue({ data: { user: null } })

    const response = await GET()

    expect(response.status).toBe(401)
    expect(from).not.toHaveBeenCalled()
  })

  it('surfaces a real error when a table query fails, instead of a silently-empty export', async () => {
    mockTables({
      scenarios: { data: null, error: { message: 'connection reset' } },
      expenseGroups: { data: [], error: null },
      expenses: { data: [], error: null },
      accounts: { data: [], error: null },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBeTruthy()
  })

  it('surfaces a real error when the accounts query fails after scenarios resolve', async () => {
    mockTables({
      scenarios: { data: [{ id: 'scenario-1' }], error: null },
      expenseGroups: { data: [], error: null },
      expenses: { data: [], error: null },
      accounts: { data: null, error: { message: 'connection reset' } },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error).toBeTruthy()
  })

  it('returns the caller-scoped data as a downloadable JSON payload', async () => {
    mockTables({
      scenarios: { data: [{ id: 'scenario-1', session_id: 'user-1' }], error: null },
      expenseGroups: { data: [{ id: 'group-1', session_id: 'user-1' }], error: null },
      expenses: { data: [{ id: 'expense-1', session_id: 'user-1' }], error: null },
      accounts: { data: [{ id: 'account-1', scenario_id: 'scenario-1' }], error: null },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('content-disposition')).toMatch(/^attachment; filename="retirement-calculator-export-\d+\.json"$/)
    expect(body.account).toEqual({ id: 'user-1', email: 'user@example.com', createdAt: '2026-01-01T00:00:00Z' })
    expect(body.scenarios).toEqual([{ id: 'scenario-1', session_id: 'user-1' }])
    expect(body.accounts).toEqual([{ id: 'account-1', scenario_id: 'scenario-1' }])
    expect(body.expenseGroups).toEqual([{ id: 'group-1', session_id: 'user-1' }])
    expect(body.expenses).toEqual([{ id: 'expense-1', session_id: 'user-1' }])
    expect(typeof body.exportedAt).toBe('string')
  })

  it('skips the accounts query entirely when the caller has no scenarios', async () => {
    mockTables({
      scenarios: { data: [], error: null },
      expenseGroups: { data: [], error: null },
      expenses: { data: [], error: null },
      accounts: { data: [], error: null },
    })

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(selectIn).not.toHaveBeenCalled()
    expect(body.accounts).toEqual([])
  })
})
