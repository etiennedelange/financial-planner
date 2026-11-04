import { describe, expect, it } from "vite-plus/test"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import {
  calculateOverviewSummary,
  ON_TRACK_SUCCESS_RATE,
  type OverviewSummaryInput,
} from "./overview-summary"

const base: OverviewSummaryInput = {
  projection: {
    portfolioAtRetirement: 64_694_735,
    monthlyIncomeAtRetirement: 140_810,
    portfolioDepletionAge: null,
  },
  currentAge: 39,
  retirementAge: 65,
  lifeExpectancy: 100,
  annualIncome: 1_150_000,
  desiredMonthlyIncome: 35_000,
  inflationRate: 5.5,
  monteCarloSuccessRate: null,
}

const factor26 = Math.pow(1.055, 26)

describe("calculateOverviewSummary", () => {
  describe("Critical SA scenarios", () => {
    it("reports a plan that lasts to life expectancy as on track on steady returns", () => {
      const s = calculateOverviewSummary(base)
      expect(s.yearsToRetirement).toBe(26)
      expect(s.incomeEndAge).toBe(100)
      expect(s.yearsOfIncome).toBe(35)
      expect(s.shortfallYears).toBe(0)
      expect(s.lastsToLifeExpectancy).toBe(true)
      expect(s.isOnTrack).toBe(true)
      expect(s.verdictBasis).toBe("steady-returns")
    })

    it("expresses retirement figures in today's rands at the inflation assumption", () => {
      const s = calculateOverviewSummary(base)
      // Excel: =140810/1.055^26 and =64694735/1.055^26
      expect(s.monthlyIncomeToday).toBeCloseTo(140_810 / factor26, 6)
      expect(s.portfolioAtRetirementToday).toBeCloseTo(64_694_735 / factor26, 6)
      expect(s.portfolioAtRetirementToday).toBeCloseTo(16_082_000, -4)
    })

    it("compares income to goal on the same (retirement-date) basis", () => {
      const s = calculateOverviewSummary(base)
      expect(s.desiredIncomeAtRetirement).toBeCloseTo(35_000 * factor26, 6)
      expect(s.incomeReplacementPercent).toBe(Math.round((140_810 / (35_000 * factor26)) * 100))
    })

    it("caps the RA deduction at 27.5% of income", () => {
      const s = calculateOverviewSummary(base)
      expect(s.maxMonthlyRaContribution).toBeCloseTo((1_150_000 * 0.275) / 12, 6)
    })

    it("caps the RA deduction at the annual rand limit for high earners", () => {
      const s = calculateOverviewSummary({ ...base, annualIncome: 5_000_000 })
      expect(s.maxMonthlyRaContribution).toBeCloseTo(SA_TAX_LIMITS.pensionRaMaxDeduction / 12, 6)
    })

    it("flags early depletion and counts the shortfall years", () => {
      const s = calculateOverviewSummary({
        ...base,
        projection: { ...base.projection, portfolioDepletionAge: 82 },
      })
      expect(s.incomeEndAge).toBe(82)
      expect(s.yearsOfIncome).toBe(17)
      expect(s.shortfallYears).toBe(18)
      expect(s.lastsToLifeExpectancy).toBe(false)
      expect(s.isOnTrack).toBe(false)
    })

    it("treats depletion at or after life expectancy as lasting", () => {
      const s = calculateOverviewSummary({
        ...base,
        projection: { ...base.projection, portfolioDepletionAge: 100 },
      })
      expect(s.lastsToLifeExpectancy).toBe(true)
      expect(s.shortfallYears).toBe(0)
    })
  })

  describe("Monte Carlo verdict", () => {
    it("uses the success rate when one is available", () => {
      const s = calculateOverviewSummary({ ...base, monteCarloSuccessRate: 55 })
      expect(s.verdictBasis).toBe("monte-carlo")
      expect(s.isOnTrack).toBe(false)
    })

    it("is on track exactly at the threshold", () => {
      const s = calculateOverviewSummary({
        ...base,
        monteCarloSuccessRate: ON_TRACK_SUCCESS_RATE,
      })
      expect(s.isOnTrack).toBe(true)
    })

    it("lets a strong success rate override steady-return depletion", () => {
      const s = calculateOverviewSummary({
        ...base,
        projection: { ...base.projection, portfolioDepletionAge: 90 },
        monteCarloSuccessRate: 85,
      })
      expect(s.isOnTrack).toBe(true)
      expect(s.lastsToLifeExpectancy).toBe(false)
    })

    it("ignores a non-finite success rate", () => {
      const s = calculateOverviewSummary({ ...base, monteCarloSuccessRate: Number.NaN })
      expect(s.verdictBasis).toBe("steady-returns")
    })
  })

  describe("Inflation basis", () => {
    it("leaves amounts unchanged at 0% inflation", () => {
      const s = calculateOverviewSummary({ ...base, inflationRate: 0 })
      expect(s.monthlyIncomeToday).toBe(140_810)
      expect(s.incomeReplacementPercent).toBe(Math.round((140_810 / 35_000) * 100))
    })
  })

  describe("Edge cases", () => {
    it("handles retiring now (zero years to retirement)", () => {
      const s = calculateOverviewSummary({ ...base, currentAge: 65 })
      expect(s.yearsToRetirement).toBe(0)
      expect(s.monthlyIncomeToday).toBe(140_810)
    })

    it("clamps negative years (retirement age below current age)", () => {
      const s = calculateOverviewSummary({ ...base, currentAge: 70, retirementAge: 65 })
      expect(s.yearsToRetirement).toBe(0)
      expect(s.yearsOfIncome).toBe(30)
    })

    it("returns null replacement when there is no income goal", () => {
      const s = calculateOverviewSummary({ ...base, desiredMonthlyIncome: 0 })
      expect(s.incomeReplacementPercent).toBeNull()
    })

    it("handles a zero balance projection", () => {
      const s = calculateOverviewSummary({
        ...base,
        projection: {
          portfolioAtRetirement: 0,
          monthlyIncomeAtRetirement: 0,
          portfolioDepletionAge: 65,
        },
      })
      expect(s.portfolioAtRetirementToday).toBe(0)
      expect(s.incomeReplacementPercent).toBe(0)
      expect(s.incomeEndAge).toBe(65)
      expect(s.yearsOfIncome).toBe(0)
      expect(s.isOnTrack).toBe(false)
    })

    it("never puts the income end before retirement", () => {
      const s = calculateOverviewSummary({
        ...base,
        projection: { ...base.projection, portfolioDepletionAge: 50 },
      })
      expect(s.incomeEndAge).toBe(65)
      expect(s.yearsOfIncome).toBe(0)
    })

    it("returns zero RA room for zero income", () => {
      expect(calculateOverviewSummary({ ...base, annualIncome: 0 }).maxMonthlyRaContribution).toBe(
        0,
      )
    })

    it("degrades non-finite inputs to zero instead of NaN", () => {
      const s = calculateOverviewSummary({
        ...base,
        annualIncome: Number.NaN,
        inflationRate: Number.NaN,
        projection: {
          portfolioAtRetirement: Number.POSITIVE_INFINITY,
          monthlyIncomeAtRetirement: Number.NaN,
          portfolioDepletionAge: null,
        },
      })
      expect(s.maxMonthlyRaContribution).toBe(0)
      expect(s.monthlyIncomeToday).toBe(0)
      expect(s.portfolioAtRetirementToday).toBe(0)
      expect(Number.isFinite(s.incomeReplacementPercent ?? 0)).toBe(true)
    })
  })
})
