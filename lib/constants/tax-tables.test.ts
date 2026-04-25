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
        max: 237100,
        rate: 0.18,
        baseTax: 0,
      })

      // Last bracket (min is threshold where 45% starts, which is R1,817,000)
      expect(INCOME_TAX_BRACKETS[6]).toEqual({
        min: 1817000,
        max: Infinity,
        rate: 0.45,
        baseTax: 644489,
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

    describe('First bracket (0 - R237,100 @ 18%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // R1,000 * 18% = R180
        expect(calculateIncomeTax(1000)).toBe(180)
      })

      it('should calculate tax at R100,000', () => {
        // R100,000 * 18% = R18,000
        expect(calculateIncomeTax(100000)).toBe(18000)
      })

      it('should calculate tax at top of bracket', () => {
        // R237,100 * 18% = R42,678
        expect(calculateIncomeTax(237100)).toBe(42678)
      })
    })

    describe('Second bracket (R237,101 - R370,500 @ 26%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R42,678
        // Additional: R1 * 26% = R0.26
        // Total: R42,678.26
        expect(calculateIncomeTax(237101)).toBe(42678.26)
      })

      it('should calculate tax at R300,000', () => {
        // Base: R42,678
        // Additional: (R300,000 - R237,100) * 26% = R62,900 * 26% = R16,354
        // Total: R42,678 + R16,354 = R59,032
        expect(calculateIncomeTax(300000)).toBe(59032)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R42,678
        // Additional: (R370,500 - R237,100) * 26% = R133,400 * 26% = R34,684
        // Total: R42,678 + R34,684 = R77,362
        expect(calculateIncomeTax(370500)).toBe(77362)
      })
    })

    describe('Third bracket (R370,501 - R512,800 @ 31%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R77,362
        // Additional: R1 * 31% = R0.31
        // Total: R77,362.31
        expect(calculateIncomeTax(370501)).toBe(77362.31)
      })

      it('should calculate tax at R450,000', () => {
        // Base: R77,362
        // Additional: (R450,000 - R370,500) * 31% = R79,500 * 31% = R24,645
        // Total: R77,362 + R24,645 = R102,007
        expect(calculateIncomeTax(450000)).toBe(102007)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R77,362
        // Additional: (R512,800 - R370,500) * 31% = R142,300 * 31% = R44,113
        // Total: R77,362 + R44,113 = R121,475
        expect(calculateIncomeTax(512800)).toBe(121475)
      })
    })

    describe('Fourth bracket (R512,801 - R673,000 @ 36%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R121,475
        // Additional: R1 * 36% = R0.36
        // Total: R121,475.36
        expect(calculateIncomeTax(512801)).toBe(121475.36)
      })

      it('should calculate tax at R600,000', () => {
        // Base: R121,475
        // Additional: (R600,000 - R512,800) * 36% = R87,200 * 36% = R31,392
        // Total: R121,475 + R31,392 = R152,867
        expect(calculateIncomeTax(600000)).toBe(152867)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R121,475
        // Additional: (R673,000 - R512,800) * 36% = R160,200 * 36% = R57,672
        // Total: R121,475 + R57,672 = R179,147
        expect(calculateIncomeTax(673000)).toBe(179147)
      })
    })

    describe('Fifth bracket (R673,001 - R857,900 @ 39%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R179,147
        // Additional: R1 * 39% = R0.39
        // Total: R179,147.39
        expect(calculateIncomeTax(673001)).toBe(179147.39)
      })

      it('should calculate tax at R750,000', () => {
        // Base: R179,147
        // Additional: (R750,000 - R673,000) * 39% = R77,000 * 39% = R30,030
        // Total: R179,147 + R30,030 = R209,177
        expect(calculateIncomeTax(750000)).toBe(209177)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R179,147
        // Additional: (R857,900 - R673,000) * 39% = R184,900 * 39% = R72,111
        // Total: R179,147 + R72,111 = R251,258
        expect(calculateIncomeTax(857900)).toBe(251258)
      })
    })

    describe('Sixth bracket (R857,901 - R1,817,000 @ 41%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R251,258
        // Additional: R1 * 41% = R0.41
        // Total: R251,258.41
        expect(calculateIncomeTax(857901)).toBe(251258.41)
      })

      it('should calculate tax at R1,000,000', () => {
        // Base: R251,258
        // Additional: (R1,000,000 - R857,900) * 41% = R142,100 * 41% = R58,261
        // Total: R251,258 + R58,261 = R309,519
        expect(calculateIncomeTax(1000000)).toBe(309519)
      })

      it('should calculate tax at top of bracket', () => {
        // Base: R251,258
        // Additional: (R1,817,000 - R857,900) * 41% = R959,100 * 41% = R393,231
        // Total: R251,258 + R393,231 = R644,489
        expect(calculateIncomeTax(1817000)).toBe(644489)
      })
    })

    describe('Seventh bracket (R1,817,001+ @ 45%)', () => {
      it('should calculate tax at bottom of bracket', () => {
        // Base: R644,489
        // Additional: R1 * 45% = R0.45
        // Total: R644,489.45
        expect(calculateIncomeTax(1817001)).toBe(644489.45)
      })

      it('should calculate tax at R2,000,000', () => {
        // Base: R644,489
        // Additional: (R2,000,000 - R1,817,000) * 45% = R183,000 * 45% = R82,350
        // Total: R644,489 + R82,350 = R726,839
        expect(calculateIncomeTax(2000000)).toBe(726839)
      })

      it('should calculate tax at R5,000,000', () => {
        // Base: R644,489
        // Additional: (R5,000,000 - R1,817,000) * 45% = R3,183,000 * 45% = R1,432,350
        // Total: R644,489 + R1,432,350 = R2,076,839
        expect(calculateIncomeTax(5000000)).toBe(2076839)
      })
    })

    describe('Real-world retirement income scenarios', () => {
      it('should calculate tax for R20,000/month income (R240,000 p.a.)', () => {
        // R240,000 falls in second bracket
        // Base: R42,678
        // Additional: (R240,000 - R237,100) * 26% = R2,900 * 26% = R754
        // Total: R42,678 + R754 = R43,432
        expect(calculateIncomeTax(240000)).toBe(43432)
      })

      it('should calculate tax for R30,000/month income (R360,000 p.a.)', () => {
        // R360,000 falls in second bracket
        // Base: R42,678
        // Additional: (R360,000 - R237,100) * 26% = R122,900 * 26% = R31,954
        // Total: R42,678 + R31,954 = R74,632
        expect(calculateIncomeTax(360000)).toBe(74632)
      })

      it('should calculate tax for R50,000/month income (R600,000 p.a.)', () => {
        // R600,000 falls in fourth bracket
        // Calculated above: R152,867
        expect(calculateIncomeTax(600000)).toBe(152867)
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
