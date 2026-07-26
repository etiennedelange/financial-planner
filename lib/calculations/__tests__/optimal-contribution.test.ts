import { describe, it, expect } from 'vitest'
import { calculateOptimalContribution } from '../optimal-contribution'
import type { PersonalInfo, RetirementGoals, DrawdownConfig, Account } from '@/types'

describe('calculateOptimalContribution', () => {
  const baseAccount: Account = {
    id: '1',
    name: 'Test RA',
    provider: 'Test Provider',
    type: 'retirement_annuity',
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

  describe('Basic functionality', () => {
    it('should calculate positive contribution for underfunded scenario', () => {
      const result = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      expect(result.optimalMonthlyContribution).toBeGreaterThan(0)
      expect(result.yearsToRetirement).toBe(30)
      expect(result.projectedNestEgg).toBeGreaterThanOrEqual(result.targetNestEgg)
    })

    it('should return zero contribution if already have enough', () => {
      const result = calculateOptimalContribution({
        currentSavings: 10000000, // R10M should be more than enough
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      expect(result.optimalMonthlyContribution).toBe(0)
      expect(result.projectedNestEgg).toBeGreaterThanOrEqual(result.targetNestEgg)
    })

    it('should round contribution up to nearest R100', () => {
      const result = calculateOptimalContribution({
        currentSavings: 50000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      // Should be multiple of R100
      expect(result.optimalMonthlyContribution % 100).toBe(0)
    })
  })

  describe('Compounding methods', () => {
    it('should require higher contribution with compound method', () => {
      const nominal = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      const compound = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'compound',
      })

      // Compound method is more accurate (less overstated returns)
      // So should require slightly higher contribution
      expect(compound.optimalMonthlyContribution).toBeGreaterThanOrEqual(
        nominal.optimalMonthlyContribution
      )
    })
  })

  describe('Target nest egg calculation', () => {
    it('should inflate desired income to retirement date', () => {
      const result = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      // Desired monthly income: R30,000 today
      // Over 30 years at 5.5% inflation: 30,000 * (1.055)^30 ≈ R161,000
      // Annual at retirement: ~R1,932,000
      // Target nest egg at 4% withdrawal: R1,932,000 / 0.04 = R48.3M
      const inflationFactor = Math.pow(1 + baseRetirementGoals.inflationRate / 100, 30)
      const desiredMonthlyAtRetirement =
        baseRetirementGoals.desiredMonthlyIncome * inflationFactor
      const expectedTargetNestEgg =
        (desiredMonthlyAtRetirement * 12) / (baseDrawdownConfig.initialWithdrawalRate / 100)

      expect(result.targetNestEgg).toBeCloseTo(expectedTargetNestEgg, -5) // Within R100k
    })

    it('should use 4% withdrawal rate for target calculation', () => {
      const customDrawdownConfig: DrawdownConfig = {
        ...baseDrawdownConfig,
        initialWithdrawalRate: 3, // 3% withdrawal rate
      }

      const result = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: customDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      // More conservative withdrawal rate should require larger nest egg
      const result4Percent = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: { ...baseDrawdownConfig, initialWithdrawalRate: 4 },
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      expect(result.targetNestEgg).toBeGreaterThan(result4Percent.targetNestEgg)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero years to retirement', () => {
      const customPersonalInfo: PersonalInfo = {
        ...basePersonalInfo,
        currentAge: 65,
        retirementAge: 65, // No years to accumulate
      }

      const result = calculateOptimalContribution({
        currentSavings: 1000000,
        personalInfo: customPersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      expect(result.yearsToRetirement).toBe(0)
      // `currentSavings` is an input, not a field on OptimalContributionResult. The
      // previous assertion read `result.currentSavings || 1000000`, which was always
      // undefined and therefore always compared against the 1000000 fallback.
      expect(result.projectedNestEgg).toBe(1000000)
    })

    it('should handle very high desired income', () => {
      const customRetirementGoals: RetirementGoals = {
        ...baseRetirementGoals,
        desiredMonthlyIncome: 100000, // Very high desired income
      }

      const result = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: customRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      // Should require much higher contributions
      expect(result.optimalMonthlyContribution).toBeGreaterThan(10000)
    })

    it('should handle high fees reducing net return', () => {
      const lowNetReturn = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.05, // High fees: 5%
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      const highNetReturn = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01, // Low fees: 1%
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      // Higher fees should require higher contributions
      expect(lowNetReturn.optimalMonthlyContribution).toBeGreaterThan(
        highNetReturn.optimalMonthlyContribution
      )
    })

    it('should handle zero current savings', () => {
      const result = calculateOptimalContribution({
        currentSavings: 0, // Starting from zero
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: 'nominal',
      })

      expect(result.optimalMonthlyContribution).toBeGreaterThan(0)
      expect(result.projectedNestEgg).toBeGreaterThanOrEqual(result.targetNestEgg)
    })
  })

  describe('Contribution escalation impact', () => {
    it('should require lower contribution with escalation', () => {
      const noEscalation = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0, // No escalation
        compoundingMethod: 'nominal',
      })

      const withEscalation = calculateOptimalContribution({
        currentSavings: 100000,
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.12,
        fees: 0.01,
        contributionEscalation: 0.06, // 6% escalation
        compoundingMethod: 'nominal',
      })

      // Escalation helps reach target, so lower initial contribution needed
      expect(withEscalation.optimalMonthlyContribution).toBeLessThan(
        noEscalation.optimalMonthlyContribution
      )
    })
  })

  describe('SA retirement scenario testing', () => {
    it('should handle typical professional scenario', () => {
      // 45-year-old professional with R500k saved, targeting R25k/month income
      const result = calculateOptimalContribution({
        currentSavings: 500000,
        personalInfo: {
          currentAge: 45,
          retirementAge: 65,
          lifeExpectancy: 90,
          annualIncome: 900000,
        },
        retirementGoals: {
          desiredMonthlyIncome: 25000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.11, // Balanced portfolio
        fees: 0.015,
        contributionEscalation: 0.05,
        compoundingMethod: 'nominal',
      })

      expect(result.yearsToRetirement).toBe(20)
      expect(result.optimalMonthlyContribution).toBeGreaterThan(0)
      expect(result.projectedNestEgg).toBeGreaterThanOrEqual(result.targetNestEgg)
    })

    it('should handle young saver with long horizon', () => {
      // 25-year-old with 40 years to retirement
      const result = calculateOptimalContribution({
        currentSavings: 50000,
        personalInfo: {
          currentAge: 25,
          retirementAge: 65,
          lifeExpectancy: 95,
          annualIncome: 400000,
        },
        retirementGoals: {
          desiredMonthlyIncome: 30000,
          inflationRate: 5.5,
          legacyAmount: 0,
        },
        drawdownConfig: baseDrawdownConfig,
        expectedReturn: 0.10, // Conservative given long time horizon
        fees: 0.01,
        contributionEscalation: 0.03,
        compoundingMethod: 'compound',
      })

      expect(result.yearsToRetirement).toBe(40)
      // Even young savers may need contributions given inflation
      expect(result.optimalMonthlyContribution).toBeGreaterThanOrEqual(0)
    })
  })
})
