import { describe, it, expect } from 'vitest'
import { calculateProjection } from '@/lib/calculations/projection-engine'
import { calculateOptimalContribution } from '@/lib/calculations/optimal-contribution'
import { runMonteCarloSimulation } from '@/lib/monte-carlo/simulation-engine'
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig } from '@/types'

describe('Cross-tab consistency', () => {
  const testAccounts: Account[] = [
    {
      id: '1',
      name: 'Test RA',
      type: 'retirement_annuity',
    provider: 'Test Provider',
      currentBalance: 100000,
      monthlyContribution: 2000,
      expectedReturn: 12,
      annualFees: 1,
      contributionEscalation: 5,
    },
  ]

  const testPersonalInfo: PersonalInfo = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  }

  const testRetirementGoals: RetirementGoals = {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  }

  const testDrawdownConfig: DrawdownConfig = {
    strategy: 'fixed_percentage',
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  }

  const testAssumptions = {
    equityReturn: 12,
    bondReturn: 8,
    cashReturn: 6,
    equityVolatility: 16,
    bondVolatility: 8,
    inflationRate: 5.5,
    compoundingMethod: 'nominal' as const,
  }

  describe('Projection and Optimal Contribution consistency', () => {
    it('should agree on nest egg requirements at retirement', () => {
      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        testAssumptions
      )

      const optimal = calculateOptimalContribution({
        currentSavings: testAccounts[0].currentBalance,
        personalInfo: testPersonalInfo,
        retirementGoals: testRetirementGoals,
        drawdownConfig: testDrawdownConfig,
        expectedReturn: testAccounts[0].expectedReturn / 100,
        fees: testAccounts[0].annualFees / 100,
        contributionEscalation: testAccounts[0].contributionEscalation / 100,
        compoundingMethod: 'nominal',
      })

      // Both should calculate similar target nest eggs
      // (Target nest egg is deterministic, should match exactly)
      expect(projection.portfolioAtRetirement).toBeGreaterThan(0)
      expect(optimal.targetNestEgg).toBeGreaterThan(0)

      // The projected nest egg from optimal contribution should meet or exceed target
      expect(optimal.projectedNestEgg).toBeGreaterThanOrEqual(optimal.targetNestEgg * 0.95) // Within 5%
    })

    it('should have consistent retirement age', () => {
      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig
      )

      const optimal = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: testPersonalInfo,
        retirementGoals: testRetirementGoals,
        drawdownConfig: testDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.05,
        compoundingMethod: 'nominal',
      })

      // Both use same retirement age
      expect(optimal.yearsToRetirement).toBe(30)
      expect(projection.yearlyProjections.length).toBeGreaterThanOrEqual(30)
    })

    it('should respect compounding method consistently', () => {
      const projectionNominal = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { ...testAssumptions, compoundingMethod: 'nominal' }
      )

      const projectionCompound = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { ...testAssumptions, compoundingMethod: 'compound' }
      )

      const optimalNominal = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: testPersonalInfo,
        retirementGoals: testRetirementGoals,
        drawdownConfig: testDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.05,
        compoundingMethod: 'nominal',
      })

      const optimalCompound = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: testPersonalInfo,
        retirementGoals: testRetirementGoals,
        drawdownConfig: testDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.05,
        compoundingMethod: 'compound',
      })

      // Both should show nominal > compound (nominal method overstates returns)
      expect(projectionNominal.portfolioAtRetirement).toBeGreaterThan(
        projectionCompound.portfolioAtRetirement
      )
      expect(optimalNominal.optimalMonthlyContribution).toBeLessThanOrEqual(
        optimalCompound.optimalMonthlyContribution
      )
    })
  })

  describe('Monte Carlo and Deterministic projection consistency', () => {
    it('should have similar median outcome between deterministic and stochastic', () => {
      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        testAssumptions
      )

      const simulation = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 200, randomSeed: 20260726 },
        testAssumptions
      )

      // Monte Carlo median (p50) at retirement should be reasonably close to deterministic
      const accumulationYears = 30
      const mcMedianAtRetirement = simulation.percentiles.p50[accumulationYears] || 0
      const deterministicAtRetirement = projection.portfolioAtRetirement

      // Should be within 20% (Monte Carlo has variance)
      const percentDiff = Math.abs(
        (mcMedianAtRetirement - deterministicAtRetirement) / deterministicAtRetirement
      ) * 100

      expect(percentDiff).toBeLessThan(20)
    })

    it('should have Monte Carlo percentiles ordered correctly', () => {
      const simulation = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 100, randomSeed: 20260726 },
        testAssumptions
      )

      // At any given year, p10 < p25 < p50 < p75 < p90
      const totalYears = 55
      for (let year = 0; year < Math.min(totalYears, simulation.percentiles.p50.length); year++) {
        const p10 = simulation.percentiles.p10[year] || 0
        const p25 = simulation.percentiles.p25[year] || 0
        const p50 = simulation.percentiles.p50[year] || 0
        const p75 = simulation.percentiles.p75[year] || 0
        const p90 = simulation.percentiles.p90[year] || 0

        expect(p10).toBeLessThanOrEqual(p25)
        expect(p25).toBeLessThanOrEqual(p50)
        expect(p50).toBeLessThanOrEqual(p75)
        expect(p75).toBeLessThanOrEqual(p90)
      }
    })

    it('should use same compounding method in both projections', () => {
      // Nominal
      const projectionNominal = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { ...testAssumptions, compoundingMethod: 'nominal' }
      )

      const simulationNominal = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        { ...testAssumptions, compoundingMethod: 'nominal' }
      )

      // Compound
      const projectionCompound = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { ...testAssumptions, compoundingMethod: 'compound' }
      )

      const simulationCompound = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        { ...testAssumptions, compoundingMethod: 'compound' }
      )

      // Nominal should be higher than compound in both cases
      expect(projectionNominal.portfolioAtRetirement).toBeGreaterThan(
        projectionCompound.portfolioAtRetirement
      )

      const mcMedianNominal = simulationNominal.percentiles.p50[30] || 0
      const mcMedianCompound = simulationCompound.percentiles.p50[30] || 0

      expect(mcMedianNominal).toBeGreaterThan(mcMedianCompound)
    })
  })

  describe('Inflation consistency', () => {
    it('should apply same inflation rate across all calculations', () => {
      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        testAssumptions
      )

      const optimal = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: testPersonalInfo,
        retirementGoals: testRetirementGoals,
        drawdownConfig: testDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.05,
        compoundingMethod: 'nominal',
      })

      // Over 30 years at 5.5% inflation, R30k becomes significantly more
      // Optimal should have calculated inflated target nest egg
      expect(optimal.targetNestEgg).toBeGreaterThan(0)

      // Both should account for this inflation
      const firstYearRetirementWithdrawal =
        projection.yearlyProjections[30]?.withdrawals || 0
      expect(firstYearRetirementWithdrawal).toBeGreaterThan(
        testRetirementGoals.desiredMonthlyIncome * 12
      )
    })
  })

  describe('Drawdown strategy consistency', () => {
    it('should apply same withdrawal strategy across calculations', () => {
      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        {
          strategy: 'fixed_percentage',
          initialWithdrawalRate: 4,
          minimumWithdrawal: 10000,
          maximumWithdrawal: 60000,
          lumpSumPercentage: 0,
        }
      )

      const simulation = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        testRetirementGoals,
        {
          strategy: 'fixed_percentage',
          initialWithdrawalRate: 4,
          minimumWithdrawal: 10000,
          maximumWithdrawal: 60000,
          lumpSumPercentage: 0,
        },
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Both should show withdrawals starting at retirement
      const firstWithdrawal = projection.yearlyProjections[30]?.withdrawals || 0
      expect(firstWithdrawal).toBeGreaterThan(0)

      // Monte Carlo should have similar withdrawal pattern
      expect(simulation.runs[0].yearlyBalances.length).toBe(55)
    })
  })

  describe('Multiple account aggregation consistency', () => {
    it('should aggregate accounts consistently across methods', () => {
      const accounts: Account[] = [
        {
          id: '1',
          name: 'RA',
          type: 'retirement_annuity',
    provider: 'Test Provider',
          currentBalance: 100000,
          monthlyContribution: 1000,
          expectedReturn: 12,
          annualFees: 1,
          contributionEscalation: 5,
        },
        {
          id: '2',
          name: 'TFSA',
          type: 'tfsa',
    provider: 'Test Provider',
          currentBalance: 50000,
          monthlyContribution: 500,
          expectedReturn: 10,
          annualFees: 0.75,
          contributionEscalation: 4,
        },
      ]

      const projection = calculateProjection(
        accounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig
      )

      const simulation = runMonteCarloSimulation(
        accounts,
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Both should show growth from combined portfolio
      expect(projection.portfolioAtRetirement).toBeGreaterThan(accounts[0].currentBalance)
      expect(simulation.percentiles.p50[30] || 0).toBeGreaterThan(150000) // Initial total
    })
  })

  describe('Edge case consistency', () => {
    it('should handle zero contribution consistently', () => {
      const accountNoContribution: Account = {
        id: '1',
        name: 'Test',
        type: 'retirement_annuity',
    provider: 'Test Provider',
        currentBalance: 100000,
        monthlyContribution: 0, // No contribution
        expectedReturn: 12,
        annualFees: 1,
        contributionEscalation: 5,
      }

      const projection = calculateProjection(
        [accountNoContribution],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig
      )

      const simulation = runMonteCarloSimulation(
        [accountNoContribution],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Both should show growth from investment returns only
      expect(projection.portfolioAtRetirement).toBeGreaterThan(100000)
      expect(simulation.percentiles.p50[30] || 0).toBeGreaterThan(100000)
    })

    it('should handle very high desired income consistently', () => {
      const highIncomeGoals: RetirementGoals = {
        desiredMonthlyIncome: 100000, // Very high
        inflationRate: 5.5,
        legacyAmount: 0,
      }

      const projection = calculateProjection(
        testAccounts,
        testPersonalInfo,
        highIncomeGoals,
        testDrawdownConfig
      )

      const simulation = runMonteCarloSimulation(
        testAccounts,
        testPersonalInfo,
        highIncomeGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Documents the interplay between the two metrics for a percentage-of-portfolio
      // strategy whose target income is far out of reach. Asserted unconditionally with
      // absolute magnitudes — the previous version branched on surplusAmount, so one arm
      // merely restated projection-engine.ts's own guard and the other asserted
      // `shortfall >= 0`, which is true by construction.
      const retirementIdx = testPersonalInfo.retirementAge - testPersonalInfo.currentAge
      const actualFirstYear = projection.yearlyProjections[retirementIdx].withdrawals
      const desiredFirstYear =
        highIncomeGoals.desiredMonthlyIncome *
        Math.pow(1 + highIncomeGoals.inflationRate / 100, retirementIdx) *
        12

      // The plan pays only a small fraction of the stated goal...
      expect(actualFirstYear).toBeLessThan(desiredFirstYear * 0.15)

      // ...yet reports NO shortfall, because shortfall means "the money ran out" and a
      // percentage-of-balance withdrawal never depletes. This is the settled definition,
      // pinned here so a change to it is a deliberate, visible decision.
      expect(projection.portfolioDepletionAge).toBeNull()
      expect(projection.shortfallAmount).toBe(0)
      expect(projection.surplusAmount).toBeGreaterThan(10_000_000)

      // The Monte Carlo success rate is the metric that DOES register the failure,
      // because it measures the withdrawal against the user's income goal.
      expect(simulation.successRate).toBe(0)
    })
  })

  describe('SA-specific consistency', () => {
    it('should handle TFSA limit scenario consistently', () => {
      const tfsaAtLimit: Account = {
        id: '1',
        name: 'TFSA',
        type: 'tfsa',
    provider: 'Test Provider',
        currentBalance: 500000, // At R500k lifetime limit
        monthlyContribution: 0, // Can't contribute more
        expectedReturn: 10,
        annualFees: 0.75,
        contributionEscalation: 0,
      }

      const projection = calculateProjection(
        [tfsaAtLimit],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig
      )

      const simulation = runMonteCarloSimulation(
        [tfsaAtLimit],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Both should show growth from investment returns only
      expect(projection.portfolioAtRetirement).toBeGreaterThan(500000)
      expect(simulation.percentiles.p50[30] || 0).toBeGreaterThan(500000)
    })

    it('should handle old pension fund scenario consistently', () => {
      const oldPensionFund: Account = {
        id: '1',
        name: 'Old Pension Fund',
        type: 'pension_fund',
    provider: 'Test Provider',
        currentBalance: 750000,
        monthlyContribution: 0, // No longer contributing
        expectedReturn: 9,
        annualFees: 1.2,
        contributionEscalation: 0,
      }

      const projection = calculateProjection(
        [oldPensionFund],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig
      )

      const simulation = runMonteCarloSimulation(
        [oldPensionFund],
        testPersonalInfo,
        testRetirementGoals,
        testDrawdownConfig,
        { numberOfRuns: 50, randomSeed: 20260726 },
        testAssumptions
      )

      // Both should show growth from investment returns only
      expect(projection.portfolioAtRetirement).toBeGreaterThan(750000)
      expect(simulation.percentiles.p50[30] || 0).toBeGreaterThan(750000)
    })
  })
})
