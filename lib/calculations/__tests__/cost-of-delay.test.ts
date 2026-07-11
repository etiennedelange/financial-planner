import { describe, it, expect } from "vitest"
import { calculateCostOfDelay } from "../cost-of-delay"
import type { PersonalInfo, RetirementGoals, CompoundingMethod } from "@/types"

describe("calculateCostOfDelay", () => {
  const basePersonalInfo: PersonalInfo = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    grossAnnualIncome: 900000,
    currentTaxRate: 36,
  }

  const baseRetirementGoals: RetirementGoals = {
    desiredMonthlyIncome: 45000,
    inflationRate: 5.5,
  }

  const baseParams = {
    currentSavings: 500000,
    monthlyContribution: 10000,
    personalInfo: basePersonalInfo,
    retirementGoals: baseRetirementGoals,
    expectedReturn: 0.10, // 10%
    fees: 0.01, // 1%
    contributionEscalation: 0.06, // 6%
    compoundingMethod: "nominal" as CompoundingMethod,
  }

  describe("Basic functionality", () => {
    it("should return all required fields", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result).toHaveProperty("baselineNestEgg")
      expect(result).toHaveProperty("oneYearDelayNestEgg")
      expect(result).toHaveProperty("twoYearDelayNestEgg")
      expect(result).toHaveProperty("fiveYearDelayNestEgg")
      expect(result).toHaveProperty("costOfOneYearDelay")
      expect(result).toHaveProperty("costOfTwoYearDelay")
      expect(result).toHaveProperty("costOfFiveYearDelay")
      expect(result).toHaveProperty("percentageLostOneYear")
      expect(result).toHaveProperty("percentageLostTwoYear")
      expect(result).toHaveProperty("percentageLostFiveYear")
    })

    it("should have baseline > one year delay > two year delay > five year delay", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.baselineNestEgg).toBeGreaterThan(result.oneYearDelayNestEgg)
      expect(result.oneYearDelayNestEgg).toBeGreaterThan(result.twoYearDelayNestEgg)
      expect(result.twoYearDelayNestEgg).toBeGreaterThan(result.fiveYearDelayNestEgg)
    })

    it("should have positive costs for delays", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.costOfOneYearDelay).toBeGreaterThan(0)
      expect(result.costOfTwoYearDelay).toBeGreaterThan(0)
      expect(result.costOfFiveYearDelay).toBeGreaterThan(0)
    })

    it("should have increasing costs with longer delays", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.costOfTwoYearDelay).toBeGreaterThan(result.costOfOneYearDelay)
      expect(result.costOfFiveYearDelay).toBeGreaterThan(result.costOfTwoYearDelay)
    })
  })

  describe("Cost calculations", () => {
    it("should correctly calculate cost as baseline minus delayed nest egg", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.costOfOneYearDelay).toBeCloseTo(
        result.baselineNestEgg - result.oneYearDelayNestEgg,
        0
      )
      expect(result.costOfTwoYearDelay).toBeCloseTo(
        result.baselineNestEgg - result.twoYearDelayNestEgg,
        0
      )
      expect(result.costOfFiveYearDelay).toBeCloseTo(
        result.baselineNestEgg - result.fiveYearDelayNestEgg,
        0
      )
    })

    it("should correctly calculate percentage lost", () => {
      const result = calculateCostOfDelay(baseParams)

      const expectedPercentOne = (result.costOfOneYearDelay / result.baselineNestEgg) * 100
      const expectedPercentTwo = (result.costOfTwoYearDelay / result.baselineNestEgg) * 100
      const expectedPercentFive = (result.costOfFiveYearDelay / result.baselineNestEgg) * 100

      expect(result.percentageLostOneYear).toBeCloseTo(expectedPercentOne, 5)
      expect(result.percentageLostTwoYear).toBeCloseTo(expectedPercentTwo, 5)
      expect(result.percentageLostFiveYear).toBeCloseTo(expectedPercentFive, 5)
    })
  })

  describe("Delay mechanics", () => {
    it("should grow existing savings during delay period", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        currentSavings: 100000,
        monthlyContribution: 0, // No contributions, only growth matters
        contributionEscalation: 0,
      })

      // With 0 contributions, growing for 1 year then the remaining years via
      // projectFinalSavings is mathematically equivalent to growing for the
      // full period straight through — so the cost of delay should be ~0.
      const percentDiff = (result.costOfOneYearDelay / result.baselineNestEgg) * 100
      expect(percentDiff).toBeLessThan(1)
    })

    it("should show significant impact when contributions are high", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        currentSavings: 0, // No existing savings
        monthlyContribution: 15000,
      })

      // With no existing savings and high contributions, delay is costly
      // because those missed contributions would have compounded significantly
      expect(result.percentageLostOneYear).toBeGreaterThan(2) // At least 2% loss
      expect(result.percentageLostFiveYear).toBeGreaterThan(10) // At least 10% loss
    })
  })

  describe("Compounding methods", () => {
    it("should respect nominal compounding method", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        compoundingMethod: "nominal",
      })

      expect(result.baselineNestEgg).toBeGreaterThan(0)
    })

    it("should respect compound compounding method", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        compoundingMethod: "compound",
      })

      expect(result.baselineNestEgg).toBeGreaterThan(0)
    })

    it("should produce different results for different compounding methods", () => {
      const nominalResult = calculateCostOfDelay({
        ...baseParams,
        compoundingMethod: "nominal",
      })

      const compoundResult = calculateCostOfDelay({
        ...baseParams,
        compoundingMethod: "compound",
      })

      // Results should be slightly different due to compounding methodology
      expect(nominalResult.baselineNestEgg).not.toBe(compoundResult.baselineNestEgg)
    })
  })

  describe("Edge cases", () => {
    it("should handle zero current savings", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        currentSavings: 0,
      })

      expect(result.baselineNestEgg).toBeGreaterThan(0)
      expect(result.costOfOneYearDelay).toBeGreaterThan(0)
    })

    it("should handle zero contributions", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        monthlyContribution: 0,
        contributionEscalation: 0,
      })

      // With no contributions, existing savings just grow
      // Delay cost should be minimal/zero since money grows regardless
      expect(result.baselineNestEgg).toBeGreaterThan(0)
    })

    it("should handle zero years to retirement", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 65, // Already at retirement
          retirementAge: 65,
        },
      })

      // With 0 years to retirement, all nest eggs should equal current savings
      expect(result.baselineNestEgg).toBeCloseTo(baseParams.currentSavings, 0)
    })

    it("should never report a negative cost of delay when retirement is imminent", () => {
      // Bug: the 1- and 2-year delay branches applied Math.pow(1+netReturn, N)
      // pre-growth unconditionally, then passed yearsToRetirement-N (which can
      // go negative) straight to projectFinalSavings. With 0 years to
      // retirement, the "delay" scenario ended up simulating growth for
      // longer than the baseline (which correctly stops at 0 years), making
      // waiting look *better* than not waiting.
      const result = calculateCostOfDelay({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 65,
          retirementAge: 65, // 0 years to retirement
        },
      })

      expect(result.costOfOneYearDelay).toBeGreaterThanOrEqual(0)
      expect(result.costOfTwoYearDelay).toBeGreaterThanOrEqual(0)
      expect(result.costOfFiveYearDelay).toBeGreaterThanOrEqual(0)
    })

    it("should not produce NaN percentages when baseline nest egg is zero", () => {
      // Bug: percentageLostOneYear/TwoYear/FiveYear divide by baselineNestEgg
      // with no guard. Zero current savings + zero contribution means
      // baselineNestEgg is legitimately 0, so the division was 0/0 = NaN.
      const result = calculateCostOfDelay({
        ...baseParams,
        currentSavings: 0,
        monthlyContribution: 0,
        contributionEscalation: 0,
      })

      expect(result.baselineNestEgg).toBe(0)
      expect(Number.isFinite(result.percentageLostOneYear)).toBe(true)
      expect(Number.isFinite(result.percentageLostTwoYear)).toBe(true)
      expect(Number.isFinite(result.percentageLostFiveYear)).toBe(true)
      expect(result.percentageLostOneYear).toBe(0)
      expect(result.percentageLostTwoYear).toBe(0)
      expect(result.percentageLostFiveYear).toBe(0)
    })

    it("should handle very short time horizons", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 63,
          retirementAge: 65, // Only 2 years
        },
      })

      // 5-year delay would exceed time horizon
      // The function handles this with Math.max(0, yearsToRetirement - 5)
      expect(result.fiveYearDelayNestEgg).toBeGreaterThan(0)
    })

    it("should handle five year delay exceeding time horizon", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 62,
          retirementAge: 65, // Only 3 years
        },
      })

      // 5-year delay results in 0 years to retirement
      // Should just return grown savings with no contribution period
      expect(result.fiveYearDelayNestEgg).toBeGreaterThan(0)
    })

    it("should handle zero expected return", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        expectedReturn: 0,
        fees: 0,
      })

      // With 0% return, nest egg = savings + contributions
      expect(result.baselineNestEgg).toBeGreaterThan(baseParams.currentSavings)
    })

    it("should handle negative net return (fees > return)", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        expectedReturn: 0.005, // 0.5%
        fees: 0.02, // 2% fees
      })

      // Net return is -1.5%, portfolio shrinks
      // But contributions still add value
      expect(result.baselineNestEgg).toBeGreaterThan(0)
    })

    it("should handle zero contribution escalation", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        contributionEscalation: 0,
      })

      expect(result.baselineNestEgg).toBeGreaterThan(0)
      expect(result.costOfOneYearDelay).toBeGreaterThan(0)
    })

    it("should handle high contribution escalation", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        contributionEscalation: 0.10, // 10% escalation
      })

      expect(result.baselineNestEgg).toBeGreaterThan(0)
      // Higher escalation means early contributions matter more
      expect(result.percentageLostOneYear).toBeGreaterThan(0)
    })
  })

  describe("SA-specific scenarios", () => {
    it("should model young professional starting early", () => {
      const result = calculateCostOfDelay({
        currentSavings: 50000,
        monthlyContribution: 5000,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 25,
          retirementAge: 65, // 40 years
        },
        retirementGoals: baseRetirementGoals,
        expectedReturn: 0.11, // 11% equity return
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: "nominal",
      })

      // With 40 years to compound, delay is very costly
      expect(result.percentageLostOneYear).toBeGreaterThan(1)
      expect(result.percentageLostFiveYear).toBeGreaterThan(8)
    })

    it("should model mid-career professional", () => {
      const result = calculateCostOfDelay({
        currentSavings: 800000,
        monthlyContribution: 12000,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 45,
          retirementAge: 65, // 20 years
        },
        retirementGoals: baseRetirementGoals,
        expectedReturn: 0.10,
        fees: 0.01,
        contributionEscalation: 0.06,
        compoundingMethod: "nominal",
      })

      // With existing savings and shorter horizon, impact is still significant
      expect(result.costOfOneYearDelay).toBeGreaterThan(100000)
      expect(result.costOfFiveYearDelay).toBeGreaterThan(500000)
    })

    it("should model conservative investor", () => {
      const result = calculateCostOfDelay({
        ...baseParams,
        expectedReturn: 0.075, // 7.5% (more conservative)
        fees: 0.0075, // 0.75% fees
      })

      // Lower returns mean less impact from delay, but still significant
      expect(result.costOfOneYearDelay).toBeGreaterThan(0)
    })

    it("should model TFSA at limit (R0 contributions)", () => {
      const result = calculateCostOfDelay({
        currentSavings: 500000, // TFSA limit
        monthlyContribution: 0, // Can't contribute more
        personalInfo: basePersonalInfo,
        retirementGoals: baseRetirementGoals,
        expectedReturn: 0.10,
        fees: 0.005, // Low fees for ETF
        contributionEscalation: 0,
        compoundingMethod: "nominal",
      })

      // With no contributions, delaying costs ~nothing — the money grows at
      // the same rate either way, just shifted by a year.
      const percentLost = (result.costOfOneYearDelay / result.baselineNestEgg) * 100
      expect(percentLost).toBeLessThan(1) // Less than 1% difference
    })
  })

  describe("Percentage calculations", () => {
    it("should have percentages between 0 and 100", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.percentageLostOneYear).toBeGreaterThanOrEqual(0)
      expect(result.percentageLostOneYear).toBeLessThan(100)

      expect(result.percentageLostTwoYear).toBeGreaterThanOrEqual(0)
      expect(result.percentageLostTwoYear).toBeLessThan(100)

      expect(result.percentageLostFiveYear).toBeGreaterThanOrEqual(0)
      expect(result.percentageLostFiveYear).toBeLessThan(100)
    })

    it("should have percentages in ascending order", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.percentageLostTwoYear).toBeGreaterThan(result.percentageLostOneYear)
      expect(result.percentageLostFiveYear).toBeGreaterThan(result.percentageLostTwoYear)
    })
  })

  describe("Mathematical consistency", () => {
    it("should have costs sum to less than baseline", () => {
      const result = calculateCostOfDelay(baseParams)

      // Individual costs should be less than baseline
      expect(result.costOfOneYearDelay).toBeLessThan(result.baselineNestEgg)
      expect(result.costOfTwoYearDelay).toBeLessThan(result.baselineNestEgg)
      expect(result.costOfFiveYearDelay).toBeLessThan(result.baselineNestEgg)
    })

    it("should have delay nest eggs be positive", () => {
      const result = calculateCostOfDelay(baseParams)

      expect(result.oneYearDelayNestEgg).toBeGreaterThan(0)
      expect(result.twoYearDelayNestEgg).toBeGreaterThan(0)
      expect(result.fiveYearDelayNestEgg).toBeGreaterThan(0)
    })
  })
})
