import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./scenarios', () => ({
  listScenarios: vi.fn(),
  createScenario: vi.fn(),
}))
vi.mock('./accounts', () => ({ cloneAccounts: vi.fn() }))
vi.mock('./expenses', () => ({ migrateExpensesToSession: vi.fn() }))

import { listScenarios, createScenario } from './scenarios'
import { cloneAccounts } from './accounts'
import { migrateExpensesToSession } from './expenses'
import { claimLocalData } from './claim'

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

beforeEach(() => vi.clearAllMocks())

describe('claimLocalData', () => {
  describe('server has no data', () => {
    it('migrates local state up and reports the new scenario', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: true, scenarioId: 'scenario-new' })
      expect(createScenario).toHaveBeenCalledWith('user-1', 'My Plan', expect.objectContaining({
        personalInfo: localState.personalInfo,
      }))
      expect(cloneAccounts).toHaveBeenCalledWith(localState.accounts, 'scenario-new')
      expect(migrateExpensesToSession).toHaveBeenCalledWith(
        'user-1', localState.expenseGroups, localState.expenses,
      )
    })
  })

  describe('server already has data', () => {
    it('does not write anything and reports server-has-data', async () => {
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'existing', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z' },
      ])

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(createScenario).not.toHaveBeenCalled()
      expect(cloneAccounts).not.toHaveBeenCalled()
      expect(migrateExpensesToSession).not.toHaveBeenCalled()
    })
  })

  describe('idempotence and failure', () => {
    it('is a no-op on the second call once the server has the claimed data', async () => {
      vi.mocked(listScenarios).mockResolvedValueOnce([]).mockResolvedValueOnce([
        { id: 'scenario-new', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z' },
      ])
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)

      await claimLocalData('user-1', localState as never)
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
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)

      const result = await claimLocalData(
        'user-1', { ...localState, expenseGroups: [], expenses: [] } as never,
      )

      expect(result).toEqual({ claimed: true, scenarioId: 'scenario-new' })
    })
  })
})
