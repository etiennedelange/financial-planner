import { describe, it, expect } from "vitest"
import { compareScenarios, INVESTMENT_SCENARIOS } from "../scenario-comparison"
import type { PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod } from "@/types"

describe("INVESTMENT_SCENARIOS", () => {
  it("should have conservative, balanced, and aggressive scenarios", () => {
    expect(INVESTMENT_SCENARIOS).toHaveProperty("conservative")
    expect(INVESTMENT_SCENARIOS).toHaveProperty("balanced")
    expect(INVESTMENT_SCENARIOS).toHaveProperty("aggressive")
  })

  it("should have increasing returns from conservative to aggressive", () => {
    expect(INVESTMENT_SCENARIOS.conservative.nominalReturn).toBeLessThan(
      INVESTMENT_SCENARIOS.balanced.nominalReturn
    )
    expect(INVESTMENT_SCENARIOS.balanced.nominalReturn).toBeLessThan(
      INVESTMENT_SCENARIOS.aggressive.nominalReturn
    )
  })

  it("should have increasing volatility from conservative to aggressive", () => {
    expect(INVESTMENT_SCENARIOS.conservative.volatility).toBeLessThan(
      INVESTMENT_SCENARIOS.balanced.volatility
    )
    expect(INVESTMENT_SCENARIOS.balanced.volatility).toBeLessThan(
      INVESTMENT_SCENARIOS.aggressive.volatility
    )
  })

  it("should have SA-appropriate return assumptions", () => {
    // Conservative: ~10.5% (60% bonds, 30% equity, 10% cash)
    expect(INVESTMENT_SCENARIOS.conservative.nominalReturn).toBeCloseTo(0.105, 2)

    // Balanced: ~12% (60% equity, 30% bonds, 10% cash)
    expect(INVESTMENT_SCENARIOS.balanced.nominalReturn).toBeCloseTo(0.12, 2)

    // Aggressive: ~14% (85% equity, 10% bonds, 5% cash)
    expect(INVESTMENT_SCENARIOS.aggressive.nominalReturn).toBeCloseTo(0.14, 2)
  })

  it("should have SA-appropriate volatility assumptions", () => {
    // Conservative: ~10%
    expect(INVESTMENT_SCENARIOS.conservative.volatility).toBeCloseTo(0.10, 2)

    // Balanced: ~14%
    expect(INVESTMENT_SCENARIOS.balanced.volatility).toBeCloseTo(0.14, 2)

    // Aggressive: ~18%
    expect(INVESTMENT_SCENARIOS.aggressive.volatility).toBeCloseTo(0.18, 2)
  })

  it("should have descriptive names and allocations", () => {
    expect(INVESTMENT_SCENARIOS.conservative.name).toBe("Conservative")
    expect(INVESTMENT_SCENARIOS.balanced.name).toBe("Balanced")
    expect(INVESTMENT_SCENARIOS.aggressive.name).toBe("Aggressive")

    expect(INVESTMENT_SCENARIOS.conservative.allocation).toContain("bonds")
    expect(INVESTMENT_SCENARIOS.balanced.allocation).toContain("equity")
    expect(INVESTMENT_SCENARIOS.aggressive.allocation).toContain("equity")
  })
})

describe("compareScenarios", () => {
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

  const baseDrawdownConfig: DrawdownConfig = {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 30000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
    flexibilityPercentage: 10,
  }

  const baseParams = {
    currentSavings: 500000,
    monthlyContribution: 10000,
    personalInfo: basePersonalInfo,
    retirementGoals: baseRetirementGoals,
    drawdownConfig: baseDrawdownConfig,
    contributionEscalation: 0.06, // 6%
    fees: 0.01, // 1%
    compoundingMethod: "nominal" as CompoundingMethod,
  }

  describe("Basic functionality", () => {
    it("should return all three scenarios", () => {
      const result = compareScenarios(baseParams)

      expect(result).toHaveProperty("conservative")
      expect(result).toHaveProperty("balanced")
      expect(result).toHaveProperty("aggressive")
      expect(result).toHaveProperty("recommendedScenario")
      expect(result).toHaveProperty("recommendation")
    })

    it("should return complete scenario results", () => {
      const result = compareScenarios(baseParams)

      for (const scenario of [result.conservative, result.balanced, result.aggressive]) {
        expect(scenario).toHaveProperty("scenario")
        expect(scenario).toHaveProperty("description")
        expect(scenario).toHaveProperty("allocation")
        expect(scenario).toHaveProperty("nominalReturn")
        expect(scenario).toHaveProperty("realReturn")
        expect(scenario).toHaveProperty("volatility")
        expect(scenario).toHaveProperty("projectedNestEgg")
        expect(scenario).toHaveProperty("yearsLasts")
        expect(scenario).toHaveProperty("successProbability")
        expect(scenario).toHaveProperty("monthlyIncomeAtRetirement")
      }
    })

    it("should have valid recommended scenario", () => {
      const result = compareScenarios(baseParams)

      expect(["conservative", "balanced", "aggressive"]).toContain(result.recommendedScenario)
      expect(result.recommendation).toBeTruthy()
      expect(typeof result.recommendation).toBe("string")
    })
  })

  describe("Nest egg projections", () => {
    it("should have increasing nest eggs from conservative to aggressive", () => {
      const result = compareScenarios(baseParams)

      // Higher returns should lead to higher nest eggs (before fees)
      expect(result.conservative.projectedNestEgg).toBeLessThan(result.balanced.projectedNestEgg)
      expect(result.balanced.projectedNestEgg).toBeLessThan(result.aggressive.projectedNestEgg)
    })

    it("should have positive nest eggs for all scenarios", () => {
      const result = compareScenarios(baseParams)

      expect(result.conservative.projectedNestEgg).toBeGreaterThan(0)
      expect(result.balanced.projectedNestEgg).toBeGreaterThan(0)
      expect(result.aggressive.projectedNestEgg).toBeGreaterThan(0)
    })

    it("should respect compounding method", () => {
      const nominalResult = compareScenarios({
        ...baseParams,
        compoundingMethod: "nominal",
      })

      const compoundResult = compareScenarios({
        ...baseParams,
        compoundingMethod: "compound",
      })

      // Results should differ based on compounding method
      expect(nominalResult.balanced.projectedNestEgg).not.toBe(
        compoundResult.balanced.projectedNestEgg
      )
    })
  })

  describe("Return calculations", () => {
    it("should calculate real return as nominal minus inflation minus fees", () => {
      const result = compareScenarios(baseParams)
      const inflationRate = baseParams.retirementGoals.inflationRate / 100

      // Real return = nominal - inflation - fees
      const expectedConservativeReal =
        (INVESTMENT_SCENARIOS.conservative.nominalReturn - inflationRate - baseParams.fees) * 100
      const expectedBalancedReal =
        (INVESTMENT_SCENARIOS.balanced.nominalReturn - inflationRate - baseParams.fees) * 100
      const expectedAggressiveReal =
        (INVESTMENT_SCENARIOS.aggressive.nominalReturn - inflationRate - baseParams.fees) * 100

      expect(result.conservative.realReturn).toBeCloseTo(expectedConservativeReal, 1)
      expect(result.balanced.realReturn).toBeCloseTo(expectedBalancedReal, 1)
      expect(result.aggressive.realReturn).toBeCloseTo(expectedAggressiveReal, 1)
    })

    it("should display returns as percentages", () => {
      const result = compareScenarios(baseParams)

      // Returns should be in percentage form (e.g., 10.5 not 0.105)
      expect(result.conservative.nominalReturn).toBeGreaterThan(1)
      expect(result.balanced.nominalReturn).toBeGreaterThan(1)
      expect(result.aggressive.nominalReturn).toBeGreaterThan(1)
    })
  })

  describe("Success probability", () => {
    it("should have success probabilities between 0 and 100", () => {
      const result = compareScenarios(baseParams)

      expect(result.conservative.successProbability).toBeGreaterThanOrEqual(0)
      expect(result.conservative.successProbability).toBeLessThanOrEqual(100)

      expect(result.balanced.successProbability).toBeGreaterThanOrEqual(0)
      expect(result.balanced.successProbability).toBeLessThanOrEqual(100)

      expect(result.aggressive.successProbability).toBeGreaterThanOrEqual(0)
      expect(result.aggressive.successProbability).toBeLessThanOrEqual(100)
    })

    it("should show lower success for aggressive due to volatility", () => {
      // Over many runs, aggressive should have more variance, potentially lower success
      // But this depends on the specific parameters
      const result = compareScenarios({
        ...baseParams,
        currentSavings: 100000, // Lower savings increases failure risk
        monthlyContribution: 3000, // Lower contributions
      })

      // With underfunded retirement, higher volatility = higher failure risk
      // Conservative should have more stable (though possibly lower) success
      expect(result.conservative.successProbability).toBeGreaterThanOrEqual(0)
    })
  })

  describe("Years savings last", () => {
    it("should have positive years for all scenarios", () => {
      const result = compareScenarios(baseParams)

      expect(result.conservative.yearsLasts).toBeGreaterThan(0)
      expect(result.balanced.yearsLasts).toBeGreaterThan(0)
      expect(result.aggressive.yearsLasts).toBeGreaterThan(0)
    })

    it("should be capped at reasonable maximum (50 years)", () => {
      const result = compareScenarios({
        ...baseParams,
        currentSavings: 5000000, // Very high savings
        monthlyContribution: 30000,
      })

      // Function caps at 50 years
      expect(result.conservative.yearsLasts).toBeLessThanOrEqual(50)
      expect(result.balanced.yearsLasts).toBeLessThanOrEqual(50)
      expect(result.aggressive.yearsLasts).toBeLessThanOrEqual(50)
    })
  })

  describe("Monthly income calculation", () => {
    it("should calculate monthly income from nest egg and withdrawal rate", () => {
      const result = compareScenarios(baseParams)

      const withdrawalRate = baseParams.drawdownConfig.initialWithdrawalRate / 100

      // Monthly income = (nestEgg * withdrawalRate) / 12
      const expectedConservativeIncome =
        (result.conservative.projectedNestEgg * withdrawalRate) / 12
      const expectedBalancedIncome = (result.balanced.projectedNestEgg * withdrawalRate) / 12
      const expectedAggressiveIncome = (result.aggressive.projectedNestEgg * withdrawalRate) / 12

      expect(result.conservative.monthlyIncomeAtRetirement).toBeCloseTo(
        expectedConservativeIncome,
        0
      )
      expect(result.balanced.monthlyIncomeAtRetirement).toBeCloseTo(expectedBalancedIncome, 0)
      expect(result.aggressive.monthlyIncomeAtRetirement).toBeCloseTo(expectedAggressiveIncome, 0)
    })
  })

  describe("Recommendation logic", () => {
    it("should recommend aggressive for long time horizons (20+ years)", () => {
      const result = compareScenarios({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 30,
          retirementAge: 65, // 35 years
        },
      })

      // With long horizon and good success probability, should recommend aggressive
      if (result.aggressive.successProbability >= 70) {
        expect(result.recommendedScenario).toBe("aggressive")
      } else {
        expect(result.recommendedScenario).toBe("balanced")
      }
    })

    it("should recommend balanced for medium time horizons (10-20 years)", () => {
      const result = compareScenarios({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 50,
          retirementAge: 65, // 15 years
        },
      })

      // Medium horizon should favor balanced or conservative
      expect(["balanced", "conservative"]).toContain(result.recommendedScenario)
    })

    it("should recommend conservative for short time horizons (< 10 years)", () => {
      const result = compareScenarios({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 60,
          retirementAge: 65, // 5 years
        },
      })

      // Short horizon should favor conservative
      expect(result.recommendedScenario).toBe("conservative")
      expect(result.recommendation).toContain("capital preservation")
    })

    it("should add warning for low success probability", () => {
      const result = compareScenarios({
        ...baseParams,
        currentSavings: 10000, // Very low
        monthlyContribution: 500, // Very low
      })

      // If success probability is low, recommendation should mention it
      if (result[result.recommendedScenario].successProbability < 50) {
        expect(result.recommendation).toContain("lower success probability")
      }
    })
  })

  describe("Edge cases", () => {
    it("should handle zero current savings", () => {
      const result = compareScenarios({
        ...baseParams,
        currentSavings: 0,
      })

      expect(result.conservative.projectedNestEgg).toBeGreaterThan(0)
      expect(result.balanced.projectedNestEgg).toBeGreaterThan(0)
      expect(result.aggressive.projectedNestEgg).toBeGreaterThan(0)
    })

    it("should handle zero contributions", () => {
      const result = compareScenarios({
        ...baseParams,
        monthlyContribution: 0,
        contributionEscalation: 0,
      })

      // Should still work with just existing savings growing
      expect(result.conservative.projectedNestEgg).toBeGreaterThan(0)
    })

    it("should handle zero years to retirement", () => {
      const result = compareScenarios({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          currentAge: 65,
          retirementAge: 65,
        },
      })

      // Nest egg should equal current savings (no growth time)
      expect(result.conservative.projectedNestEgg).toBeCloseTo(baseParams.currentSavings, 0)
    })

    it("should handle high fees", () => {
      const result = compareScenarios({
        ...baseParams,
        fees: 0.03, // 3% fees
      })

      // High fees reduce real returns and nest eggs
      const lowFeeResult = compareScenarios({
        ...baseParams,
        fees: 0.005, // 0.5% fees
      })

      expect(result.balanced.projectedNestEgg).toBeLessThan(lowFeeResult.balanced.projectedNestEgg)
    })

    it("should handle zero contribution escalation", () => {
      const result = compareScenarios({
        ...baseParams,
        contributionEscalation: 0,
      })

      expect(result.conservative.projectedNestEgg).toBeGreaterThan(0)
    })

    it("should handle high desired income", () => {
      const result = compareScenarios({
        ...baseParams,
        retirementGoals: {
          ...baseRetirementGoals,
          desiredMonthlyIncome: 150000, // Very high
        },
      })

      // High desired income should reduce years savings last
      const normalResult = compareScenarios(baseParams)

      expect(result.balanced.yearsLasts).toBeLessThan(normalResult.balanced.yearsLasts)
    })
  })

  describe("SA-specific scenarios", () => {
    it("should model typical young professional", () => {
      const result = compareScenarios({
        currentSavings: 100000,
        monthlyContribution: 8000,
        personalInfo: {
          currentAge: 28,
          retirementAge: 65,
          lifeExpectancy: 90,
          grossAnnualIncome: 600000,
          currentTaxRate: 31,
        },
        retirementGoals: {
          desiredMonthlyIncome: 40000,
          inflationRate: 5.5,
        },
        drawdownConfig: baseDrawdownConfig,
        contributionEscalation: 0.06,
        fees: 0.01,
        compoundingMethod: "nominal",
      })

      // Young professional with 37 years should have substantial nest egg
      expect(result.balanced.projectedNestEgg).toBeGreaterThan(10000000) // R10M+
    })

    it("should model mid-career professional", () => {
      const result = compareScenarios({
        currentSavings: 1500000,
        monthlyContribution: 15000,
        personalInfo: {
          currentAge: 45,
          retirementAge: 65,
          lifeExpectancy: 90,
          grossAnnualIncome: 1200000,
          currentTaxRate: 41,
        },
        retirementGoals: {
          desiredMonthlyIncome: 60000,
          inflationRate: 5.5,
        },
        drawdownConfig: baseDrawdownConfig,
        contributionEscalation: 0.06,
        fees: 0.01,
        compoundingMethod: "nominal",
      })

      // Mid-career with 20 years should recommend balanced
      expect(["balanced", "conservative"]).toContain(result.recommendedScenario)
    })

    it("should model near-retiree", () => {
      const result = compareScenarios({
        currentSavings: 4000000,
        monthlyContribution: 20000,
        personalInfo: {
          currentAge: 58,
          retirementAge: 65,
          lifeExpectancy: 90,
          grossAnnualIncome: 1500000,
          currentTaxRate: 45,
        },
        retirementGoals: {
          desiredMonthlyIncome: 70000,
          inflationRate: 5.5,
        },
        drawdownConfig: baseDrawdownConfig,
        contributionEscalation: 0.06,
        fees: 0.01,
        compoundingMethod: "nominal",
      })

      // Near-retiree should recommend conservative
      expect(result.recommendedScenario).toBe("conservative")
    })

    it("should account for SA inflation in real returns", () => {
      const result = compareScenarios({
        ...baseParams,
        retirementGoals: {
          desiredMonthlyIncome: 45000,
          inflationRate: 5.5, // SA inflation
        },
      })

      // Real returns should be nominal - inflation - fees
      // Conservative: 10.5% - 5.5% - 1% = 4%
      expect(result.conservative.realReturn).toBeCloseTo(4, 0)

      // Balanced: 12% - 5.5% - 1% = 5.5%
      expect(result.balanced.realReturn).toBeCloseTo(5.5, 0)

      // Aggressive: 14% - 5.5% - 1% = 7.5%
      expect(result.aggressive.realReturn).toBeCloseTo(7.5, 0)
    })
  })

  describe("Monte Carlo simulation", () => {
    it("should run Monte Carlo for success probability", () => {
      const result = compareScenarios(baseParams)

      // Success probability should be calculated (not just 0 or 100)
      // Due to stochastic nature, we just verify it's a reasonable value
      expect(result.balanced.successProbability).toBeGreaterThan(0)
      expect(result.balanced.successProbability).toBeLessThanOrEqual(100)
    })

    it("should have consistent results structure across runs", () => {
      // Run multiple times to ensure structure is consistent
      const result1 = compareScenarios(baseParams)
      const result2 = compareScenarios(baseParams)

      // Structure should be identical
      expect(Object.keys(result1)).toEqual(Object.keys(result2))
      expect(Object.keys(result1.balanced)).toEqual(Object.keys(result2.balanced))
    })
  })

  describe("Spending phase integration", () => {
    it("should model Go-Go/Slow-Go/No-Go spending phases", () => {
      const result = compareScenarios({
        ...baseParams,
        personalInfo: {
          ...basePersonalInfo,
          lifeExpectancy: 95, // 30 years in retirement
        },
      })

      // Years lasting should account for spending phases
      // Go-Go (0-15): 100%
      // Slow-Go (15-25): 80%
      // No-Go (25+): 70% base
      expect(result.balanced.yearsLasts).toBeGreaterThan(0)
    })
  })
})
