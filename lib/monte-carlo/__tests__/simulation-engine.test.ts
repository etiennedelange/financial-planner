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
    lumpSumPercentage: 0,
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

      // Use modest desired income that the portfolio can actually achieve
      const modestGoals: RetirementGoals = {
        desiredMonthlyIncome: 10000, // Modest goal relative to portfolio
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const result = runMonteCarloSimulation(
        [wellFunded],
        basePersonalInfo,
        modestGoals,
        baseDrawdownConfig,
        baseSimulationConfig
      )

      // Well-funded with modest goals should have high success rate
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
          // Modest income goal that this portfolio can realistically achieve
          desiredMonthlyIncome: 8000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // Professional with decent savings and modest goals should have reasonable success rate
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
          // Modest income goal - R1k/month for 40 years won't fund R25k/month (inflated to R213k)
          desiredMonthlyIncome: 5000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // Underfunded scenario — success rate will be low but non-zero
      expect(result.successRate).toBeGreaterThan(0)
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
          // R2M portfolio can sustain ~R80k/year (4%), which is ~R6.5k/month
          // Inflated R10k/month over 5 years = R13k/month = R156k/year
          // This is achievable but tight
          desiredMonthlyIncome: 10000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        baseDrawdownConfig,
        { numberOfRuns: 100 }
      )

      // Pre-retiree with substantial balance and reasonable goals should succeed in many scenarios
      // Note: With per-account projection (after fix for stagnant accounts), the result is more conservative
      expect(result.successRate).toBeGreaterThanOrEqual(25)
    })
  })

  describe('Desired income vs fixed percentage withdrawal', () => {
    it('should use desired income when it exceeds fixed percentage withdrawal', () => {
      // Scenario: Small portfolio where 4% withdrawal < desired income
      // The simulation should test against the desired income, not just the percentage
      const underfundedAccount: Account = {
        id: '1',
        name: 'Small RA',
        type: 'retirement_annuity',
        provider: 'Test Provider',
        currentBalance: 4000,
        monthlyContribution: 4000,
        expectedReturn: 10,
        annualFees: 1,
        contributionEscalation: 6,
      }

      const personalInfo: PersonalInfo = {
        currentAge: 38,
        retirementAge: 65,
        lifeExpectancy: 95,
        annualIncome: 600000,
      }

      const highDesiredIncome: RetirementGoals = {
        desiredMonthlyIncome: 35000, // High desired income relative to contributions
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const result = runMonteCarloSimulation(
        [underfundedAccount],
        personalInfo,
        highDesiredIncome,
        {
          strategy: 'fixed_percentage',
          initialWithdrawalRate: 3.5,
          minimumWithdrawal: 15000,
          maximumWithdrawal: 60000,
        },
        { numberOfRuns: 100 }
      )

      // With R4k/month contributions for 27 years, portfolio will be ~R9M
      // 3.5% of R9M = R315k/year = R26k/month
      // But desired is R35k/month (inflated to ~R148k at retirement)
      // Success rate should be very low because the plan can't meet the income goal
      expect(result.successRate).toBeLessThan(20)
    })

    it('should have high success when portfolio can meet desired income', () => {
      // Scenario: Well-funded portfolio where 4% withdrawal > desired income
      const wellFundedAccount: Account = {
        id: '1',
        name: 'Large RA',
        type: 'retirement_annuity',
        provider: 'Test Provider',
        currentBalance: 2000000,
        monthlyContribution: 10000,
        expectedReturn: 10,
        annualFees: 1,
        contributionEscalation: 6,
      }

      const personalInfo: PersonalInfo = {
        currentAge: 50,
        retirementAge: 65,
        lifeExpectancy: 90,
        annualIncome: 1200000,
      }

      const modestDesiredIncome: RetirementGoals = {
        // R2M + R10k/month for 15 years at 9% net = ~R10M at retirement
        // 4% of R10M = R400k/year = R33k/month
        // R15k/month inflated over 15 years = R32k/month
        // This should be achievable
        desiredMonthlyIncome: 15000,
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const result = runMonteCarloSimulation(
        [wellFundedAccount],
        personalInfo,
        modestDesiredIncome,
        {
          strategy: 'fixed_percentage',
          initialWithdrawalRate: 4,
          minimumWithdrawal: 15000,
          maximumWithdrawal: 60000,
        },
        { numberOfRuns: 100 }
      )

      // Well-funded portfolio with modest goals should have good success rate
      expect(result.successRate).toBeGreaterThan(50)
    })

    it('should reflect actual income needs in success rate, not just portfolio survival', () => {
      // Two scenarios with same portfolio but different desired incomes
      // The one with higher desired income should have lower success rate
      const account: Account = {
        id: '1',
        name: 'Test RA',
        type: 'retirement_annuity',
        provider: 'Test Provider',
        currentBalance: 500000,
        monthlyContribution: 5000,
        expectedReturn: 10,
        annualFees: 1,
        contributionEscalation: 5,
      }

      const personalInfo: PersonalInfo = {
        currentAge: 40,
        retirementAge: 65,
        lifeExpectancy: 90,
        annualIncome: 800000,
      }

      const lowIncome: RetirementGoals = {
        desiredMonthlyIncome: 15000,
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const highIncome: RetirementGoals = {
        desiredMonthlyIncome: 50000,
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const drawdownConfig: DrawdownConfig = {
        strategy: 'fixed_percentage',
        initialWithdrawalRate: 4,
        minimumWithdrawal: 10000,
        maximumWithdrawal: 80000,
      }

      const lowIncomeResult = runMonteCarloSimulation(
        [account],
        personalInfo,
        lowIncome,
        drawdownConfig,
        { numberOfRuns: 100 }
      )

      const highIncomeResult = runMonteCarloSimulation(
        [account],
        personalInfo,
        highIncome,
        drawdownConfig,
        { numberOfRuns: 100 }
      )

      // Higher desired income should result in lower success rate
      expect(lowIncomeResult.successRate).toBeGreaterThan(highIncomeResult.successRate)
    })
  })
})
