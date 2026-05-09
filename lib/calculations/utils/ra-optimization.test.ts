import type { Account } from '@/types'
import { describe, expect, it } from 'vitest'
import { calculateRAOptimization } from './ra-optimization'

const baseRA: Account = {
  id: 'ra-1',
  name: 'My RA',
  type: 'retirement_annuity',
  provider: 'Test',
  currentBalance: 500000,
  monthlyContribution: 5000, // R60k/year
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

const pension: Account = {
  ...baseRA,
  id: 'p-1',
  name: 'Pension Fund',
  type: 'pension_fund',
  monthlyContribution: 3000, // R36k/year
}

const tfsa: Account = {
  ...baseRA,
  id: 'tfsa-1',
  name: 'TFSA',
  type: 'tfsa',
  monthlyContribution: 2000,
}

const discretionary: Account = {
  ...baseRA,
  id: 'd-1',
  name: 'Discretionary',
  type: 'discretionary',
  monthlyContribution: 1000,
}

describe('calculateRAOptimization', () => {
  describe('Deduction limit calculation', () => {
    it('uses 27.5% of income when below R430k cap', () => {
      // R600k income: 27.5% = R165k < R430k, so limit = R165k
      const result = calculateRAOptimization(600000, [])
      expect(result.annualDeductionLimit).toBeCloseTo(165000, 0)
    })

    it('caps at R430k for high earners', () => {
      // R2m income: 27.5% = R550k > R430k, so limit = R430k
      const result = calculateRAOptimization(2000000, [])
      expect(result.annualDeductionLimit).toBe(430000)
    })

    it('returns zero limit for zero income', () => {
      const result = calculateRAOptimization(0, [])
      expect(result.annualDeductionLimit).toBe(0)
      expect(result.annualTaxSaving).toBe(0)
    })
  })

  describe('Current contributions', () => {
    it('sums only RA-type account contributions (excludes TFSA and discretionary)', () => {
      const result = calculateRAOptimization(600000, [baseRA, tfsa, discretionary])
      expect(result.currentMonthlyContributions).toBe(5000)
      expect(result.currentAnnualContributions).toBe(60000)
    })

    it('includes pension_fund and preservation_fund types', () => {
      const preservation: Account = { ...baseRA, id: 'pres-1', type: 'preservation_fund', monthlyContribution: 2000 }
      const result = calculateRAOptimization(600000, [baseRA, pension, preservation])
      expect(result.currentMonthlyContributions).toBe(10000) // 5k + 3k + 2k
      expect(result.currentAnnualContributions).toBe(120000)
    })

    it('returns zero contributions for empty accounts', () => {
      const result = calculateRAOptimization(600000, [])
      expect(result.currentAnnualContributions).toBe(0)
      expect(result.currentMonthlyContributions).toBe(0)
    })
  })

  describe('Remaining room and utilization', () => {
    it('calculates remaining room correctly', () => {
      // Limit R165k, contributing R60k, room = R105k
      const result = calculateRAOptimization(600000, [baseRA])
      expect(result.remainingRoom).toBeCloseTo(105000, 0)
    })

    it('reports zero remaining room when fully utilized', () => {
      const maxContrib: Account = { ...baseRA, monthlyContribution: 165000 / 12 }
      const result = calculateRAOptimization(600000, [maxContrib])
      expect(result.remainingRoom).toBe(0)
      expect(result.isFullyUtilized).toBe(true)
    })

    it('reports isOverLimit when contributions exceed deduction limit', () => {
      const overContrib: Account = { ...baseRA, monthlyContribution: 20000 } // R240k/year > R165k limit
      const result = calculateRAOptimization(600000, [overContrib])
      expect(result.isOverLimit).toBe(true)
      expect(result.remainingRoom).toBe(0)
      expect(result.annualTaxSaving).toBe(0) // Already over limit, no further saving
    })

    it('calculates utilization percentage', () => {
      // R60k of R165k limit = 36.4%
      const result = calculateRAOptimization(600000, [baseRA])
      expect(result.utilizationPct).toBeCloseTo(36.4, 0)
    })

    it('caps utilization at 100% when over limit', () => {
      const overContrib: Account = { ...baseRA, monthlyContribution: 20000 }
      const result = calculateRAOptimization(600000, [overContrib])
      expect(result.utilizationPct).toBe(100)
    })
  })

  describe('Tax saving calculation', () => {
    it('calculates positive tax saving when room exists', () => {
      const result = calculateRAOptimization(600000, [baseRA])
      expect(result.annualTaxSaving).toBeGreaterThan(0)
    })

    it('produces zero tax saving when already at limit', () => {
      const maxContrib: Account = { ...baseRA, monthlyContribution: 165000 / 12 }
      const result = calculateRAOptimization(600000, [maxContrib])
      expect(result.annualTaxSaving).toBe(0)
    })

    it('tax saving is higher for higher-income earners (higher marginal rate)', () => {
      // R600k income: 31% marginal on RA room
      const lowIncome = calculateRAOptimization(600000, [])
      // R1.2m income: 39% marginal on RA room (up to R430k cap)
      const highIncome = calculateRAOptimization(1200000, [])
      // Per-rand saving is higher for high earner (higher marginal rate)
      const lowPerRand = lowIncome.annualTaxSaving / lowIncome.annualDeductionLimit
      const highPerRand = highIncome.annualTaxSaving / highIncome.annualDeductionLimit
      expect(highPerRand).toBeGreaterThan(lowPerRand)
    })

    it('tax saving equals approximately marginal rate × remaining room', () => {
      // R600k income: next bracket is 31% on income between R370.5k–R512.8k
      // R60k contribution, limit R165k, room R105k falls in 31% bracket
      const result = calculateRAOptimization(600000, [baseRA])
      // Rough check: saving should be in range of 25–40% of remaining room
      const impliedRate = result.annualTaxSaving / result.remainingRoom
      expect(impliedRate).toBeGreaterThan(0.25)
      expect(impliedRate).toBeLessThan(0.45)
    })
  })

  describe('Optimal contribution', () => {
    it('optimalMonthlyContribution equals annualDeductionLimit / 12', () => {
      const result = calculateRAOptimization(600000, [baseRA])
      expect(result.optimalMonthlyContribution).toBeCloseTo(result.annualDeductionLimit / 12, 2)
    })
  })
})
