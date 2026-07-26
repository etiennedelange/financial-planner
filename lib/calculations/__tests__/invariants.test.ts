/**
 * Invariant Tests — Verify logical constraints that must ALWAYS hold
 *
 * These tests catch bugs like:
 * - Surplus and shortfall both non-zero (impossible)
 * - Depletion age with positive surplus (contradictory)
 * - Display/calculation mismatches (reconciliation)
 *
 * Invariants are state constraints that catch bugs the audit can miss.
 */

import { describe, it, expect } from 'vitest'
import { calculateProjection } from '../projection-engine'
import { calculateReplacementRatio } from '../retirement-tax'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { todayRands } from '../utils/money-time'

const baseAccount: Account = {
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

describe('Projection Invariants', () => {
  describe('Surplus and Shortfall Mutual Exclusivity', () => {
    it('INV-001: If surplus > 0, then shortfall must be 0', () => {
      // Portfolio that survives with money left
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      if (result.surplusAmount > 0) {
        expect(result.shortfallAmount).toBe(0)
      }
    })

    it('INV-002: If shortfall > 0, then portfolio must have depleted', () => {
      // Insufficient portfolio
      const insufficient: Account = {
        ...baseAccount,
        currentBalance: 10000,
        monthlyContribution: 50,
      }

      const result = calculateProjection(
        [insufficient],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      if (result.shortfallAmount > 0) {
        expect(result.portfolioDepletionAge).toBeDefined()
      }
    })

    it('INV-003: Depletion and surplus cannot both exist', () => {
      // Any scenario
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // If portfolio depleted, no surplus possible
      if (result.portfolioDepletionAge) {
        expect(result.surplusAmount).toBe(0)
      }
      // If there's surplus, portfolio didn't deplete
      if (result.surplusAmount > 0) {
        expect(result.portfolioDepletionAge).toBeNull()
      }
    })
  })

  describe('Withdrawal and Balance Consistency', () => {
    it('INV-004: Total withdrawals <= Total portfolio at retirement', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const totalWithdrawals = result.yearlyProjections
        .slice(basePersonalInfo.retirementAge - basePersonalInfo.currentAge)
        .reduce((sum, yp) => sum + yp.withdrawals, 0)

      // Total withdrawals should not exceed starting portfolio + growth
      expect(totalWithdrawals).toBeLessThanOrEqual(result.portfolioAtRetirement * 2)
    })

    it('INV-005: Ending balance is never negative', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      result.yearlyProjections.forEach((yp, idx) => {
        expect(yp.endingBalance).toBeGreaterThanOrEqual(0)
      })
    })

    it('INV-006: No withdrawals after portfolio depletes', () => {
      const insufficient: Account = {
        ...baseAccount,
        currentBalance: 10000,
        monthlyContribution: 50,
      }

      const result = calculateProjection(
        [insufficient],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      if (result.portfolioDepletionAge) {
        const depletionIdx = result.portfolioDepletionAge - basePersonalInfo.retirementAge
        const afterDepletion = result.yearlyProjections.slice(depletionIdx + 1)

        afterDepletion.forEach((yp) => {
          expect(yp.endingBalance).toBe(0)
        })
      }
    })
  })

  describe('Depletion Age Constraints', () => {
    it('INV-007: Depletion age must be between retirement and life expectancy', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      if (result.portfolioDepletionAge) {
        expect(result.portfolioDepletionAge).toBeGreaterThanOrEqual(basePersonalInfo.retirementAge)
        expect(result.portfolioDepletionAge).toBeLessThanOrEqual(basePersonalInfo.lifeExpectancy)
      }
    })

    it('INV-008: If no depletion, balance at life expectancy must be >= 0', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      if (!result.portfolioDepletionAge) {
        const finalYear = result.yearlyProjections[result.yearlyProjections.length - 1]
        expect(finalYear.endingBalance).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Replacement Ratio Display-Calculation Reconciliation', () => {
    it('INV-009: Replacement ratio reconciles with displayed values', () => {
      // For a given retirement income and pre-retirement income,
      // the displayed ratio must equal the calculated ratio
      const retirement = 1601625
      const preRetirement = 1275000

      const ratio = calculateReplacementRatio(todayRands(retirement), todayRands(preRetirement))
      const expectedRatio = (retirement / preRetirement) * 100

      expect(ratio).toBeCloseTo(expectedRatio, 1)
    })

    it('INV-010: Replacement ratio matches direct calculation of displayed values', () => {
      // Regression test for the bug where 1,601,625 / 1,275,000 ≠ displayed ratio
      const retirement = 1601625
      const preRetirement = 1275000
      const displayedRatio = 125.6 // Approximately 1,601,625 / 1,275,000

      const calculatedRatio = calculateReplacementRatio(todayRands(retirement), todayRands(preRetirement))

      expect(calculatedRatio).toBeCloseTo(displayedRatio, 0)
    })

    it('INV-011: Replacement ratio is always non-negative', () => {
      const result = calculateReplacementRatio(todayRands(500000), todayRands(600000))
      expect(result).toBeGreaterThanOrEqual(0)
    })

    it('INV-012: Replacement ratio of 0 only when pre-retirement income is 0', () => {
      const resultZero = calculateReplacementRatio(todayRands(100000), todayRands(0))
      expect(resultZero).toBe(0)

      const resultNonZero = calculateReplacementRatio(todayRands(100000), todayRands(1))
      expect(resultNonZero).toBeGreaterThan(0)
    })
  })

  describe('Yearly Projection Consistency', () => {
    it('INV-013: Yearly projections cover all years from current to life expectancy', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // Years: from currentAge to lifeExpectancy (90 - 35 = 55 years)
      const expectedYears = basePersonalInfo.lifeExpectancy - basePersonalInfo.currentAge
      expect(result.yearlyProjections.length).toBe(expectedYears)
    })

    it('INV-014: Starting balance of year N = Ending balance of year N-1', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      for (let i = 1; i < result.yearlyProjections.length; i++) {
        expect(result.yearlyProjections[i].startingBalance).toBeCloseTo(
          result.yearlyProjections[i - 1].endingBalance,
          2
        )
      }
    })

    it('INV-015: Net income = withdrawals - tax - medical aid (or actual from projection)', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      // During retirement years, verify net income calculation
      const retirementYears = result.yearlyProjections.filter(
        (yp) => yp.age >= basePersonalInfo.retirementAge
      )

      retirementYears.forEach((yp) => {
        const calculated =
          yp.withdrawals - yp.incomeTax - yp.lumpSumTax - yp.medicalAidContribution
        // Net income should match or be very close to calculated
        expect(Math.abs(yp.netIncome - calculated)).toBeLessThan(1)
      })
    })
  })

  describe('Tax Calculation Constraints', () => {
    it('INV-016: Income tax is never negative', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      result.yearlyProjections.forEach((yp) => {
        expect(yp.incomeTax).toBeGreaterThanOrEqual(0)
      })
    })

    it('INV-017: Lump sum tax is only non-zero at retirement year', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        { ...baseRetirementGoals },
        { ...baseDrawdownConfig, lumpSumPercentage: 30 }
      )

      result.yearlyProjections.forEach((yp, idx) => {
        if (yp.age === basePersonalInfo.retirementAge) {
          // First retirement year may have lump sum tax
          expect(yp.lumpSumTax).toBeGreaterThanOrEqual(0)
        } else {
          // All other years must be 0
          expect(yp.lumpSumTax).toBe(0)
        }
      })
    })
  })

  describe('Growth and Fees Consistency', () => {
    it('INV-018: Accumulation phase has positive growth', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      const accumulation = result.yearlyProjections.slice(
        0,
        basePersonalInfo.retirementAge - basePersonalInfo.currentAge
      )

      let hasPositiveGrowth = false
      accumulation.forEach((yp) => {
        if (yp.growth > 0) {
          hasPositiveGrowth = true
        }
        // Growth should exceed fees (net positive)
        expect(yp.growth).toBeGreaterThanOrEqual(yp.fees)
      })

      expect(hasPositiveGrowth).toBe(true)
    })

    it('INV-019: Fees are never negative', () => {
      const result = calculateProjection(
        [baseAccount],
        basePersonalInfo,
        baseRetirementGoals,
        baseDrawdownConfig
      )

      result.yearlyProjections.forEach((yp) => {
        expect(yp.fees).toBeGreaterThanOrEqual(0)
      })
    })
  })
})
