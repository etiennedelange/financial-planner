import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./scenarios', () => ({
  listScenarios: vi.fn(),
  createScenario: vi.fn(),
  markScenarioClaimComplete: vi.fn(),
}))
vi.mock('./accounts', () => ({ cloneAccounts: vi.fn(), fetchAccounts: vi.fn() }))
vi.mock('./expenses', () => ({ migrateExpensesToSession: vi.fn() }))

import { listScenarios, createScenario, markScenarioClaimComplete } from './scenarios'
import { cloneAccounts, fetchAccounts } from './accounts'
import { migrateExpensesToSession } from './expenses'
import { claimLocalData } from './claim'

const PENDING_CLAIM_KEY = 'rc-pending-claim-scenario-id'

const localState = {
  personalInfo: { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
  retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
  assumptions: {
    equityReturn: 11, bondReturn: 8, cashReturn: 6.5,
    equityVolatility: 16.5, bondVolatility: 6, inflationRate: 5.5,
    compoundingMethod: 'compound' as const,
  },
  drawdownConfig: {
    strategy: 'fixed_percentage' as const, initialWithdrawalRate: 4,
    minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0,
    upperGuardrail: 20, lowerGuardrail: 20,
  },
  displayMode: 'nominal' as const,
  accounts: [{ id: 'a1', name: 'RA', type: 'retirement_annuity', currentBalance: 100000,
    monthlyContribution: 5000, annualEscalation: 6, expectedReturn: 11, equityAllocation: 70 }],
  expenseGroups: [{ id: 'g1', name: 'Housing', color: '#6366f1', sortOrder: 0 }],
  expenses: [{ id: 'e1', groupId: 'g1', name: 'Rent', amount: 12000, inRetirement: true, sortOrder: 0 }],
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
})

describe('claimLocalData', () => {
  describe('server has no data', () => {
    it('migrates local state up, marks the claim complete, and reports the new scenario', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockImplementation(async (_u, _n, _d, _c, id) => id!)
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      const result = await claimLocalData('user-1', localState as never)

      expect(result.claimed).toBe(true)
      const scenarioId = (result as { claimed: true; scenarioId: string }).scenarioId
      expect(scenarioId).toBeTruthy()
      expect(createScenario).toHaveBeenCalledWith(
        'user-1',
        'My Plan',
        expect.objectContaining({ personalInfo: localState.personalInfo }),
        false,
        scenarioId,
      )
      expect(cloneAccounts).toHaveBeenCalledWith(localState.accounts, scenarioId)
      expect(migrateExpensesToSession).toHaveBeenCalledWith(
        'user-1', localState.expenseGroups, localState.expenses,
      )
      expect(markScenarioClaimComplete).toHaveBeenCalledWith(scenarioId)
    })

    it('clears the pending-claim marker after a fresh successful claim', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockImplementation(async (_u, _n, _d, _c, id) => id!)
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      await claimLocalData('user-1', localState as never)

      expect(localStorage.getItem(PENDING_CLAIM_KEY)).toBeNull()
    })

    it('leaves the pending-claim marker in place when scenario creation fails', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockRejectedValue(new Error('network down'))

      await expect(claimLocalData('user-1', localState as never)).rejects.toThrow('network down')

      const [, , , , generatedId] = vi.mocked(createScenario).mock.calls[0]
      expect(generatedId).toBeTruthy()
      expect(localStorage.getItem(PENDING_CLAIM_KEY)).toBe(generatedId)
    })
  })

  describe('server already has data', () => {
    it('does not write anything and reports server-has-data', async () => {
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'existing', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: true },
      ])

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(createScenario).not.toHaveBeenCalled()
      expect(cloneAccounts).not.toHaveBeenCalled()
      expect(migrateExpensesToSession).not.toHaveBeenCalled()
      expect(markScenarioClaimComplete).not.toHaveBeenCalled()
    })
  })

  describe('resuming an interrupted claim', () => {
    it('resumes an incomplete claim and clones accounts when the scenario has none yet', async () => {
      localStorage.setItem(PENDING_CLAIM_KEY, 'incomplete-scenario')
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'incomplete-scenario', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: false },
      ])
      vi.mocked(fetchAccounts).mockResolvedValue([])
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: true, scenarioId: 'incomplete-scenario' })
      expect(createScenario).not.toHaveBeenCalled()
      expect(fetchAccounts).toHaveBeenCalledWith('incomplete-scenario')
      expect(cloneAccounts).toHaveBeenCalledWith(localState.accounts, 'incomplete-scenario')
      expect(migrateExpensesToSession).toHaveBeenCalledWith(
        'user-1', localState.expenseGroups, localState.expenses,
      )
      expect(markScenarioClaimComplete).toHaveBeenCalledWith('incomplete-scenario')
    })

    it('resumes an incomplete claim without re-cloning accounts that already exist', async () => {
      localStorage.setItem(PENDING_CLAIM_KEY, 'incomplete-scenario')
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'incomplete-scenario', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: false },
      ])
      vi.mocked(fetchAccounts).mockResolvedValue(localState.accounts as never)

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: true, scenarioId: 'incomplete-scenario' })
      expect(cloneAccounts).not.toHaveBeenCalled()
      expect(migrateExpensesToSession).toHaveBeenCalledWith(
        'user-1', localState.expenseGroups, localState.expenses,
      )
      expect(markScenarioClaimComplete).toHaveBeenCalledWith('incomplete-scenario')
    })

    it('clears the pending-claim marker after resuming and completing a claim', async () => {
      localStorage.setItem(PENDING_CLAIM_KEY, 'incomplete-scenario')
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'incomplete-scenario', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: false },
      ])
      vi.mocked(fetchAccounts).mockResolvedValue([])
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      await claimLocalData('user-1', localState as never)

      expect(localStorage.getItem(PENDING_CLAIM_KEY)).toBeNull()
    })

    it('does not resume an incomplete claim that belongs to a different device', async () => {
      // No matching pendingId in localStorage — either unset or pointing at something else.
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'incomplete-scenario', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: false },
      ])

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(fetchAccounts).not.toHaveBeenCalled()
      expect(cloneAccounts).not.toHaveBeenCalled()
      expect(markScenarioClaimComplete).not.toHaveBeenCalled()
    })
  })

  describe('idempotence and failure', () => {
    it('is a no-op on the second call once the server has the claimed data', async () => {
      vi.mocked(createScenario).mockImplementation(async (_u, _n, _d, _c, id) => id!)
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)
      vi.mocked(listScenarios).mockResolvedValueOnce([])

      const first = await claimLocalData('user-1', localState as never)
      const scenarioId = (first as { claimed: true; scenarioId: string }).scenarioId

      vi.mocked(listScenarios).mockResolvedValueOnce([
        { id: scenarioId, name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z', claimComplete: true },
      ])
      const second = await claimLocalData('user-1', localState as never)

      expect(second).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(createScenario).toHaveBeenCalledTimes(1)
    })

    it('propagates a scenario-creation failure so local state is not cleared', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockRejectedValue(new Error('network down'))

      await expect(claimLocalData('user-1', localState as never)).rejects.toThrow('network down')
      expect(migrateExpensesToSession).not.toHaveBeenCalled()
    })

    it('does not fail the claim when there is no local expense data', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockImplementation(async (_u, _n, _d, _c, id) => id!)
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)

      const result = await claimLocalData(
        'user-1', { ...localState, expenseGroups: [], expenses: [] } as never,
      )

      expect(result.claimed).toBe(true)
      expect((result as { claimed: true; scenarioId: string }).scenarioId).toBeTruthy()
    })
  })
})
