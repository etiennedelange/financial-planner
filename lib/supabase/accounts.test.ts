import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchAccounts, upsertAccount, cloneAccounts, deleteAccount } from './accounts'
import type { Account } from '@/types'

vi.mock('./client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from './client'

function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'single']
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

const baseAccount: Account = {
  id: 'acc-1',
  name: 'My RA',
  provider: 'Sanlam',
  type: 'retirement_annuity',
  currentBalance: 500000,
  monthlyContribution: 5000,
  expectedReturn: 11,
  annualFees: 1,
  contributionEscalation: 6,
}

const accountRow = {
  id: 'acc-1',
  scenario_id: 'scenario-1',
  name: 'My RA',
  provider: 'Sanlam',
  type: 'retirement_annuity',
  current_balance: 500000,
  monthly_contribution: 5000,
  expected_return: 11,
  annual_fees: 1,
  contribution_escalation: 6,
  tfsa_contributions_to_date: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => vi.clearAllMocks())

describe('fetchAccounts', () => {
  it('maps rows to Account objects', async () => {
    mockSupabase([accountRow])
    const result = await fetchAccounts('scenario-1')
    expect(result).toHaveLength(1)
    expect(result[0].currentBalance).toBe(500000)
    expect(result[0].monthlyContribution).toBe(5000)
    expect(result[0].tfsaContributionsToDate).toBeUndefined()
  })

  it('maps tfsaContributionsToDate when present', async () => {
    mockSupabase([{ ...accountRow, tfsa_contributions_to_date: 80000 }])
    const result = await fetchAccounts('scenario-1')
    expect(result[0].tfsaContributionsToDate).toBe(80000)
  })

  it('throws on error', async () => {
    mockSupabase(null, { message: 'DB error', code: '500' })
    await expect(fetchAccounts('scenario-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('upsertAccount', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(upsertAccount(baseAccount, 'scenario-1')).resolves.toBeUndefined()
  })

  it('throws on error', async () => {
    mockSupabase(null, { message: 'upsert failed', code: '500' })
    await expect(upsertAccount(baseAccount, 'scenario-1')).rejects.toMatchObject({ message: 'upsert failed' })
  })
})

describe('cloneAccounts', () => {
  it('returns cloned accounts with new UUIDs', async () => {
    mockSupabase(null, null)
    const cloned = await cloneAccounts([baseAccount], 'new-scenario-id')
    expect(cloned).toHaveLength(1)
    expect(cloned[0].id).not.toBe(baseAccount.id)
    expect(cloned[0].name).toBe(baseAccount.name)
    expect(cloned[0].currentBalance).toBe(baseAccount.currentBalance)
  })

  it('clones multiple accounts all with distinct new IDs', async () => {
    mockSupabase(null, null)
    const acc2 = { ...baseAccount, id: 'acc-2', name: 'TFSA' }
    const cloned = await cloneAccounts([baseAccount, acc2], 'new-scenario-id')
    expect(cloned).toHaveLength(2)
    expect(cloned[0].id).not.toBe(baseAccount.id)
    expect(cloned[1].id).not.toBe(acc2.id)
    expect(cloned[0].id).not.toBe(cloned[1].id)
  })

  it('throws on insert error', async () => {
    mockSupabase(null, { message: 'insert failed', code: '500' })
    await expect(cloneAccounts([baseAccount], 'new-scenario-id')).rejects.toMatchObject({ message: 'insert failed' })
  })
})

describe('deleteAccount', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(deleteAccount('acc-1')).resolves.toBeUndefined()
  })

})
