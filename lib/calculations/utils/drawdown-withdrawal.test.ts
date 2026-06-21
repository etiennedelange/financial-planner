import type { DrawdownConfig } from "@/types"
import { describe, expect, it } from "vitest"
import { calculateNextWithdrawal } from "./drawdown-withdrawal"

describe("calculateNextWithdrawal", () => {
  const baseConfig: DrawdownConfig = {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  }

  describe("fixed_percentage", () => {
    it("recomputes from the live balance each year (deterministic engine — no desired-income floor)", () => {
      const result = calculateNextWithdrawal(400000, 5000000, baseConfig, 1, 0.055)
      expect(result).toBeCloseTo(5000000 * 0.04, 5)
    })

    it("falls when the balance falls and rises when the balance rises", () => {
      const down = calculateNextWithdrawal(400000, 8000000, baseConfig, 1, 0.055)
      const up = calculateNextWithdrawal(400000, 12000000, baseConfig, 1, 0.055)
      expect(down).toBeLessThan(up)
      expect(down).toBeCloseTo(8000000 * 0.04, 5)
      expect(up).toBeCloseTo(12000000 * 0.04, 5)
    })

    it("uses the greater of percentage withdrawal and desired income when a Monte Carlo income floor is supplied", () => {
      // 4% of a small balance is far below a R30k/month desired income
      const result = calculateNextWithdrawal(
        100000,
        500000, // 4% = R20,000/year, well under desired income
        baseConfig,
        1,
        0.055,
        30000 // desired monthly income today
      )
      const desiredAnnualAtYear1 = 30000 * 12 * 1.055
      expect(result).toBeCloseTo(desiredAnnualAtYear1, 5)
    })

    it("uses the percentage when it exceeds the desired-income floor", () => {
      const result = calculateNextWithdrawal(
        100000,
        10000000, // 4% = R400,000/year, well above desired income
        baseConfig,
        1,
        0.055,
        10000
      )
      expect(result).toBeCloseTo(10000000 * 0.04, 5)
    })
  })

  describe("fixed_amount_inflation_adjusted", () => {
    it("inflates the previous withdrawal by CPI regardless of balance", () => {
      const config: DrawdownConfig = { ...baseConfig, strategy: "fixed_amount_inflation_adjusted" }
      const result = calculateNextWithdrawal(300000, 1, config, 1, 0.055)
      expect(result).toBeCloseTo(300000 * 1.055, 5)
    })
  })

  describe("variable_percentage", () => {
    const config: DrawdownConfig = { ...baseConfig, strategy: "variable_percentage" }

    it("withdraws a percentage of the live balance when within min/max bounds", () => {
      const result = calculateNextWithdrawal(400000, 5000000, config, 1, 0.055)
      expect(result).toBeCloseTo(5000000 * 0.04, 5)
    })

    it("clamps to the inflation-adjusted minimum when the percentage falls below it", () => {
      const result = calculateNextWithdrawal(400000, 100000, config, 1, 0.055)
      const minAtYear1 = config.minimumWithdrawal * 1.055 * 12
      expect(result).toBeCloseTo(minAtYear1, 5)
      expect(result).toBeGreaterThan(100000 * 0.04)
    })

    it("clamps to the inflation-adjusted maximum when the percentage exceeds it", () => {
      const result = calculateNextWithdrawal(400000, 50000000, config, 1, 0.055)
      const maxAtYear1 = config.maximumWithdrawal * 1.055 * 12
      expect(result).toBeCloseTo(maxAtYear1, 5)
      expect(result).toBeLessThan(50000000 * 0.04)
    })

    it("re-clamps every year, not just at year 0", () => {
      const resultYear5 = calculateNextWithdrawal(400000, 100000, config, 5, 0.055)
      const minAtYear5 = config.minimumWithdrawal * Math.pow(1.055, 5) * 12
      expect(resultYear5).toBeCloseTo(minAtYear5, 5)
    })
  })

  describe("guardrails", () => {
    const config: DrawdownConfig = {
      ...baseConfig,
      strategy: "guardrails",
      upperGuardrail: 20,
      lowerGuardrail: 20,
    }

    it("inflates by CPI when the withdrawal rate is within the guardrail band", () => {
      // previous withdrawal / balance == 4% == target rate, well inside +/-20% bands
      const result = calculateNextWithdrawal(400000, 10000000, config, 1, 0.055)
      expect(result).toBeCloseTo(400000 * 1.055, 5)
    })

    it("cuts the withdrawal by 10% when the rate breaches the upper guardrail (capital preservation)", () => {
      // 400,000 / 4,000,000 = 10% actual rate vs 4% target — well above the 20% upper band (4.8%)
      const result = calculateNextWithdrawal(400000, 4000000, config, 1, 0.055)
      expect(result).toBeCloseTo(400000 * 0.9, 5)
    })

    it("raises the withdrawal by 10% when the rate breaches the lower guardrail (prosperity rule)", () => {
      // 400,000 / 20,000,000 = 2% actual rate vs 4% target — well below the 20% lower band (3.2%)
      const result = calculateNextWithdrawal(400000, 20000000, config, 1, 0.055)
      expect(result).toBeCloseTo(400000 * 1.1, 5)
    })

    it("falls back to a 20% default band when upper/lowerGuardrail are not configured", () => {
      const noBandConfig: DrawdownConfig = { ...baseConfig, strategy: "guardrails" }
      const result = calculateNextWithdrawal(400000, 4000000, noBandConfig, 1, 0.055)
      expect(result).toBeCloseTo(400000 * 0.9, 5)
    })

    it("still clamps the adjusted withdrawal to the inflation-adjusted min/max", () => {
      const tightConfig: DrawdownConfig = {
        ...config,
        minimumWithdrawal: 50000, // R600k/year floor, above the would-be 10% cut result
      }
      const result = calculateNextWithdrawal(400000, 4000000, tightConfig, 1, 0.055)
      const minAtYear1 = tightConfig.minimumWithdrawal * 1.055 * 12
      expect(result).toBeCloseTo(minAtYear1, 5)
    })
  })
})
