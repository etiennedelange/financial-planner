import { describe, expect, it } from "vitest"
import { buildIncomeSustainabilitySeries } from "./income-sustainability"
import { calculateProjection } from "../projection-engine"
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from "@/types"

const baseAccount: Account = {
  id: "1",
  name: "Test RA",
  type: "retirement_annuity",
  provider: "Test Provider",
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
  strategy: "fixed_percentage",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 0,
}

describe("buildIncomeSustainabilitySeries", () => {
  const projection = calculateProjection(
    [baseAccount],
    basePersonalInfo,
    baseRetirementGoals,
    baseDrawdownConfig
  )

  describe("Nominal mode", () => {
    it("only includes drawdown years (age >= retirement age)", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "nominal",
      })

      expect(series.points.length).toBeGreaterThan(0)
      expect(series.points.every((p) => p.age >= 65)).toBe(true)
      expect(series.points[0].age).toBe(65)
    })

    it("escalates the target to the retirement basis", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "nominal",
      })

      // 30000 escalated over 30 years @ 5.5%
      const expectedTarget = 30000 * Math.pow(1.055, 30)
      expect(series.points[0].target).toBeCloseTo(expectedTarget, 0)
    })

    it("target grows with age while income tracks the withdrawal", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "nominal",
      })

      const first = series.points[0]
      const last = series.points[series.points.length - 1]
      expect(last.target).toBeGreaterThan(first.target)
      expect(first.income).toBeGreaterThan(0)
    })
  })

  describe("Real mode", () => {
    it("target equals the desired income as entered today", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "real",
      })

      expect(series.points.length).toBeGreaterThan(0)
      for (const point of series.points) {
        expect(point.target).toBeCloseTo(30000, 0)
      }
    })

    it("income is deflated to today's value", () => {
      const nominal = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "nominal",
      })
      const real = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "real",
      })

      const firstNominal = nominal.points[0]
      const firstReal = real.points.find((p) => p.age === firstNominal.age)!
      // Real income = nominal income deflated over 30 years @ 5.5%
      expect(firstReal.income).toBeCloseTo(firstNominal.income / Math.pow(1.055, 30), 0)
    })
  })

  describe("Edge cases", () => {
    it("reports the depletion age from the projection", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 5.5,
        displayMode: "nominal",
      })

      expect(series.depletionAge).toBe(projection.portfolioDepletionAge)
    })

    it("is empty when retirement age is beyond life expectancy", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 95,
        inflationRate: 5.5,
        displayMode: "nominal",
      })

      expect(series.points).toHaveLength(0)
    })

    it("handles zero inflation without dividing by zero or exploding", () => {
      const series = buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome: 30000,
        currentAge: 35,
        retirementAge: 65,
        inflationRate: 0,
        displayMode: "real",
      })

      expect(series.points.length).toBeGreaterThan(0)
      for (const point of series.points) {
        expect(Number.isFinite(point.income)).toBe(true)
        expect(point.target).toBeCloseTo(30000, 0)
      }
    })
  })
})
