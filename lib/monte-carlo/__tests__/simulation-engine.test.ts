import { afterEach, describe, it, expect, vi } from 'vitest'
import { runMonteCarloSimulation } from '../simulation-engine'
import { calculateIncomeTaxWithRebates, calculateLumpSumCommutation } from '@/lib/calculations/retirement-tax'
import { SA_TAX_LIMITS } from '@/lib/constants/limits'
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, SimulationConfig } from '@/types'

describe('runMonteCarloSimulation', () => {
  // Guarantees no test can leak a mocked Math.random into its successors, even if it
  // fails before reaching its own cleanup.
  afterEach(() => {
    vi.restoreAllMocks()
  })

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
    // Fixed seed: several assertions here compare success rates across configurations,
    // which is only meaningful when the draws are identical.
    randomSeed: 20260726,
  }

  describe('Basic simulation functionality', () => {
    it('should run specified number of simulations', () => {
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 }
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
        { numberOfRuns: 50, randomSeed: 20260726 }
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

  describe('Zero runs handling', () => {
    it('should not divide by zero when numberOfRuns is 0', () => {
      // aggregateResults divided by runs.length unconditionally, so an empty
      // runs array (numberOfRuns: 0, with real accounts present) produced
      // NaN for successRate/averageFinalBalance/averageLifetimeIncomeTax/
      // averageLumpSumTax instead of a safe degenerate result.
      const result = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 0, randomSeed: 20260726 }
      )

      expect(result.runs.length).toBe(0)
      expect(Number.isFinite(result.successRate)).toBe(true)
      expect(result.successRate).toBe(0)
      expect(Number.isFinite(result.averageFinalBalance)).toBe(true)
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
        { numberOfRuns: 100, randomSeed: 20260726 },
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 16, bondVolatility: 8, inflationRate: 5.5 }
      )

      const resultCompound = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100, randomSeed: 20260726 },
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
        { numberOfRuns: 100, randomSeed: 20260726 },
        { compoundingMethod: 'nominal', equityReturn: 12, bondReturn: 8, cashReturn: 6, equityVolatility: 8, bondVolatility: 4, inflationRate: 5.5 }
      )

      const highVolatility = runMonteCarloSimulation(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig,
        { numberOfRuns: 100, randomSeed: 20260726 },
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
        { numberOfRuns: 10, randomSeed: 20260726 }
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
        { numberOfRuns: 20, randomSeed: 20260726 }
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
        { numberOfRuns: 20, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
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
        { numberOfRuns: 100, randomSeed: 20260726 }
      )

      const highIncomeResult = runMonteCarloSimulation(
        [account],
        personalInfo,
        highIncome,
        drawdownConfig,
        { numberOfRuns: 100, randomSeed: 20260726 }
      )

      // Higher desired income should result in lower success rate
      expect(lowIncomeResult.successRate).toBeGreaterThan(highIncomeResult.successRate)
    })
  })

  describe('Account-type-aware lump sum commutation (Monte Carlo)', () => {
    // expectedReturn: 0 makes the per-account return sequence exactly 0 every year
    // (volatility is forced to 0 too), so a single run is fully deterministic.
    const flatAccount = (overrides: Partial<Account>): Account => ({
      id: '1',
      name: 'Flat account',
      provider: 'Test Provider',
      type: 'tfsa',
      currentBalance: 1_000_000,
      monthlyContribution: 0,
      expectedReturn: 0,
      annualFees: 0,
      contributionEscalation: 0,
      ...overrides,
    })

    const zeroWithdrawalDrawdownConfig: DrawdownConfig = {
      strategy: 'fixed_percentage',
      initialWithdrawalRate: 0,
      minimumWithdrawal: 0,
      maximumWithdrawal: 0,
      lumpSumPercentage: 0,
    }

    const zeroIncomeGoals: RetirementGoals = {
      desiredMonthlyIncome: 0,
      inflationRate: 0,
      legacyAmount: 0,
    }

    const flatPersonalInfo: PersonalInfo = {
      currentAge: 64,
      retirementAge: 65,
      lifeExpectancy: 66,
      annualIncome: 0,
    }

    it('does not apply lump sum commutation to a TFSA balance', () => {
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'tfsa' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 30 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      // No pension-type balance exists, so the 30% lump sum request must not reduce
      // the TFSA balance — first post-retirement balance should equal the un-grown,
      // un-withdrawn starting balance.
      expect(result.runs[0].yearlyBalances[flatPersonalInfo.retirementAge - flatPersonalInfo.currentAge]).toBeCloseTo(1_000_000, 5)
    })

    it('does not apply lump sum commutation to a discretionary balance', () => {
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'discretionary' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 30 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      expect(result.runs[0].yearlyBalances[flatPersonalInfo.retirementAge - flatPersonalInfo.currentAge]).toBeCloseTo(1_000_000, 5)
    })

    it('applies lump sum commutation to a pension-type balance', () => {
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'retirement_annuity' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 20 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      // 20% commuted, no growth, no withdrawal -> balance should be exactly 80% of the original
      expect(result.runs[0].yearlyBalances[flatPersonalInfo.retirementAge - flatPersonalInfo.currentAge]).toBeCloseTo(800_000, 5)
    })

    it('clamps lump sum commutation on pension-type balances to one-third', () => {
      const overRequested = runMonteCarloSimulation(
        [flatAccount({ type: 'retirement_annuity' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 90 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      const atCap = runMonteCarloSimulation(
        [flatAccount({ type: 'retirement_annuity' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: SA_TAX_LIMITS.maxLumpSumCommutationPercentage },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      const idx = flatPersonalInfo.retirementAge - flatPersonalInfo.currentAge
      expect(overRequested.runs[0].yearlyBalances[idx]).toBeCloseTo(atCap.runs[0].yearlyBalances[idx], 5)
      expect(overRequested.runs[0].yearlyBalances[idx]).toBeCloseTo(1_000_000 * (1 - 1 / 3), 5)
    })

    it('reports zero lump sum tax when no lump sum is taken', () => {
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'retirement_annuity' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        zeroWithdrawalDrawdownConfig,
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      expect(result.runs[0].lumpSumTax).toBe(0)
      expect(result.averageLumpSumTax).toBe(0)
    })

    it('reports lump sum tax on the commuted pension balance, matching calculateLumpSumCommutation', () => {
      // Large enough that the 20% commuted lump sum exceeds the R550,000 tax-free
      // retirement lump sum threshold, so the expected tax is non-zero.
      const largeBalance = 10_000_000
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'retirement_annuity', currentBalance: largeBalance })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 20 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      // No growth before retirement (expectedReturn: 0), so the pension balance at
      // retirement equals the starting balance.
      const expectedLumpSumTax = calculateLumpSumCommutation(largeBalance, 20).lumpSumTax
      expect(expectedLumpSumTax).toBeGreaterThan(0)
      expect(result.runs[0].lumpSumTax).toBeCloseTo(expectedLumpSumTax, 5)
      expect(result.averageLumpSumTax).toBeCloseTo(expectedLumpSumTax, 5)
    })

    it('does not apply lump sum tax when the lump sum is sourced from a non-pension account', () => {
      const result = runMonteCarloSimulation(
        [flatAccount({ type: 'discretionary' })],
        flatPersonalInfo,
        zeroIncomeGoals,
        { ...zeroWithdrawalDrawdownConfig, lumpSumPercentage: 30 },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      expect(result.runs[0].lumpSumTax).toBe(0)
      expect(result.averageLumpSumTax).toBe(0)
    })
  })

  describe('Income tax and CGT reporting (Monte Carlo)', () => {
    const flatPersonalInfo: PersonalInfo = {
      currentAge: 64,
      retirementAge: 65,
      lifeExpectancy: 66,
      annualIncome: 0,
    }

    it('reports zero average lifetime tax when withdrawals are sourced entirely from a TFSA', () => {
      const account: Account = {
        id: '1',
        name: 'TFSA',
        provider: 'Test Provider',
        type: 'tfsa',
        currentBalance: 1_000_000,
        monthlyContribution: 0,
        expectedReturn: 0,
        annualFees: 0,
        contributionEscalation: 0,
      }

      const result = runMonteCarloSimulation(
        [account],
        flatPersonalInfo,
        { desiredMonthlyIncome: 20000, inflationRate: 0, legacyAmount: 0 },
        {
          strategy: 'fixed_amount_inflation_adjusted',
          initialWithdrawalRate: 0,
          minimumWithdrawal: 0,
          maximumWithdrawal: 0,
          lumpSumPercentage: 0,
        },
        { numberOfRuns: 1, randomSeed: 20260726 }
      )

      expect(result.averageLifetimeIncomeTax).toBe(0)
    })

    it('applies the configured CGT annual exclusion to discretionary capital gains before taxing', () => {
      // expectedReturn !=0 re-enables stochastic volatility, so pin Math.random() to a fixed
      // cycle to make the per-account return sequence (and therefore the realized gain)
      // fully deterministic and reproducible by replicating the engine's own formulas below.
      let callCount = 0
      const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => (callCount++ % 2 === 0 ? 0.5 : 0.25))
      // NOTE: restored via afterEach below as well — an inline mockRestore() at the end
      // of this test is skipped when an assertion throws, which silently leaves
      // Math.random mocked for every test that runs afterwards.

      // Under-65 so only the primary rebate applies (keeps the tax-threshold math simple)
      const personalInfo: PersonalInfo = { currentAge: 49, retirementAge: 50, lifeExpectancy: 51, annualIncome: 0 }

      const currentBalance = 20_000_000
      const expectedReturnPct = 5
      const equityVolatilityPct = 16
      const netReturn = expectedReturnPct / 100
      const vol = equityVolatilityPct / 100
      const logMean = Math.log(1 + netReturn) - (vol * vol) / 2
      const z0 = Math.sqrt(-2 * Math.log(0.5)) * Math.cos(2 * Math.PI * 0.25)
      const r = Math.exp(logMean + vol * z0) - 1

      const balanceAtRetirement = currentBalance * Math.pow(1 + r / 12, 12)
      const balanceAfterDrawdownGrowth = balanceAtRetirement * (1 + r)
      const gainFraction = Math.max(
        0,
        Math.min(1, (balanceAfterDrawdownGrowth - currentBalance) / balanceAfterDrawdownGrowth)
      )

      const account: Account = {
        id: '1',
        name: 'Discretionary',
        provider: 'Test Provider',
        type: 'discretionary',
        currentBalance,
        monthlyContribution: 0,
        expectedReturn: expectedReturnPct,
        annualFees: 0,
        contributionEscalation: 0,
      }

      const marketAssumptions = {
        compoundingMethod: 'nominal' as const,
        equityReturn: expectedReturnPct,
        bondReturn: 8,
        cashReturn: 6,
        equityVolatility: equityVolatilityPct,
        bondVolatility: 8,
        inflationRate: 0,
      }

      const runWithWithdrawal = (take: number) => {
        callCount = 0
        return runMonteCarloSimulation(
          [account],
          personalInfo,
          { desiredMonthlyIncome: take / 12, inflationRate: 0, legacyAmount: 0 },
          {
            strategy: 'fixed_amount_inflation_adjusted',
            initialWithdrawalRate: 0,
            minimumWithdrawal: 0,
            maximumWithdrawal: 0,
            lumpSumPercentage: 0,
          },
          { numberOfRuns: 1 },
          marketAssumptions
        )
      }

      // Below the annual exclusion -> zero CGT, zero tax
      const smallTake = 400_000
      const smallGain = smallTake * gainFraction
      expect(smallGain).toBeLessThan(SA_TAX_LIMITS.cgtAnnualExclusion)
      const smallResult = runWithWithdrawal(smallTake)
      expect(smallResult.averageLifetimeIncomeTax).toBeCloseTo(0, 5)

      // Above the annual exclusion -> only the excess is taxed
      const largeTake = 5_000_000
      const largeGain = largeTake * gainFraction
      expect(largeGain).toBeGreaterThan(SA_TAX_LIMITS.cgtAnnualExclusion)
      const taxableCapitalGain = largeGain - SA_TAX_LIMITS.cgtAnnualExclusion
      const expectedTax = calculateIncomeTaxWithRebates(
        taxableCapitalGain * SA_TAX_LIMITS.cgtInclusionRateIndividual,
        personalInfo.retirementAge
      )
      const largeResult = runWithWithdrawal(largeTake)
      expect(largeResult.averageLifetimeIncomeTax).toBeCloseTo(expectedTax, 0)
      expect(largeResult.averageLifetimeIncomeTax).toBeGreaterThan(0)

      randomSpy.mockRestore()
    })
  })

  describe('Drawdown strategy divergence after year 1', () => {
    // No accumulation phase (currentAge === retirementAge), volatility forced to 0,
    // and a single account isolate the drawdown-year recompute so withdrawals can
    // be hand-verified exactly via the yearlyBalances deltas. desiredMonthlyIncome
    // is chosen so every strategy's year-0 withdrawal is the same R40,000 anchor.
    const personalInfo: PersonalInfo = {
      currentAge: 65,
      retirementAge: 65,
      lifeExpectancy: 67,
      annualIncome: 0,
    }
    const goals: RetirementGoals = {
      desiredMonthlyIncome: (1000000 * 0.04) / 12,
      inflationRate: 5.5,
      legacyAmount: 0,
    }
    const baseConfig: DrawdownConfig = {
      strategy: 'fixed_percentage',
      initialWithdrawalRate: 4,
      minimumWithdrawal: 1,
      maximumWithdrawal: 1_000_000_000,
      lumpSumPercentage: 0,
    }
    const zeroVolatility = {
      compoundingMethod: 'nominal' as const,
      equityReturn: 0,
      bondReturn: 0,
      cashReturn: 0,
      equityVolatility: 0,
      bondVolatility: 0,
      inflationRate: 5.5,
    }

    function run(account: Account, config: DrawdownConfig) {
      return runMonteCarloSimulation([account], personalInfo, goals, config, { numberOfRuns: 1, randomSeed: 20260726 }, zeroVolatility)
    }

    it('a harsh negative return: guardrails cuts withdrawal by 10% when the rate breaches the upper band', () => {
      const account: Account = {
        id: '1',
        name: 'Single RA',
        type: 'retirement_annuity',
        provider: 'Test Provider',
        currentBalance: 1000000,
        monthlyContribution: 0,
        expectedReturn: -50,
        annualFees: 0,
        contributionEscalation: 0,
      }

      const fixedAmountResult = run(account, { ...baseConfig, strategy: 'fixed_amount_inflation_adjusted' })
      const guardrailsResult = run(account, { ...baseConfig, strategy: 'guardrails', upperGuardrail: 20, lowerGuardrail: 20 })

      // Year 0 balance: 1,000,000 * 0.5 - 40,000 = 460,000 (identical for both strategies)
      expect(fixedAmountResult.runs[0].yearlyBalances[0]).toBeCloseTo(460000, 2)
      expect(guardrailsResult.runs[0].yearlyBalances[0]).toBeCloseTo(460000, 2)

      // Year 1: balance grows to 460,000 * 0.5 = 230,000 before withdrawal.
      // fixed_amount_inflation_adjusted: withdrawal = 40,000 * 1.055 = 42,200 -> ending 187,800
      // guardrails: actual rate 40,000/230,000 ≈ 17.4% breaches the 4.8% upper band
      //   -> 10% cut: withdrawal = 36,000 -> ending 194,000 (NOT 187,800)
      expect(fixedAmountResult.runs[0].yearlyBalances[1]).toBeCloseTo(230000 - 42200, 2)
      expect(guardrailsResult.runs[0].yearlyBalances[1]).toBeCloseTo(230000 - 36000, 2)
      expect(guardrailsResult.runs[0].yearlyBalances[1]).not.toBeCloseTo(fixedAmountResult.runs[0].yearlyBalances[1], 2)
    })

    it('a strong positive return: fixed_percentage tracks the live balance, diverging from CPI', () => {
      const account: Account = {
        id: '1',
        name: 'Single RA',
        type: 'retirement_annuity',
        provider: 'Test Provider',
        currentBalance: 1000000,
        monthlyContribution: 0,
        expectedReturn: 11,
        annualFees: 0,
        contributionEscalation: 0,
      }

      const fixedAmountResult = run(account, { ...baseConfig, strategy: 'fixed_amount_inflation_adjusted' })
      const fixedPctResult = run(account, { ...baseConfig, strategy: 'fixed_percentage' })

      // Year 0 balance: 1,000,000 * 1.11 - 40,000 = 1,070,000 (identical for both)
      expect(fixedAmountResult.runs[0].yearlyBalances[0]).toBeCloseTo(1070000, 2)
      expect(fixedPctResult.runs[0].yearlyBalances[0]).toBeCloseTo(1070000, 2)

      // Year 1: balance grows to 1,070,000 * 1.11 = 1,187,700 before withdrawal.
      // fixed_amount_inflation_adjusted: withdrawal = 40,000 * 1.055 = 42,200
      // fixed_percentage: 4% of 1,187,700 = 47,508 (exceeds the desired-income
      //   floor of 42,200, so the live-balance percentage wins) -> diverges
      expect(fixedAmountResult.runs[0].yearlyBalances[1]).toBeCloseTo(1187700 - 42200, 2)
      expect(fixedPctResult.runs[0].yearlyBalances[1]).toBeCloseTo(1187700 - 47508, 2)
      expect(fixedPctResult.runs[0].yearlyBalances[1]).not.toBeCloseTo(fixedAmountResult.runs[0].yearlyBalances[1], 2)
    })
  })
})

describe('Reproducibility via randomSeed', () => {
  const seedAccount: Account = {
    id: '1', name: 'RA', type: 'retirement_annuity', provider: 'P',
    currentBalance: 900000, monthlyContribution: 6000,
    expectedReturn: 11, annualFees: 1.2, contributionEscalation: 6,
  }
  const seedPersonal: PersonalInfo = {
    currentAge: 40, retirementAge: 65, lifeExpectancy: 90, annualIncome: 750000,
  }
  const seedGoals: RetirementGoals = {
    desiredMonthlyIncome: 35000, inflationRate: 5.5, legacyAmount: 0,
  }
  const seedConfig: DrawdownConfig = {
    strategy: 'fixed_percentage', initialWithdrawalRate: 4,
    minimumWithdrawal: 10000, maximumWithdrawal: 200000, lumpSumPercentage: 0,
  }

  const run = (randomSeed?: number) =>
    runMonteCarloSimulation(
      [seedAccount], seedPersonal, seedGoals, seedConfig,
      { numberOfRuns: 100, randomSeed }
    )

  it('produces identical results for the same seed', () => {
    const a = run(4242)
    const b = run(4242)

    expect(a.successRate).toBe(b.successRate)
    expect(a.averageFinalBalance).toBe(b.averageFinalBalance)
    expect(a.medianDepletionAge).toBe(b.medianDepletionAge)
    expect(a.percentiles.p50).toEqual(b.percentiles.p50)
    expect(a.percentiles.p10).toEqual(b.percentiles.p10)
    expect(a.percentiles.p90).toEqual(b.percentiles.p90)
  })

  it('produces different results for a different seed', () => {
    // Guards against the seed being accepted but ignored — which is exactly what
    // happened before: SimulationConfig.randomSeed existed but was never read.
    const a = run(1)
    const b = run(2)
    expect(a.percentiles.p50).not.toEqual(b.percentiles.p50)
  })

  it('remains non-deterministic when no seed is supplied', () => {
    const a = run()
    const b = run()
    expect(a.percentiles.p50).not.toEqual(b.percentiles.p50)
  })

  it('keeps individual runs independent within a seeded simulation', () => {
    // A shared generator must not make every run identical.
    //
    // Asserted on an accumulation-phase balance, NOT finalBalance: depleted runs are
    // clamped to exactly 0 by `Math.max(0, …)`, so they collapse into a single value
    // and finalBalance under-reports variety (63 of 100 runs deplete on this fixture).
    // Year-10 balances are unclamped and therefore measure independence rather than
    // the clamp.
    const result = run(777)
    const atYear10 = new Set(result.runs.map((r) => Math.round(r.yearlyBalances[10])))
    expect(atYear10.size).toBe(result.runs.length)
  })
})
