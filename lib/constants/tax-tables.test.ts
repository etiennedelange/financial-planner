import { describe, it, expect } from 'vitest'
import {
  calculateIncomeTax,
  calculateLumpSumTax,
  INCOME_TAX_BRACKETS,
  RETIREMENT_LUMP_SUM_TAX_TABLE,
} from './tax-tables'

describe('tax-tables', () => {
  describe('INCOME_TAX_BRACKETS', () => {
    it('should have 7 tax brackets for 2026/2027', () => {
      expect(INCOME_TAX_BRACKETS).toHaveLength(7)
    })

    it('should have correct bracket structure', () => {
      // First bracket
      expect(INCOME_TAX_BRACKETS[0]).toEqual({
        min: 0,
        max: 245100,
        rate: 0.18,
        baseTax: 0,
      })

      // Last bracket (min is threshold where 45% starts, which is R1,878,600)
      expect(INCOME_TAX_BRACKETS[6]).toEqual({
        min: 1878600,
        max: Infinity,
        rate: 0.45,
        baseTax: 666339,
      })
    })
  })

  describe('RETIREMENT_LUMP_SUM_TAX_TABLE', () => {
    it('should have 4 tax tiers for 2026/2027', () => {
      expect(RETIREMENT_LUMP_SUM_TAX_TABLE).toHaveLength(4)
    })

    it('should have correct tier structure', () => {
      // First R550,000 tax-free
      expect(RETIREMENT_LUMP_SUM_TAX_TABLE[0]).toEqual({
        threshold: 550000,
        rate: 0,
        previousTax: 0,
      })

      // Second tier
      expect(RETIREMENT_LUMP_SUM_TAX_TABLE[1]).toEqual({
        threshold: 770000,
        rate: 0.18,
        previousTax: 0,
      })

      // Third tier (2026/2027: raised to R1,155,000)
      expect(RETIREMENT_LUMP_SUM_TAX_TABLE[2]).toEqual({
        threshold: 1155000,
        rate: 0.27,
        previousTax: 39600,
      })

      // Fourth tier (highest)
      expect(RETIREMENT_LUMP_SUM_TAX_TABLE[3]).toEqual({
        threshold: Infinity,
        rate: 0.36,
        previousTax: 143550,
      })
    })
  })

  describe('calculateIncomeTax', () => {
    describe('Edge cases', () => {
      it('should return 0 for zero income', () => {
        expect(calculateIncomeTax(0)).toBe(0)
      })

      it('should return 0 for negative income', () => {
        expect(calculateIncomeTax(-1000)).toBe(0)
      })

      it('should handle very small positive income', () => {
        // R1 income = R1 * 18% = R0.18
        expect(calculateIncomeTax(1)).toBe(0.18)
      })
    })

    describe('First bracket (0 - R245,100 @ 18%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // R1,000 * 18% = R180
        expect(calculateIncomeTax(1000)).toBe(180)
      })

      it('should calculate tax at R100,000', () => {
        // R100,000 * 18% = R18,000
        expect(calculateIncomeTax(100000)).toBe(18000)
      })

      it('should calculate tax at top of bracket', () => {
        // R245,100 * 18% = R44,118
        expect(calculateIncomeTax(245100)).toBe(44118)
      })
    })

    describe('Second bracket (R245,101 - R383,100 @ 26%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R44,118
        // Additional: R1 * 26% = R0.26
        // Total: R44,118.26
        expect(calculateIncomeTax(245101)).toBe(44118.26)
      })

      it('should calculate tax at R300,000', () => {
        // Base: R44,118
        // Additional: (R300,000 - R245,100) * 26% = R54,900 * 26% = R14,274
        // Total: R44,118 + R14,274 = R58,392
        expect(calculateIncomeTax(300000)).toBe(58392)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R44,118
        // Additional: (R383,100 - R245,100) * 26% = R138,000 * 26% = R35,880
        // Total: R44,118 + R35,880 = R79,998
        expect(calculateIncomeTax(383100)).toBe(79998)
      })
    })

    describe('Third bracket (R383,101 - R530,200 @ 31%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R79,998
        // Additional: R1 * 31% = R0.31
        // Total: R79,998.31
        expect(calculateIncomeTax(383101)).toBe(79998.31)
      })

      it('should calculate tax at R450,000', () => {
        // Base: R79,998
        // Additional: (R450,000 - R383,100) * 31% = R66,900 * 31% = R20,739
        // Total: R79,998 + R20,739 = R100,737
        expect(calculateIncomeTax(450000)).toBe(100737)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R79,998
        // Additional: (R530,200 - R383,100) * 31% = R147,100 * 31% = R45,601
        // Total: R79,998 + R45,601 = R125,599
        expect(calculateIncomeTax(530200)).toBe(125599)
      })
    })

    describe('Fourth bracket (R530,201 - R695,800 @ 36%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R125,599
        // Additional: R1 * 36% = R0.36
        // Total: R125,599.36
        expect(calculateIncomeTax(530201)).toBe(125599.36)
      })

      it('should calculate tax at R600,000', () => {
        // Base: R125,599
        // Additional: (R600,000 - R530,200) * 36% = R69,800 * 36% = R25,128
        // Total: R125,599 + R25,128 = R150,727
        expect(calculateIncomeTax(600000)).toBe(150727)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R125,599
        // Additional: (R695,800 - R530,200) * 36% = R165,600 * 36% = R59,616
        // Total: R125,599 + R59,616 = R185,215
        expect(calculateIncomeTax(695800)).toBe(185215)
      })
    })

    describe('Fifth bracket (R695,801 - R887,000 @ 39%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R185,215
        // Additional: R1 * 39% = R0.39
        // Total: R185,215.39
        expect(calculateIncomeTax(695801)).toBe(185215.39)
      })

      it('should calculate tax at R750,000', () => {
        // Base: R185,215
        // Additional: (R750,000 - R695,800) * 39% = R54,200 * 39% = R21,138
        // Total: R185,215 + R21,138 = R206,353
        expect(calculateIncomeTax(750000)).toBe(206353)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R185,215
        // Additional: (R887,000 - R695,800) * 39% = R191,200 * 39% = R74,568
        // Total: R185,215 + R74,568 = R259,783
        expect(calculateIncomeTax(887000)).toBe(259783)
      })
    })

    describe('Sixth bracket (R887,001 - R1,878,600 @ 41%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R259,783
        // Additional: R1 * 41% = R0.41
        // Total: R259,783.41
        expect(calculateIncomeTax(887001)).toBe(259783.41)
      })

      it('should calculate tax at R1,000,000', () => {
        // Base: R259,783
        // Additional: (R1,000,000 - R887,000) * 41% = R113,000 * 41% = R46,330
        // Total: R259,783 + R46,330 = R306,113
        expect(calculateIncomeTax(1000000)).toBe(306113)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R259,783
        // Additional: (R1,878,600 - R887,000) * 41% = R991,600 * 41% = R406,556
        // Total: R259,783 + R406,556 = R666,339
        expect(calculateIncomeTax(1878600)).toBe(666339)
      })
    })

    describe('Seventh bracket (R1,878,601+ @ 45%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R666,339
        // Additional: R1 * 45% = R0.45
        // Total: R666,339.45
        expect(calculateIncomeTax(1878601)).toBe(666339.45)
      })

      it('should calculate tax at R2,000,000', () => {
        // Base: R666,339
        // Additional: (R2,000,000 - R1,878,600) * 45% = R121,400 * 45% = R54,630
        // Total: R666,339 + R54,630 = R720,969
        expect(calculateIncomeTax(2000000)).toBe(720969)
      })

      it('should calculate tax at R5,000,000', () => {
        // Base: R666,339
        // Additional: (R5,000,000 - R1,878,600) * 45% = R3,121,400 * 45% = R1,404,630
        // Total: R666,339 + R1,404,630 = R2,070,969
        expect(calculateIncomeTax(5000000)).toBe(2070969)
      })
    })

    describe('Real-world retirement income scenarios', () => {
      it('should calculate tax for R20,000/month income (R240,000 p.a.)', () => {
        // R240,000 falls in first bracket
        // R240,000 * 18% = R43,200
        expect(calculateIncomeTax(240000)).toBe(43200)
      })

      it('should calculate tax for R30,000/month income (R360,000 p.a.)', () => {
        // R360,000 falls in second bracket
        // Base: R44,118
        // Additional: (R360,000 - R245,100) * 26% = R114,900 * 26% = R29,874
        // Total: R44,118 + R29,874 = R73,992
        expect(calculateIncomeTax(360000)).toBe(73992)
      })

      it('should calculate tax for R50,000/month income (R600,000 p.a.)', () => {
        // R600,000 falls in fourth bracket
        // Calculated above: R150,727
        expect(calculateIncomeTax(600000)).toBe(150727)
      })
    })
  })

  describe('calculateLumpSumTax', () => {
    describe('Edge cases', () => {
      it('should return 0 for zero lump sum', () => {
        expect(calculateLumpSumTax(0)).toBe(0)
      })

      it('should return 0 for negative lump sum', () => {
        expect(calculateLumpSumTax(-10000)).toBe(0)
      })
    })

    describe('First tier (R0 - R550,000 @ 0%)', () => {
      it('should return 0 for R1', () => {
        expect(calculateLumpSumTax(1)).toBe(0)
      })

      it('should return 0 for R100,000', () => {
        expect(calculateLumpSumTax(100000)).toBe(0)
      })

      it('should return 0 for R500,000', () => {
        expect(calculateLumpSumTax(500000)).toBe(0)
      })

      it('should return 0 at top of tier (R550,000)', () => {
        expect(calculateLumpSumTax(550000)).toBe(0)
      })
    })

    describe('Second tier (R550,001 - R770,000 @ 18%)', () => {
      it('should calculate tax at bottom of tier', () => {
        // (R550,001 - R550,000) * 18% = R1 * 18% = R0.18
        expect(calculateLumpSumTax(550001)).toBe(0.18)
      })

      it('should calculate tax at R600,000', () => {
        // (R600,000 - R550,000) * 18% = R50,000 * 18% = R9,000
        expect(calculateLumpSumTax(600000)).toBe(9000)
      })

      it('should calculate tax at R700,000', () => {
        // (R700,000 - R550,000) * 18% = R150,000 * 18% = R27,000
        expect(calculateLumpSumTax(700000)).toBe(27000)
      })

      it('should calculate tax at top of tier (R770,000)', () => {
        // (R770,000 - R550,000) * 18% = R220,000 * 18% = R39,600
        expect(calculateLumpSumTax(770000)).toBe(39600)
      })
    })

    describe('Third tier (R770,001 - R1,155,000 @ 27%)', () => {
      it('should calculate tax at bottom of tier', () => {
        // Previous: R39,600
        // Additional: (R770,001 - R770,000) * 27% = R1 * 27% = R0.27
        // Total: R39,600.27
        expect(calculateLumpSumTax(770001)).toBe(39600.27)
      })

      it('should calculate tax at R900,000', () => {
        // Previous: R39,600
        // Additional: (R900,000 - R770,000) * 27% = R130,000 * 27% = R35,100
        // Total: R39,600 + R35,100 = R74,700
        expect(calculateLumpSumTax(900000)).toBe(74700)
      })

      it('should calculate tax at R1,000,000', () => {
        // Previous: R39,600
        // Additional: (R1,000,000 - R770,000) * 27% = R230,000 * 27% = R62,100
        // Total: R39,600 + R62,100 = R101,700
        expect(calculateLumpSumTax(1000000)).toBe(101700)
      })

      it('should calculate tax at top of tier (R1,155,000)', () => {
        // Previous: R39,600
        // Additional: (R1,155,000 - R770,000) * 27% = R385,000 * 27% = R103,950
        // Total: R39,600 + R103,950 = R143,550
        expect(calculateLumpSumTax(1155000)).toBe(143550)
      })
    })

    describe('Fourth tier (R1,155,001+ @ 36%)', () => {
      it('should calculate tax at bottom of tier', () => {
        // Previous: R143,550
        // Additional: (R1,155,001 - R1,155,000) * 36% = R1 * 36% = R0.36
        // Total: R143,550.36
        expect(calculateLumpSumTax(1155001)).toBe(143550.36)
      })

      it('should calculate tax at R1,500,000', () => {
        // Previous: R143,550
        // Additional: (R1,500,000 - R1,155,000) * 36% = R345,000 * 36% = R124,200
        // Total: R143,550 + R124,200 = R267,750
        expect(calculateLumpSumTax(1500000)).toBe(267750)
      })

      it('should calculate tax at R2,000,000', () => {
        // Previous: R143,550
        // Additional: (R2,000,000 - R1,155,000) * 36% = R845,000 * 36% = R304,200
        // Total: R143,550 + R304,200 = R447,750
        expect(calculateLumpSumTax(2000000)).toBe(447750)
      })

      it('should calculate tax at R5,000,000', () => {
        // Previous: R143,550
        // Additional: (R5,000,000 - R1,155,000) * 36% = R3,845,000 * 36% = R1,384,200
        // Total: R143,550 + R1,384,200 = R1,527,750
        expect(calculateLumpSumTax(5000000)).toBe(1527750)
      })
    })

    describe('Common retirement lump sum scenarios', () => {
      it('should calculate tax for R500k lump sum (common one-third of R1.5M)', () => {
        // R500,000 is in first tier (tax-free)
        expect(calculateLumpSumTax(500000)).toBe(0)
      })

      it('should calculate tax for R800k lump sum', () => {
        // Falls in third tier
        // Previous: R39,600
        // Additional: (R800,000 - R770,000) * 27% = R30,000 * 27% = R8,100
        // Total: R39,600 + R8,100 = R47,700
        expect(calculateLumpSumTax(800000)).toBe(47700)
      })

      it('should calculate tax for R1.2M lump sum', () => {
        // Falls in fourth tier (2026/2027: above R1,155,000)
        // Previous: R143,550
        // Additional: (R1,200,000 - R1,155,000) * 36% = R45,000 * 36% = R16,200
        // Total: R143,550 + R16,200 = R159,750
        expect(calculateLumpSumTax(1200000)).toBe(159750)
      })
    })

    describe('Effective tax rate calculations', () => {
      it('should result in ~5.7% effective rate for R800k lump sum', () => {
        const tax = calculateLumpSumTax(800000)
        const effectiveRate = tax / 800000
        expect(effectiveRate).toBeCloseTo(0.059625, 4) // 5.96%
      })

      it('should result in ~13.3% effective rate for R1.2M lump sum', () => {
        const tax = calculateLumpSumTax(1200000)
        const effectiveRate = tax / 1200000
        expect(effectiveRate).toBeCloseTo(0.133125, 4) // 13.31%
      })

      it('should result in ~22.4% effective rate for R2M lump sum', () => {
        const tax = calculateLumpSumTax(2000000)
        const effectiveRate = tax / 2000000
        expect(effectiveRate).toBeCloseTo(0.223875, 4) // 22.39%
      })
    })
  })
})
