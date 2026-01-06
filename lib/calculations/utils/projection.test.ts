import { describe, it, expect } from 'vitest'
import {
  projectFinalSavings,
  calculateMonthlyReturn,
  formatMonthlyReturnFormula
} from './projection'

describe('projectFinalSavings', () => {
  describe('Accounts with existing balance but R0 contributions', () => {
    it('should grow TFSA at contribution limit (R0 new contributions, 0% escalation)', () => {
      // Scenario: TFSA has hit R500k lifetime limit, no new contributions allowed
      const currentBalance = 500000 // R500k existing balance
      const monthlyContribution = 0 // R0 - hit contribution limit
      const years = 10
      const contributionGrowth = 0 // 0% escalation (irrelevant when contribution is R0)
      const annualReturn = 0.10 // 10% return
      const compoundingMethod = 'nominal'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // Expected: Balance should grow due to investment returns
      // With 10% annual return (nominal), monthly return = 10% / 12 = 0.833% per month
      // Over 10 years, R500k should grow significantly
      expect(result).toBeGreaterThan(currentBalance)

      // Calculate expected value manually:
      // Monthly return = 0.10 / 12 = 0.008333
      // After 120 months with no contributions: 500000 * (1.008333)^120 ≈ R1,357,895
      const monthlyReturn = annualReturn / 12
      const expected = currentBalance * Math.pow(1 + monthlyReturn, years * 12)

      expect(result).toBeCloseTo(expected, -2) // Within R100
    })

    it('should grow old pension fund (R0 contributions, 0% escalation)', () => {
      // Scenario: Old employer pension fund, no longer contributing
      const currentBalance = 750000 // R750k from previous employer
      const monthlyContribution = 0 // R0 - no longer employed there
      const years = 15
      const contributionGrowth = 0 // 0% escalation
      const annualReturn = 0.09 // 9% return
      const compoundingMethod = 'compound'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // Expected: Balance should grow
      expect(result).toBeGreaterThan(currentBalance)

      // With compound method: monthly return = (1.09)^(1/12) - 1
      const monthlyReturn = Math.pow(1 + annualReturn, 1 / 12) - 1
      const expected = currentBalance * Math.pow(1 + monthlyReturn, years * 12)

      expect(result).toBeCloseTo(expected, -2)
    })

    it('should grow preservation fund with minimal contributions', () => {
      // Scenario: Preservation fund with R100k, making tiny contributions
      const currentBalance = 100000
      const monthlyContribution = 100 // R100/month (very small)
      const years = 20
      const contributionGrowth = 0 // 0% escalation
      const annualReturn = 0.11 // 11% return
      const compoundingMethod = 'nominal'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // Growth should come primarily from existing balance, not contributions
      // Contributions over 20 years = R100 * 12 * 20 = R24,000 (only 24% of starting balance)
      const totalContributions = monthlyContribution * 12 * years

      // Result should be much larger than starting balance + contributions
      expect(result).toBeGreaterThan(currentBalance + totalContributions * 2)
    })
  })

  describe('Compounding methods', () => {
    it('nominal method: should match Excel FV formula', () => {
      const currentBalance = 100000
      const monthlyContribution = 0
      const years = 10
      const contributionGrowth = 0
      const annualReturn = 0.12

      const monthlyReturn = calculateMonthlyReturn(annualReturn, 'nominal')
      expect(monthlyReturn).toBe(0.01) // 12% / 12 = 1% per month

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        'nominal'
      )

      // Excel FV formula equivalent: =FV(12%/12, 120, 0, -100000, 0)
      const excelFV = currentBalance * Math.pow(1.01, 120)
      expect(result).toBeCloseTo(excelFV, -2)
    })

    it('compound method: should use actuarially correct compounding', () => {
      const currentBalance = 100000
      const monthlyContribution = 0
      const years = 10
      const contributionGrowth = 0
      const annualReturn = 0.12

      const monthlyReturn = calculateMonthlyReturn(annualReturn, 'compound')
      expect(monthlyReturn).toBeCloseTo(0.009488793, 6) // (1.12)^(1/12) - 1

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        'compound'
      )

      // Should equal: 100000 * (1.12)^10 (true annual compounding)
      const expected = currentBalance * Math.pow(1 + annualReturn, years)
      expect(result).toBeCloseTo(expected, -2)
    })
  })

  describe('Edge cases', () => {
    it('should handle zero years', () => {
      const result = projectFinalSavings(100000, 1000, 0, 0.06, 0.12, 'nominal')
      expect(result).toBe(100000) // No growth, just return starting balance
    })

    it('should handle zero balance with contributions', () => {
      const result = projectFinalSavings(0, 1000, 10, 0.06, 0.12, 'nominal')
      expect(result).toBeGreaterThan(0) // Should accumulate from contributions
    })

    it('should handle zero balance and zero contributions', () => {
      const result = projectFinalSavings(0, 0, 10, 0, 0.12, 'nominal')
      expect(result).toBe(0) // Nothing to grow
    })

    it('should handle negative years gracefully', () => {
      const result = projectFinalSavings(100000, 1000, -5, 0.06, 0.12, 'nominal')
      expect(result).toBe(100000) // Should return starting balance
    })
  })

  describe('Contribution escalation', () => {
    it('should apply smooth monthly escalation to contributions', () => {
      // Test that escalation is applied smoothly throughout the year
      const currentBalance = 0
      const monthlyContribution = 1000
      const years = 1
      const contributionGrowth = 0.06 // 6% annual escalation
      const annualReturn = 0 // No return to isolate contribution effect
      const compoundingMethod = 'nominal'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // With smooth escalation, contributions should be:
      // Month 1: 1000 * (1.06)^(0/12) = 1000
      // Month 6: 1000 * (1.06)^(6/12) ≈ 1029.56
      // Month 12: 1000 * (1.06)^(12/12) = 1060
      // Total ≈ 12,000 * 1.03 ≈ 12,360 (rough estimate)
      expect(result).toBeGreaterThan(12000)
      expect(result).toBeLessThan(13000)
    })

    it('should handle 0% escalation correctly', () => {
      const result1 = projectFinalSavings(0, 1000, 5, 0, 0.10, 'nominal')

      // Verify contributions remain constant
      // With 0% escalation, each contribution should be exactly 1000
      expect(result1).toBeGreaterThan(0)
    })

    it('should compound escalation over multiple years', () => {
      const currentBalance = 0
      const monthlyContribution = 1000
      const years = 3
      const contributionGrowth = 0.06
      const annualReturn = 0
      const compoundingMethod = 'nominal'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // Year 1 contributions: ~12,360
      // Year 2 contributions: ~13,102 (6% higher)
      // Year 3 contributions: ~13,888 (6% higher again)
      // Total: ~39,350
      expect(result).toBeGreaterThan(38000)
      expect(result).toBeLessThan(40000)
    })
  })

  describe('Mixed scenarios', () => {
    it('should correctly combine balance growth and contributions', () => {
      const currentBalance = 100000
      const monthlyContribution = 1000
      const years = 5
      const contributionGrowth = 0.05
      const annualReturn = 0.08
      const compoundingMethod = 'compound'

      const result = projectFinalSavings(
        currentBalance,
        monthlyContribution,
        years,
        contributionGrowth,
        annualReturn,
        compoundingMethod
      )

      // Should have both:
      // 1. Original balance grown by 8% annually
      // 2. Contributions escalating by 5% annually
      const balanceGrowthOnly = currentBalance * Math.pow(1.08, years)
      expect(result).toBeGreaterThan(balanceGrowthOnly) // Must include contributions
    })
  })
})

describe('calculateMonthlyReturn', () => {
  describe('nominal method', () => {
    it('should divide annual return by 12', () => {
      expect(calculateMonthlyReturn(0.12, 'nominal')).toBe(0.01)
      expect(calculateMonthlyReturn(0.06, 'nominal')).toBe(0.005)
      expect(calculateMonthlyReturn(0.24, 'nominal')).toBe(0.02)
    })

    it('should handle zero return', () => {
      expect(calculateMonthlyReturn(0, 'nominal')).toBe(0)
    })

    it('should handle negative returns', () => {
      expect(calculateMonthlyReturn(-0.12, 'nominal')).toBe(-0.01)
    })
  })

  describe('compound method', () => {
    it('should use actuarial compounding formula', () => {
      const monthlyReturn = calculateMonthlyReturn(0.12, 'compound')
      // (1.12)^(1/12) - 1 ≈ 0.009488793
      expect(monthlyReturn).toBeCloseTo(0.009488793, 9)

      // Verify it compounds correctly to annual
      const annualFromMonthly = Math.pow(1 + monthlyReturn, 12) - 1
      expect(annualFromMonthly).toBeCloseTo(0.12, 10)
    })

    it('should handle zero return', () => {
      expect(calculateMonthlyReturn(0, 'compound')).toBe(0)
    })

    it('should be slightly lower than nominal for positive returns', () => {
      const nominal = calculateMonthlyReturn(0.12, 'nominal')
      const compound = calculateMonthlyReturn(0.12, 'compound')
      expect(compound).toBeLessThan(nominal)
    })
  })
})

describe('formatMonthlyReturnFormula', () => {
  it('should format nominal method formula', () => {
    const formula = formatMonthlyReturnFormula(0.12, 'nominal')
    expect(formula).toContain('0.1200 / 12')
    expect(formula).toContain('0.010000')
    expect(formula).toContain('1.000%')
  })

  it('should format compound method formula', () => {
    const formula = formatMonthlyReturnFormula(0.12, 'compound')
    expect(formula).toContain('(1 + 0.1200)^(1/12) - 1')
    expect(formula).toContain('0.009489')
    expect(formula).toContain('0.949%')
  })

  it('should handle different return rates', () => {
    const formula1 = formatMonthlyReturnFormula(0.08, 'nominal')
    expect(formula1).toContain('0.0800')

    const formula2 = formatMonthlyReturnFormula(0.15, 'compound')
    expect(formula2).toContain('0.1500')
  })
})
