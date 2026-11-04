import { describe, expect, it } from "vite-plus/test"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { calculateOverviewSummary, type OverviewSummaryInput } from "./overview-summary"

const base: OverviewSummaryInput = {
  projection: {
    portfolioAtRetirement: 64_694_735,
    monthlyIncomeAtRetirement: 140_810,
    incomeGoalShortfallAge: null,
  },
  currentAge: 39,
  retirementAge: 65,
  lifeExpectancy: 100,
  annualIncome: 1_150_000,
  desiredMonthlyIncome: 35_000,
  inflationRate: 5.5,
}

const factor26 = Math.pow(1.055, 26)

const withShortfall = (age: number | null): OverviewSummaryInput => ({
  ...base,
  projection: { ...base.projection, incomeGoalShortfallAge: age },
})

describe("calculateOverviewSummary", () => {
  describe("Critical SA scenarios", () => {
    it("is on track when the projection pays the goal income every year", () => {
      const s = calculateOverviewSummary(base)
      expect(s.yearsToRetirement).toBe(26)
      expect(s.goalIncomeUntilAge).toBe(100)
      expect(s.yearsOfGoalIncome).toBe(35)
      expect(s.yearsBelowGoal).toBe(0)
      expect(s.isOnTrack).toBe(true)
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

    it("is not on track once income falls below the goal, and counts the years below it", () => {
      const s = calculateOverviewSummary(withShortfall(82))
      expect(s.goalIncomeUntilAge).toBe(82)
      expect(s.yearsOfGoalIncome).toBe(17)
      expect(s.yearsBelowGoal).toBe(18)
      expect(s.isOnTrack).toBe(false)
    })

    it("is not on track even when income is below goal from the first retirement year", () => {
      const s = calculateOverviewSummary(withShortfall(65))
      expect(s.goalIncomeUntilAge).toBe(65)
      expect(s.yearsOfGoalIncome).toBe(0)
      expect(s.yearsBelowGoal).toBe(35)
      expect(s.isOnTrack).toBe(false)
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
      expect(s.yearsOfGoalIncome).toBe(30)
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
          incomeGoalShortfallAge: 65,
        },
      })
      expect(s.portfolioAtRetirementToday).toBe(0)
      expect(s.incomeReplacementPercent).toBe(0)
      expect(s.isOnTrack).toBe(false)
    })

    it("keeps a shortfall age inside the retirement window", () => {
      expect(calculateOverviewSummary(withShortfall(50)).goalIncomeUntilAge).toBe(65)
      const late = calculateOverviewSummary(withShortfall(110))
      expect(late.goalIncomeUntilAge).toBe(100)
      expect(late.yearsBelowGoal).toBe(0)
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
          incomeGoalShortfallAge: Number.NaN,
        },
      })
      expect(s.maxMonthlyRaContribution).toBe(0)
      expect(s.monthlyIncomeToday).toBe(0)
      expect(s.portfolioAtRetirementToday).toBe(0)
      expect(s.isOnTrack).toBe(true)
      expect(Number.isFinite(s.incomeReplacementPercent ?? 0)).toBe(true)
    })
  })
})
