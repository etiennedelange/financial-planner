import { describe, it, expect } from 'vitest'
import {
  calculateIncomeTaxWithRebates,
  calculateMedicalAidTaxCredit,
  isBelowTaxThreshold,
  calculateRetirementTax,
  calculateLumpSumCommutation,
  calculateExcessContributionCredit,
  calculateReplacementRatio,
  calculateLifetimeTaxBurden,
} from './retirement-tax'
import { SA_TAX_LIMITS } from '../constants/limits'

describe('retirement-tax', () => {
  describe('calculateIncomeTaxWithRebates', () => {
    describe('Edge cases', () => {
      it('should return 0 for zero income', () => {
        expect(calculateIncomeTaxWithRebates(0, 60)).toBe(0)
      })

      it('should return 0 for negative income', () => {
        expect(calculateIncomeTaxWithRebates(-1000, 60)).toBe(0)
      })
    })

    describe('Age-based rebates under 65', () => {
      it('should apply primary rebate only for age 60', () => {
        // R240,000 income (falls fully in first bracket: 0 - R245,100 @ 18%)
        // Gross tax: R240,000 × 18% = R43,200
        // Primary rebate: R17,820
        // Net tax: R43,200 - R17,820 = R25,380
        const result = calculateIncomeTaxWithRebates(240000, 60)
        expect(result).toBe(25380)
      })

      it('should return 0 tax for income below threshold (under 65)', () => {
        // R95,750 is below the new R99,000 threshold for under 65
        // Gross tax: R95,750 × 18% = R17,235 < R17,820 rebate → R0
        const result = calculateIncomeTaxWithRebates(95750, 60)
        expect(result).toBe(0)
      })

      it('should return 0 tax for income below threshold', () => {
        const result = calculateIncomeTaxWithRebates(90000, 60)
        expect(result).toBe(0)
      })

      it('should calculate correct tax for R360,000 income (age 60)', () => {
        // Gross tax on R360,000: R73,992
        // Less primary rebate: R17,820
        // Net tax: R56,172
        const grossTax = 44118 + (360000 - 245100) * 0.26
        const netTax = grossTax - SA_TAX_LIMITS.primaryRebate
        expect(calculateIncomeTaxWithRebates(360000, 60)).toBeCloseTo(netTax, 1)
      })
    })

    describe('Age-based rebates 65-74', () => {
      it('should apply primary + secondary rebate for age 65', () => {
        // R240,000 income
        // Gross tax: R43,200
        // Primary + secondary rebate: R17,820 + R9,765 = R27,585
        // Net tax: R43,200 - R27,585 = R15,615
        const result = calculateIncomeTaxWithRebates(240000, 65)
        expect(result).toBe(15615)
      })

      it('should return 0 tax for income at threshold (age 65-74)', () => {
        // R148,217 is below the new R153,250 threshold for age 65-74
        // Gross tax: R148,217 × 18% = R26,679 < R27,585 combined rebate → R0
        const result = calculateIncomeTaxWithRebates(148217, 70)
        expect(result).toBeCloseTo(0, 0)
      })

      it('should calculate correct tax for R360,000 income (age 70)', () => {
        // Gross tax on R360,000: R73,992
        // Less combined rebate: R27,585
        // Net tax: R46,407
        const grossTax = 44118 + (360000 - 245100) * 0.26
        const netTax =
          grossTax -
          (SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate)
        expect(calculateIncomeTaxWithRebates(360000, 70)).toBeCloseTo(
          netTax,
          2
        )
      })
    })

    describe('Age-based rebates 75+', () => {
      it('should apply all three rebates for age 75', () => {
        // R240,000 income
        // Gross tax: R43,200
        // All rebates: R17,820 + R9,765 + R3,249 = R30,834
        // Net tax: R43,200 - R30,834 = R12,366
        const result = calculateIncomeTaxWithRebates(240000, 75)
        expect(result).toBe(12366)
      })

      it('should return 0 tax for income at threshold (age 75+)', () => {
        // R165,689 is below the new R171,300 threshold for age 75+
        const result = calculateIncomeTaxWithRebates(165689, 80)
        expect(result).toBeCloseTo(0, 0)
      })

      it('should calculate correct tax for R360,000 income (age 80)', () => {
        // Gross tax on R360,000: R73,992
        // Less all rebates: R30,834
        // Net tax: R43,158
        const grossTax = 44118 + (360000 - 245100) * 0.26
        const netTax =
          grossTax -
          (SA_TAX_LIMITS.primaryRebate +
            SA_TAX_LIMITS.secondaryRebate +
            SA_TAX_LIMITS.tertiaryRebate)
        expect(calculateIncomeTaxWithRebates(360000, 80)).toBeCloseTo(
          netTax,
          2
        )
      })

      it('should apply all rebates for age 90', () => {
        const result = calculateIncomeTaxWithRebates(240000, 90)
        expect(result).toBe(12366)
      })
    })

    describe('Common retirement income scenarios', () => {
      it('should calculate tax for R20,000/month (R240k p.a.) at age 67', () => {
        // Should benefit from primary + secondary rebate (R27,585)
        const result = calculateIncomeTaxWithRebates(240000, 67)
        expect(result).toBe(15615)
      })

      it('should calculate tax for R30,000/month (R360k p.a.) at age 67', () => {
        const result = calculateIncomeTaxWithRebates(360000, 67)
        const grossTax = 44118 + (360000 - 245100) * 0.26
        const expected =
          grossTax -
          (SA_TAX_LIMITS.primaryRebate + SA_TAX_LIMITS.secondaryRebate)
        expect(result).toBeCloseTo(expected, 1)
      })

      it('should calculate tax for R50,000/month (R600k p.a.) at age 70', () => {
        // Higher bracket income
        const result = calculateIncomeTaxWithRebates(600000, 70)
        // Gross: R150,727, Less rebates: R27,585, Net: R123,142
        expect(result).toBeCloseTo(123142, 0)
      })
    })
  })

  describe('isBelowTaxThreshold', () => {
    it('should return true for income below under-65 threshold', () => {
      expect(isBelowTaxThreshold(90000, 60)).toBe(true)
      expect(isBelowTaxThreshold(95750, 60)).toBe(true)
    })

    it('should return false for income above under-65 threshold', () => {
      expect(isBelowTaxThreshold(100000, 60)).toBe(false)
    })

    it('should return true for income below 65-74 threshold', () => {
      expect(isBelowTaxThreshold(140000, 70)).toBe(true)
      expect(isBelowTaxThreshold(148217, 70)).toBe(true)
    })

    it('should return false for income above 65-74 threshold', () => {
      expect(isBelowTaxThreshold(154000, 70)).toBe(false)
    })

    it('should return true for income below 75+ threshold', () => {
      expect(isBelowTaxThreshold(160000, 80)).toBe(true)
      expect(isBelowTaxThreshold(165689, 80)).toBe(true)
    })

    it('should return false for income above 75+ threshold', () => {
      expect(isBelowTaxThreshold(172000, 80)).toBe(false)
    })
  })

  describe('calculateMedicalAidTaxCredit', () => {
    it('should return R4512 for member only (0 dependants)', () => {
      // R376/month × 12
      expect(calculateMedicalAidTaxCredit(0)).toBe(4512)
    })

    it('should return R9024 for member + 1 dependant', () => {
      // (R376 + R376) × 12
      expect(calculateMedicalAidTaxCredit(1)).toBe(9024)
    })

    it('should return R12072 for member + 2 dependants', () => {
      // (R376 + R376 + R254) × 12
      expect(calculateMedicalAidTaxCredit(2)).toBe(12072)
    })

    it('should return R15120 for member + 3 dependants', () => {
      // (R376 + R376 + R254 + R254) × 12
      expect(calculateMedicalAidTaxCredit(3)).toBe(15120)
    })

    it('should default to 0 dependants when not supplied', () => {
      expect(calculateMedicalAidTaxCredit()).toBe(4512)
    })
  })

  describe('calculateRetirementTax', () => {
    it('should calculate complete tax breakdown for R240k income at age 67', () => {
      const result = calculateRetirementTax(240000, {
        age: 67,
        monthlyMedicalAid: 3500,
      })

      // grossTax = 43200, rebate = 27585, s6A credit (member only) = 4512
      // incomeTax = 43200 - 27585 - 4512 = 11103
      expect(result.grossIncome).toBe(240000)
      expect(result.incomeTax).toBe(11103)
      expect(result.medicalAidTaxCredit).toBe(4512) // R376 × 12
      expect(result.medicalAidContribution).toBe(42000) // R3,500 × 12 (cost paid from income)
      expect(result.netIncome).toBe(240000 - 11103 - 42000)
      expect(result.effectiveTaxRate).toBeCloseTo(4.63, 2)
      expect(result.applicableRebate).toBe(27585)
    })

    it('should handle zero withdrawal', () => {
      const result = calculateRetirementTax(0, { age: 67 })

      expect(result.grossIncome).toBe(0)
      expect(result.incomeTax).toBe(0)
      expect(result.netIncome).toBe(0)
      expect(result.effectiveTaxRate).toBe(0)
    })

    it('should handle retirement without medical aid', () => {
      const result = calculateRetirementTax(240000, { age: 67 })

      expect(result.medicalAidContribution).toBe(0)
      expect(result.netIncome).toBe(240000 - 15615)
    })

    it('should calculate tax for high income (R600k) at age 75', () => {
      const result = calculateRetirementTax(600000, {
        age: 75,
        monthlyMedicalAid: 5000,
      })

      // grossTax = 150727, all rebates = 30834, s6A credit (member only) = 4512
      // incomeTax = 150727 - 30834 - 4512 = 115381
      expect(result.incomeTax).toBeCloseTo(115381, 0)
      expect(result.medicalAidTaxCredit).toBe(4512)
      expect(result.medicalAidContribution).toBe(60000)
      expect(result.netIncome).toBe(600000 - result.incomeTax - 60000)
      expect(result.effectiveTaxRate).toBeCloseTo(19.23, 2)
    })

    it('should return lumpSumTax as 0 for regular withdrawals', () => {
      const result = calculateRetirementTax(240000, { age: 67 })
      expect(result.lumpSumTax).toBe(0)
    })

    it('should apply larger credit for member + 2 dependants', () => {
      // R240k, age 67, 2 dependants: credit = R12,072
      // incomeTax = max(0, 43200 - 27585 - 12072) = 3543
      const result = calculateRetirementTax(240000, {
        age: 67,
        monthlyMedicalAid: 3500,
        medicalAidDependants: 2,
      })
      expect(result.medicalAidTaxCredit).toBe(12072)
      expect(result.incomeTax).toBe(3543)
    })

    it('should produce zero incomeTax when credit exceeds liability', () => {
      // Low income just above threshold; credit wipes out all tax
      const result = calculateRetirementTax(110000, {
        age: 67,
        monthlyMedicalAid: 2000,
        medicalAidDependants: 3,
      })
      expect(result.incomeTax).toBe(0)
    })

    it('should not apply credit when monthlyMedicalAid is not set', () => {
      const withCredit = calculateRetirementTax(240000, { age: 67, monthlyMedicalAid: 1 })
      const without = calculateRetirementTax(240000, { age: 67 })
      expect(without.medicalAidTaxCredit).toBe(0)
      expect(withCredit.incomeTax).toBeLessThan(without.incomeTax)
    })
  })

  describe('calculateLumpSumCommutation', () => {
    it('should handle 0% lump sum', () => {
      const result = calculateLumpSumCommutation(3000000, 0)

      expect(result.lumpSumAmount).toBe(0)
      expect(result.lumpSumTax).toBe(0)
      expect(result.netLumpSum).toBe(0)
      expect(result.remainingPortfolio).toBe(3000000)
    })

    it('should calculate tax for 33.33% lump sum (common one-third)', () => {
      const portfolioValue = 3000000
      const lumpSumPercentage = 33.33

      const result = calculateLumpSumCommutation(
        portfolioValue,
        lumpSumPercentage
      )

      const expectedLumpSum = 3000000 * 0.3333
      expect(result.lumpSumAmount).toBeCloseTo(expectedLumpSum, 0)

      // R999,900 lump sum
      // Previous: R128,700
      // Additional: (R999,900 - R1,100,000) => 0 (below threshold, stays in tier 3)
      // Actually: R999,900 falls in tier 3
      // Previous: R39,600 + (R999,900 - R770,000) × 27% = R39,600 + R62,073 = R101,673
      expect(result.lumpSumTax).toBeCloseTo(101673, 0)
      expect(result.netLumpSum).toBeCloseTo(expectedLumpSum - 101673, 0)
      expect(result.remainingPortfolio).toBeCloseTo(
        3000000 - expectedLumpSum,
        0
      )
    })

    it('should calculate tax for 50% lump sum', () => {
      const portfolioValue = 2400000
      const result = calculateLumpSumCommutation(portfolioValue, 50)

      const expectedLumpSum = 1200000
      expect(result.lumpSumAmount).toBe(expectedLumpSum)

      // R1,200,000 lump sum (tier 4, above R1,155,000)
      // Previous: R143,550
      // Additional: (R1,200,000 - R1,155,000) × 36% = R16,200
      // Total: R159,750
      expect(result.lumpSumTax).toBe(159750)
      expect(result.netLumpSum).toBe(1200000 - 159750)
      expect(result.remainingPortfolio).toBe(1200000)
    })

    it('should handle 100% lump sum (full commutation)', () => {
      const portfolioValue = 1500000
      const result = calculateLumpSumCommutation(portfolioValue, 100)

      expect(result.lumpSumAmount).toBe(1500000)
      expect(result.lumpSumTax).toBe(267750) // Tax on R1.5M
      expect(result.netLumpSum).toBe(1500000 - 267750)
      expect(result.remainingPortfolio).toBe(0)
    })

    it('should cap percentage at 100%', () => {
      const result = calculateLumpSumCommutation(1000000, 150)
      expect(result.lumpSumAmount).toBe(1000000)
    })

    it('should handle negative percentage as 0%', () => {
      const result = calculateLumpSumCommutation(1000000, -10)
      expect(result.lumpSumAmount).toBe(0)
      expect(result.remainingPortfolio).toBe(1000000)
    })

    it('should handle small portfolios (below tax-free threshold)', () => {
      const portfolioValue = 500000
      const result = calculateLumpSumCommutation(portfolioValue, 100)

      expect(result.lumpSumAmount).toBe(500000)
      expect(result.lumpSumTax).toBe(0) // Below R550k threshold
      expect(result.netLumpSum).toBe(500000)
      expect(result.remainingPortfolio).toBe(0)
    })

    describe('with excess contribution credit', () => {
      it('should reduce taxable lump sum by credit when credit < lump sum', () => {
        // R1,200,000 lump sum, R200,000 credit
        // taxableLumpSum = R1,000,000 (tier 3: R39,600 + (R1,000,000 - R770,000) × 27% = R101,700)
        const result = calculateLumpSumCommutation(2400000, 50, 200000)
        expect(result.lumpSumAmount).toBe(1200000)
        expect(result.taxableLumpSum).toBe(1000000)
        expect(result.lumpSumTax).toBe(101700)
        expect(result.netLumpSum).toBe(1200000 - 101700)
        expect(result.creditAppliedToLumpSum).toBe(200000)
        expect(result.creditCarriedIntoDrawdown).toBe(0)
        expect(result.accumulatedExcessCredit).toBe(200000)
      })

      it('should carry excess credit into drawdown when credit > lump sum', () => {
        // R500,000 lump sum (100%), R800,000 credit
        // taxableLumpSum = 0 → tax = 0; R300,000 carried forward
        const result = calculateLumpSumCommutation(500000, 100, 800000)
        expect(result.lumpSumAmount).toBe(500000)
        expect(result.taxableLumpSum).toBe(0)
        expect(result.lumpSumTax).toBe(0)
        expect(result.netLumpSum).toBe(500000)
        expect(result.creditAppliedToLumpSum).toBe(500000)
        expect(result.creditCarriedIntoDrawdown).toBe(300000)
      })

      it('should behave identically to zero credit when credit is 0', () => {
        const withCredit = calculateLumpSumCommutation(2400000, 50, 0)
        const withoutCredit = calculateLumpSumCommutation(2400000, 50)
        expect(withCredit.lumpSumTax).toBe(withoutCredit.lumpSumTax)
        expect(withCredit.taxableLumpSum).toBe(withCredit.lumpSumAmount)
        expect(withCredit.creditAppliedToLumpSum).toBe(0)
        expect(withCredit.creditCarriedIntoDrawdown).toBe(0)
      })

      it('should handle credit exactly equal to lump sum', () => {
        const result = calculateLumpSumCommutation(1000000, 50, 500000)
        expect(result.taxableLumpSum).toBe(0)
        expect(result.lumpSumTax).toBe(0)
        expect(result.creditCarriedIntoDrawdown).toBe(0)
      })

      it('should carry full credit into drawdown when lump sum is 0%', () => {
        const result = calculateLumpSumCommutation(3000000, 0, 400000)
        expect(result.lumpSumAmount).toBe(0)
        expect(result.creditAppliedToLumpSum).toBe(0)
        expect(result.creditCarriedIntoDrawdown).toBe(400000)
      })
    })
  })

  describe('calculateExcessContributionCredit', () => {
    it('should return 0 when contributions are below the 27.5% limit', () => {
      // income R1,200,000 → limit = min(R330,000, R430,000) = R330,000
      // contributions R300,000 < R330,000 → no excess
      expect(calculateExcessContributionCredit(300000, 1200000)).toBe(0)
    })

    it('should return 0 when contributions exactly equal the limit', () => {
      // income R1,200,000 → limit R330,000
      expect(calculateExcessContributionCredit(330000, 1200000)).toBe(0)
    })

    it('should compute correct excess below the R430k cap', () => {
      // income R1,000,000 → limit = R275,000; contributions R500,000 → excess R225,000
      expect(calculateExcessContributionCredit(500000, 1000000)).toBe(225000)
    })

    it('should use the R430k cap when income is high enough', () => {
      // income R2,000,000 → 27.5% = R550,000 but capped at R430,000
      // contributions R500,000 → excess R70,000
      expect(calculateExcessContributionCredit(500000, 2000000)).toBe(70000)
    })

    it('should return full contribution amount when income is zero', () => {
      // limit = min(0, R430,000) = 0 → all contributions are disallowed
      expect(calculateExcessContributionCredit(120000, 0)).toBe(120000)
    })

    it('should return 0 when contributions are zero', () => {
      expect(calculateExcessContributionCredit(0, 1000000)).toBe(0)
    })
  })

  describe('calculateReplacementRatio', () => {
    it('should calculate 100% replacement for equal incomes', () => {
      // Simple gross-to-gross: R300k retirement / R300k pre-retirement = 100%
      const result = calculateReplacementRatio(300000, 300000)
      expect(result).toBe(100)
    })

    it('should calculate 60% replacement ratio', () => {
      // R240k retirement / R400k pre-retirement = 60%
      const result = calculateReplacementRatio(240000, 400000)
      expect(result).toBe(60)
    })

    it('should calculate 52.5% replacement ratio', () => {
      // R262.5k retirement / R500k pre-retirement = 52.5%
      const result = calculateReplacementRatio(262500, 500000)
      expect(result).toBeCloseTo(52.5, 1)
    })

    it('should handle zero pre-retirement income', () => {
      const result = calculateReplacementRatio(200000, 0)
      expect(result).toBe(0)
    })

    it('should handle higher retirement income (>100% replacement)', () => {
      // R400k retirement / R300k pre-retirement = 133.3%
      const result = calculateReplacementRatio(400000, 300000)
      expect(result).toBeCloseTo(133.3, 1)
    })
  })

  describe('calculateLifetimeTaxBurden', () => {
    it('should calculate total tax for constant withdrawals', () => {
      // 30 years of R240k withdrawals, medical aid R3500/month, 0 dependants
      const yearlyWithdrawals = Array(30).fill(240000)
      const result = calculateLifetimeTaxBurden(yearlyWithdrawals, 65, 3500)

      // s6A credit (member only) = R376 × 12 = R4,512/year
      // Ages 65-74 (primary+secondary rebate R27585): grossTax 43200 - 27585 - 4512 = R11,103/year
      // Ages 75-94 (all rebates R30834): grossTax 43200 - 30834 - 4512 = R7,854/year
      const expectedTax = 10 * 11103 + 20 * 7854
      expect(result.totalIncomeTax).toBe(expectedTax)

      expect(result.totalMedicalAid).toBe(30 * 42000) // 30 years × R42k
      expect(result.totalGrossWithdrawals).toBe(30 * 240000)

      const expectedNet = result.totalGrossWithdrawals - expectedTax - 30 * 42000
      expect(result.totalNetIncome).toBe(expectedNet)

      const expectedAvgRate = (expectedTax / (30 * 240000)) * 100
      expect(result.averageEffectiveTaxRate).toBeCloseTo(expectedAvgRate, 2)
    })

    it('should handle zero withdrawals', () => {
      const yearlyWithdrawals = Array(10).fill(0)
      const result = calculateLifetimeTaxBurden(yearlyWithdrawals, 65)

      expect(result.totalIncomeTax).toBe(0)
      expect(result.totalMedicalAid).toBe(0)
      expect(result.totalGrossWithdrawals).toBe(0)
      expect(result.totalNetIncome).toBe(0)
      expect(result.averageEffectiveTaxRate).toBe(0)
    })

    it('should handle varying withdrawals (inflation-adjusted)', () => {
      // Simulate inflation-adjusted withdrawals
      const yearlyWithdrawals = [
        240000, 250000, 260000, 270000, 280000, // Ages 65-69
        290000, 300000, 310000, 320000, 330000, // Ages 70-74
      ]
      const result = calculateLifetimeTaxBurden(yearlyWithdrawals, 65, 4000)

      expect(result.totalIncomeTax).toBeGreaterThan(0)
      expect(result.totalMedicalAid).toBe(10 * 48000) // 10 years × R48k
      expect(result.totalGrossWithdrawals).toBe(
        yearlyWithdrawals.reduce((sum, w) => sum + w, 0)
      )
      expect(result.averageEffectiveTaxRate).toBeGreaterThan(0)
      expect(result.averageEffectiveTaxRate).toBeLessThan(25)
    })

    it('should handle retirement without medical aid', () => {
      const yearlyWithdrawals = Array(20).fill(300000)
      const result = calculateLifetimeTaxBurden(yearlyWithdrawals, 65, 0)

      expect(result.totalMedicalAid).toBe(0)
      expect(result.totalNetIncome).toBe(
        result.totalGrossWithdrawals - result.totalIncomeTax
      )
    })

    it('should show lower average tax rate for ages 75+ (more rebates)', () => {
      // Compare same withdrawals at different ages
      const withdrawals = Array(10).fill(360000)

      const result65 = calculateLifetimeTaxBurden(withdrawals, 65)
      const result75 = calculateLifetimeTaxBurden(withdrawals, 75)

      // Age 75+ should have lower average tax rate due to tertiary rebate
      expect(result75.averageEffectiveTaxRate).toBeLessThan(
        result65.averageEffectiveTaxRate
      )
    })
  })
})
