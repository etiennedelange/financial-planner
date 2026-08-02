import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  listScenarios,
  fetchScenario,
  createScenario,
  updateScenario,
  renameScenario,
  deleteScenario,
  markScenarioClaimComplete,
} from './scenarios'

// Chainable Supabase query builder mock
function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'order', 'single']
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain)
  })
  // Terminal resolution
  ;(chain as unknown as Record<symbol, unknown>)[Symbol.iterator] = undefined
  Object.assign(chain, Promise.resolve(resolveWith))
  // Make it thenable
  ;(chain as Record<string, unknown>).then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve)
  return chain
}

vi.mock('./client', () => ({
  createClient: vi.fn(),
}))

import { createClient } from './client'

const mockScenarioRow = {
  id: 'scenario-1',
  name: 'My Plan',
  updated_at: '2026-05-09T00:00:00Z',
  personal_info: { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
  retirement_goals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
  assumptions: {
    equityReturn: 11, bondReturn: 8, cashReturn: 6.5,
    equityVolatility: 16.5, bondVolatility: 6, inflationRate: 5.5, compoundingMethod: 'compound',
  },
  drawdown_config: {
    strategy: 'fixed_percentage', initialWithdrawalRate: 4,
    minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0,
  },
  display_mode: 'nominal',
}

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = makeChain({ data, error })
  vi.mocked(createClient).mockReturnValue(chain as unknown as ReturnType<typeof createClient>)
  return chain
}

beforeEach(() => vi.clearAllMocks())

describe('listScenarios', () => {
  it('returns mapped scenario metas', async () => {
    mockSupabase([
      { id: 'scenario-1', name: 'My Plan', updated_at: '2026-05-09T00:00:00Z', claim_complete: true },
    ])
    const result = await listScenarios('user-1')
    expect(result).toEqual([
      { id: 'scenario-1', name: 'My Plan', updatedAt: '2026-05-09T00:00:00Z', claimComplete: true },
    ])
  })

  it('returns empty array when no scenarios exist', async () => {
    mockSupabase(null)
    const result = await listScenarios('user-1')
    expect(result).toEqual([])
  })

  it('throws on supabase error', async () => {
    mockSupabase(null, { message: 'DB error', code: '500' })
    await expect(listScenarios('user-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('fetchScenario', () => {
  it('maps row fields to ScenarioData', async () => {
    mockSupabase(mockScenarioRow)
    const result = await fetchScenario('scenario-1')
    expect(result?.personalInfo.currentAge).toBe(35)
    expect(result?.displayMode).toBe('nominal')
    expect(result?.assumptions.compoundingMethod).toBe('compound')
  })

  it('returns null on PGRST116 (no rows)', async () => {
    mockSupabase(null, { code: 'PGRST116', message: 'no rows' })
    expect(await fetchScenario('scenario-1')).toBeNull()
  })

  it('throws on other errors', async () => {
    mockSupabase(null, { code: '500', message: 'DB error' })
    await expect(fetchScenario('scenario-1')).rejects.toMatchObject({ message: 'DB error' })
  })
})

describe('createScenario', () => {
  it('returns the new scenario id', async () => {
    mockSupabase({ id: 'new-id' })
    const id = await createScenario('user-1', 'Optimistic', {
      personalInfo: mockScenarioRow.personal_info as never,
      retirementGoals: mockScenarioRow.retirement_goals as never,
      assumptions: mockScenarioRow.assumptions as never,
      drawdownConfig: mockScenarioRow.drawdown_config as never,
      displayMode: 'nominal',
    })
    expect(id).toBe('new-id')
  })

  it('defaults claim_complete to true when not passed', async () => {
    const chain = mockSupabase({ id: 'new-id' })
    await createScenario('user-1', 'Optimistic', {
      personalInfo: mockScenarioRow.personal_info as never,
      retirementGoals: mockScenarioRow.retirement_goals as never,
      assumptions: mockScenarioRow.assumptions as never,
      drawdownConfig: mockScenarioRow.drawdown_config as never,
      displayMode: 'nominal',
    })
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ claim_complete: true }))
  })

  it('passes claim_complete: false through when a claim starts the scenario', async () => {
    const chain = mockSupabase({ id: 'new-id' })
    await createScenario(
      'user-1',
      'My Plan',
      {
        personalInfo: mockScenarioRow.personal_info as never,
        retirementGoals: mockScenarioRow.retirement_goals as never,
        assumptions: mockScenarioRow.assumptions as never,
        drawdownConfig: mockScenarioRow.drawdown_config as never,
        displayMode: 'nominal',
      },
      false
    )
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ claim_complete: false }))
  })

  it('throws on insert error', async () => {
    mockSupabase(null, { message: 'insert failed', code: '500' })
    await expect(
      createScenario('user-1', 'Test', {
        personalInfo: mockScenarioRow.personal_info as never,
        retirementGoals: mockScenarioRow.retirement_goals as never,
        assumptions: mockScenarioRow.assumptions as never,
        drawdownConfig: mockScenarioRow.drawdown_config as never,
        displayMode: 'nominal',
      })
    ).rejects.toMatchObject({ message: 'insert failed' })
  })
})

describe('updateScenario', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(
      updateScenario('scenario-1', {
        personalInfo: mockScenarioRow.personal_info as never,
        retirementGoals: mockScenarioRow.retirement_goals as never,
        assumptions: mockScenarioRow.assumptions as never,
        drawdownConfig: mockScenarioRow.drawdown_config as never,
        displayMode: 'real',
      })
    ).resolves.toBeUndefined()
  })

})

describe('renameScenario', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(renameScenario('scenario-1', 'Conservative')).resolves.toBeUndefined()
  })

  it('throws on error', async () => {
    mockSupabase(null, { message: 'update failed', code: '500' })
    await expect(renameScenario('scenario-1', 'Conservative')).rejects.toMatchObject({ message: 'update failed' })
  })
})

describe('markScenarioClaimComplete', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(markScenarioClaimComplete('scenario-1')).resolves.toBeUndefined()
  })

  it('throws on error', async () => {
    mockSupabase(null, { message: 'update failed', code: '500' })
    await expect(markScenarioClaimComplete('scenario-1')).rejects.toMatchObject({ message: 'update failed' })
  })
})

describe('deleteScenario', () => {
  it('resolves without error on success', async () => {
    mockSupabase(null, null)
    await expect(deleteScenario('scenario-1')).resolves.toBeUndefined()
  })

})
