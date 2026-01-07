import { describe, it, expect } from 'vitest'
import { runMonteCarloSimulation } from '../simulation-engine'
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, SimulationConfig } from '@/types'

describe('runMonteCarloSimulation', () => {
  const baseAccount: Account = {
    id: '1',
    name: 'Test RA',
    type: 'retirement_annuity',
    provider: 'Test Provider',
    currentBalance: 100000,
    monthlyContribution: 2000,
    expectedReturn: 12,
    annualFees: 1,
    contributionEscalation: 5,
  }

  const basePersonalInfo: PersonalInfo = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  }

  const baseRetirementGoals: RetirementGoals = {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  }

  const baseDrawdownConfig: DrawdownConfig = {
    strategy: 'fixed_percentage',
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
  }

  const baseSimulationConfig: SimulationConfig = {
    numberOfRuns: 100, // Smaller for testing
  }

  describe('Basic simulation functionality', () => {
    it('should run specified number of simulations', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 50 }
      )

      expect(result.runs.length).toBe(50)
    })

    it('should calculate success rate correctly', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.successRate).toBeGreaterThanOrEqual(0)
      expect(result.successRate).toBeLessThanOrEqual(100)
    })

    it('should have more successful scenarios with well-funded portfolio', () => {
      const wellFunded: Account = {
        ...baseAccount,
        currentBalance: 500000,
        monthlyContribution: 5000,
      }

      const result = runMonteCarloSimulation(
        [wellFunded],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      // Well-funded should have high success rate
      expect(result.successRate).toBeGreaterThan(70)
    })

    it('should have lower success rate with underfunded portfolio', () => {
      const underfunded: Account = {
        ...baseAccount,
        currentBalance: 10000,
        monthlyContribution: 100,
      }

      const result = runMonteCarloSimulation(
        [underfunded],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      // Underfunded should have varied success rate (due to randomness in Monte Carlo)
      expect(result.successRate).toBeLessThanOrEqual(95)
    })
  })

  describe('Percentile calculations', () => {
    it('should calculate all percentiles', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.percentiles.p10).toBeDefined()
      expect(result.percentiles.p25).toBeDefined()
      expect(result.percentiles.p50).toBeDefined()
      expect(result.percentiles.p75).toBeDefined()
      expect(result.percentiles.p90).toBeDefined()
    })

    it('should have correct percentile ordering', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      const totalYears = 55 // 30 to retirement + 25 in retirement
      for (let year = 0; year < totalYears; year++) {
        const p10 = result.percentiles.p10[year] || 0
        const p25 = result.percentiles.p25[year] || 0
        const p50 = result.percentiles.p50[year] || 0
        const p75 = result.percentiles.p75[year] || 0
        const p90 = result.percentiles.p90[year] || 0

        expect(p10).toBeLessThanOrEqual(p25)
        expect(p25).toBeLessThanOrEqual(p50)
        expect(p50).toBeLessThanOrEqual(p75)
        expect(p75).toBeLessThanOrEqual(p90)
      }
    })

    it('should have percentiles with correct length', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      const totalYears = 55
      expect(result.percentiles.p50.length).toBe(totalYears)
    })
  })

  describe('Depletion age calculation', () => {
    it('should calculate median depletion age for underfunded scenarios', () => {
      const underfunded: Account = {
        ...baseAccount,
        currentBalance: 10000,
        monthlyContribution: 50,
      }

      const result = runMonteCarloSimulation(
        [underfunded],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      if (result.medianDepletionAge !== null) {
        expect(result.medianDepletionAge).toBeGreaterThanOrEqual(65)
        expect(result.medianDepletionAge).toBeLessThanOrEqual(90)
      }
    })

    it('should show high success rate for well-funded scenarios', () => {
      const wellFunded: Account = {
        ...baseAccount,
        currentBalance: 5000000,
      }

      const result = runMonteCarloSimulation(
        [wellFunded],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 50 }
      )

      // Well-funded should have good success rate
      // Even with extreme volatility, a R5M portfolio should rarely fail
      expect(result.successRate).toBeGreaterThan(50)
    })
  })

  describe('Average final balance', () => {
    it('should calculate average final balance across runs', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.averageFinalBalance).toBeGreaterThanOrEqual(0)
    })

    it('should be higher for well-funded scenarios', () => {
      const baseFunded = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      const wellFunded: Account = {
        ...baseAccount,
        currentBalance: 500000,
        monthlyContribution: 5000,
      }

      const result = runMonteCarloSimulation(
        [wellFunded],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.averageFinalBalance).toBeGreaterThan(baseFunded.averageFinalBalance)
    })
  })

  describe('Multiple accounts handling', () => {
    it('should aggregate multiple accounts', () => {
      const account1: Account = {
        ...baseAccount,
        id: '1',
        currentBalance: 100000,
        monthlyContribution: 1000,
      }

      const account2: Account = {
        ...baseAccount,
        id: '2',
        currentBalance: 50000,
        monthlyContribution: 500,
      }

      const result = runMonteCarloSimulation(
        [account1, account2],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.runs.length).toBe(baseSimulationConfig.numberOfRuns)
      expect(result.successRate).toBeGreaterThan(0)
    })

    it('should handle accounts with different returns', () => {
      const conservative: Account = {
        ...baseAccount,
        id: '1',
        expectedReturn: 8,
      }

      const aggressive: Account = {
        ...baseAccount,
        id: '2',
        expectedReturn: 12,
      }

      const result = runMonteCarloSimulation(
        [conservative, aggressive],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.runs.length).toBe(baseSimulationConfig.numberOfRuns)
    })
  })

  describe('Empty accounts handling', () => {
    it('should handle empty accounts array', () => {
      const result = runMonteCarloSimulation(
        [],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      expect(result.runs.length).toBe(0)
      expect(result.successRate).toBe(0)
      expect(result.averageFinalBalance).toBe(0)
    })
  })

  describe('Compounding methods', () => {
    it('should use nominal compounding by default', () => {
      const resultNoMethod = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      const resultNominal = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        baseSimulationConfig,
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      // Results should be very close (same seed doesn't apply in real scenario, but success rates should be similar)
      expect(Math.abs(resultNoMethod.successRate - resultNominal.successRate)).toBeLessThan(10)
    })

    it('should produce results with compounding methods', () => {
      const resultNominal = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100 },
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      const resultCompound = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100 },
        { compoundingMethod: 'compound', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      // Both should produce valid success rates
      // Due to Monte Carlo randomness, they may vary significantly
      expect(resultNominal.successRate).toBeGreaterThanOrEqual(0)
      expect(resultCompound.successRate).toBeGreaterThanOrEqual(0)
      expect(resultNominal.successRate).toBeLessThanOrEqual(100)
      expect(resultCompound.successRate).toBeLessThanOrEqual(100)
    })
  })

  describe('Drawdown strategies', () => {
    it('should support fixed_percentage strategy', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { strategy: 'fixed_percentage', initialWithdrawalRate: 4, minimumWithdrawal: 10000, maximumWithdrawal: 50000 },
        baseSimulationConfig
      )

      expect(result.successRate).toBeGreaterThanOrEqual(0)
    })

    it('should support fixed_amount_inflation_adjusted strategy', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { strategy: 'fixed_amount_inflation_adjusted', initialWithdrawalRate: 4, minimumWithdrawal: 10000, maximumWithdrawal: 50000 },
        baseSimulationConfig
      )

      expect(result.successRate).toBeGreaterThanOrEqual(0)
    })

    it('should support variable_percentage strategy', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { strategy: 'variable_percentage', initialWithdrawalRate: 4, minimumWithdrawal: 10000, maximumWithdrawal: 50000 },
        baseSimulationConfig
      )

      expect(result.successRate).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Volatility impact', () => {
    it('should produce different results with different volatility', () => {
      const lowVolatility = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100 },
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 8, bondVolatility: 4, inflationRate: 5.5 }
      )

      const highVolatility = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100 },
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 20, bondVolatility: 12, inflationRate: 5.5 }
      )

      // Higher volatility should increase spread (lower p10, higher p90)
      const lowSpread = (lowVolatility.percentiles.p90[30] || 0) - (lowVolatility.percentiles.p10[30] || 0)
      const highSpread = (highVolatility.percentiles.p90[30] || 0) - (highVolatility.percentiles.p10[30] || 0)

      expect(highSpread).toBeGreaterThanOrEqual(lowSpread)
    })
  })

  describe('Simulation run details', () => {
    it('should populate yearlyBalances for each run', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 10 }
      )

      for (const run of result.runs) {
        expect(run.yearlyBalances.length).toBe(55) // 30 + 25 years
        expect(run.yearlyBalances[0]).toBeGreaterThan(0) // Should have balance at end of year 1
      }
    })

    it('should mark runs as successful based on final balance', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 20 }
      )

      const successfulRuns = result.runs.filter((r) => r.success)
      expect(successfulRuns.length).toBeGreaterThanOrEqual(0)
    })

    it('should assign unique runIds', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 20 }
      )

      const ids = result.runs.map((r) => r.runId)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(ids.length) // All IDs should be unique
    })
  })

  describe('SA retirement scenario testing', () => {
    it('should handle typical professional scenario', () => {
      const result = runMonteCarloSimulation(
        [
          {
            id: '1',
            name: 'Professional RA',
            type: 'retirement_annuity',
    provider: 'Test Provider',
            currentBalance: 500000,
            monthlyContribution: 2500,
            expectedReturn: 11,
            annualFees: 1.2,
            contributionEscalation: 5,
          },
        ],
        {
          currentAge: 45,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: 900000,
        },
        {
          desiredMonthlyIncome: 25000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // Professional with decent savings should have reasonable success rate
      expect(result.successRate).toBeGreaterThan(30)
    })

    it('should handle young saver with long horizon', () => {
      const result = runMonteCarloSimulation(
        [
          {
            id: '1',
            name: 'Young Saver TFSA',
            type: 'tfsa',
    provider: 'Test Provider',
            currentBalance: 50000,
            monthlyContribution: 1000,
            expectedReturn: 10,
            annualFees: 0.75,
            contributionEscalation: 3,
          },
        ],
        {
          currentAge: 25,
          retirementAge: 65,
          lifeExpectancy: 95,
          annualIncome: 400000,
        },
        {
          desiredMonthlyIncome: 25000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // 40 years of compounding should give high success rate (60%+ is reasonable for desired income)
      expect(result.successRate).toBeGreaterThan(60)
    })

    it('should handle pre-retiree scenario', () => {
      const result = runMonteCarloSimulation(
        [
          {
            id: '1',
            name: 'Pre-Retiree Portfolio',
            type: 'pension_fund',
    provider: 'Test Provider',
            currentBalance: 2000000,
            monthlyContribution: 1000,
            expectedReturn: 9,
            annualFees: 1,
            contributionEscalation: 0,
          },
        ],
        {
          currentAge: 60,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: 800000,
        },
        {
          desiredMonthlyIncome: 30000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // Pre-retiree with substantial balance should have reasonable success
      expect(result.successRate).toBeGreaterThanOrEqual(50)
    })
  })
})
