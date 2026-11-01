import { describe, expect, it } from "vite-plus/test"
import {
  DEFAULT_TAX_THRESHOLD_RELIEF,
  HISTORICAL_CPI_RATE,
  HISTORICAL_RELIEF_SHARE,
  describeTaxReliefAssumption,
  resolveTaxThresholdIndexation,
} from "./tax-relief"

// Hand arithmetic from the published SARS figures, 2016/17 → 2026/27 (10 years), and the
// decade's CPI: Π(1 + cpi) = 1.6092 → 4.873% a year.
const cpi = Math.pow(1.6092, 1 / 10) - 1
const growth = (from: number, to: number) => Math.pow(to / from, 1 / 10) - 1

describe("historical tax relief", () => {
  describe("Critical SA scenarios", () => {
    it("CPI over 2016–2025 averages about 4.87% a year", () => {
      expect(HISTORICAL_CPI_RATE).toBeCloseTo(cpi, 4)
    })

    it("income tax tables kept about 57% of inflation (rebate, 18% bracket, medical credit)", () => {
      const expected =
        (growth(13500, 17820) / cpi + growth(188000, 245100) / cpi + growth(286, 376) / cpi) / 3
      expect(HISTORICAL_RELIEF_SHARE.incomeTax).toBeCloseTo(expected, 3)
      expect(HISTORICAL_RELIEF_SHARE.incomeTax).toBeCloseTo(0.57, 1)
    })

    it("the R550k lump-sum band kept only about 20% of inflation", () => {
      expect(HISTORICAL_RELIEF_SHARE.lumpSum).toBeCloseTo(growth(500000, 550000) / cpi, 3)
      expect(HISTORICAL_RELIEF_SHARE.lumpSum).toBeCloseTo(0.2, 1)
    })

    it("the s11F cap kept about 43% and the CGT exclusion about 46%", () => {
      expect(HISTORICAL_RELIEF_SHARE.retirementDeductionCap).toBeCloseTo(
        growth(350000, 430000) / cpi,
        3,
      )
      expect(HISTORICAL_RELIEF_SHARE.cgtExclusion).toBeCloseTo(growth(40000, 50000) / cpi, 3)
    })

    it("historical relief scales with the PLAN's inflation, not historical CPI", () => {
      const at5 = resolveTaxThresholdIndexation("historical", 0.055)
      const at8 = resolveTaxThresholdIndexation("historical", 0.08)
      expect(at5.incomeTax).toBeCloseTo(HISTORICAL_RELIEF_SHARE.incomeTax * 0.055, 12)
      expect(at8.incomeTax / at5.incomeTax).toBeCloseTo(0.08 / 0.055, 12)
    })
  })

  describe("Relief settings", () => {
    it("full: every group grows at the plan's inflation", () => {
      expect(resolveTaxThresholdIndexation("full", 0.055)).toEqual({
        incomeTax: 0.055,
        lumpSum: 0.055,
        retirementDeductionCap: 0.055,
        cgtExclusion: 0.055,
      })
    })

    it("none: nothing grows", () => {
      expect(resolveTaxThresholdIndexation("none", 0.055)).toEqual({
        incomeTax: 0,
        lumpSum: 0,
        retirementDeductionCap: 0,
        cgtExclusion: 0,
      })
    })

    it("historical always sits between none and full", () => {
      const h = resolveTaxThresholdIndexation("historical", 0.055)
      for (const rate of Object.values(h)) {
        expect(rate).toBeGreaterThan(0)
        expect(rate).toBeLessThan(0.055)
      }
    })
  })

  describe("Edge cases", () => {
    it("a plan saved before the setting existed (undefined) uses historical", () => {
      expect(DEFAULT_TAX_THRESHOLD_RELIEF).toBe("historical")
      expect(resolveTaxThresholdIndexation(undefined, 0.055)).toEqual(
        resolveTaxThresholdIndexation("historical", 0.055),
      )
    })

    it("0% and non-finite inflation give no indexation under any setting", () => {
      for (const relief of ["historical", "full", "none"] as const) {
        expect(Object.values(resolveTaxThresholdIndexation(relief, 0))).toEqual([0, 0, 0, 0])
        expect(Object.values(resolveTaxThresholdIndexation(relief, Number.NaN))).toEqual([
          0, 0, 0, 0,
        ])
      }
    })
  })

  describe("describeTaxReliefAssumption", () => {
    it("historical quotes the bracket and lump-sum growth for the plan's inflation", () => {
      const text = describeTaxReliefAssumption("historical", 5.5)
      const h = resolveTaxThresholdIndexation("historical", 0.055)
      expect(text).toContain(`${(h.incomeTax * 100).toFixed(1)}% a year`)
      expect(text).toContain(`by ${(h.lumpSum * 100).toFixed(1)}%`)
      expect(text).toContain("2016/17 to 2026/27")
    })

    it("every setting warns that future tax cannot be known", () => {
      for (const relief of ["historical", "full", "none", undefined] as const) {
        expect(describeTaxReliefAssumption(relief, 5.5)).toContain("cannot be known")
      }
      expect(describeTaxReliefAssumption("none", 5.5)).toMatch(/^Stress test/)
    })
  })
})
