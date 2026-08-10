import { describe, expect, it } from "vitest"
import { buildSensitivityTornado } from "./sensitivity-tornado"
import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"

const assumptions: MarketAssumptions = {
  equityReturn: 12,
  bondReturn: 8,
  cashReturn: 5,
  equityVolatility: 16,
  bondVolatility: 10,
  inflationRate: 5.5,
  compoundingMethod: "nominal",
}

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

describe("buildSensitivityTornado", () => {
  it("returns bars for all three levers", () => {
    const bars = buildSensitivityTornado({
      accounts: [baseAccount],
      personalInfo: basePersonalInfo,
      retirementGoals: baseRetirementGoals,
      drawdownConfig: baseDrawdownConfig,
      assumptions,
    })

    expect(bars).toHaveLength(3)
    expect(bars.map((b) => b.key)).toEqual(["contribution", "return", "retirementAge"])
  })

  it("higher contributions increase the nest egg, lower contributions decrease it", () => {
    const bars = buildSensitivityTornado({
      accounts: [baseAccount],
      personalInfo: basePersonalInfo,
      retirementGoals: baseRetirementGoals,
      drawdownConfig: baseDrawdownConfig,
      assumptions,
    })

    const contribution = bars.find((b) => b.key === "contribution")!
    expect(contribution.highDelta).toBeGreaterThan(0)
    expect(contribution.lowDelta).toBeLessThan(0)
    expect(contribution.highDelta).toBeGreaterThan(Math.abs(contribution.lowDelta))
  })

  it("higher expected return increases the nest egg", () => {
    const bars = buildSensitivityTornado({
      accounts: [baseAccount],
      personalInfo: basePersonalInfo,
      retirementGoals: baseRetirementGoals,
      drawdownConfig: baseDrawdownConfig,
      assumptions,
    })

    const ret = bars.find((b) => b.key === "return")!
    expect(ret.highDelta).toBeGreaterThan(0)
    expect(ret.lowDelta).toBeLessThan(0)
  })

  it("retiring later increases the nest egg, retiring earlier decreases it", () => {
    const bars = buildSensitivityTornado({
      accounts: [baseAccount],
      personalInfo: basePersonalInfo,
      retirementGoals: baseRetirementGoals,
      drawdownConfig: baseDrawdownConfig,
      assumptions,
    })

    const age = bars.find((b) => b.key === "retirementAge")!
    expect(age.highDelta).toBeGreaterThan(0)
    expect(age.lowDelta).toBeLessThan(0)
  })

  it("percent deltas have the same sign as rand deltas", () => {
    const bars = buildSensitivityTornado({
      accounts: [baseAccount],
      personalInfo: basePersonalInfo,
      retirementGoals: baseRetirementGoals,
      drawdownConfig: baseDrawdownConfig,
      assumptions,
    })

    for (const bar of bars) {
      expect(Math.sign(bar.lowPct)).toBe(Math.sign(bar.lowDelta))
      expect(Math.sign(bar.highPct)).toBe(Math.sign(bar.highDelta))
      expect(Math.abs(bar.highPct)).toBeGreaterThan(0)
    }
  })

  describe("Edge cases", () => {
    it("returns empty array with no accounts", () => {
      const bars = buildSensitivityTornado({
        accounts: [],
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        assumptions,
      })

      expect(bars).toEqual([])
    })

    it("returns empty array when the baseline nest egg is zero", () => {
      const zeroAccount: Account = {
        ...baseAccount,
        currentBalance: 0,
        monthlyContribution: 0,
      }

      const bars = buildSensitivityTornado({
        accounts: [zeroAccount],
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        assumptions,
      })

      expect(bars).toEqual([])
    })

    it("handles negative retirement age offsets without producing NaN", () => {
      const bars = buildSensitivityTornado({
        accounts: [baseAccount],
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        drawdownConfig: baseDrawdownConfig,
        assumptions,
      })

      for (const bar of bars) {
        expect(Number.isFinite(bar.lowDelta)).toBe(true)
        expect(Number.isFinite(bar.highDelta)).toBe(true)
        expect(Number.isFinite(bar.lowPct)).toBe(true)
        expect(Number.isFinite(bar.highPct)).toBe(true)
      }
    })
  })
})
