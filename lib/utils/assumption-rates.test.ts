import { describe, expect, it } from "vite-plus/test"
import { ASSUMPTION_RATE_BOUNDS, sanitizeAssumptionRate } from "./assumption-rates"

describe("sanitizeAssumptionRate", () => {
  describe("Critical SA scenarios", () => {
    it("keeps SA-typical rates unchanged", () => {
      expect(sanitizeAssumptionRate(11, "equityReturn", 10)).toBe(11)
      expect(sanitizeAssumptionRate(8, "bondReturn", 7)).toBe(8)
      expect(sanitizeAssumptionRate(6.5, "cashReturn", 6)).toBe(6.5)
      expect(sanitizeAssumptionRate(5.5, "inflationRate", 5)).toBe(5.5)
    })

    it("replaces the out-of-range values the unvalidated form used to persist (issue #34)", () => {
      expect(sanitizeAssumptionRate(150000, "equityReturn", 11)).toBe(11)
      expect(sanitizeAssumptionRate(3000, "bondReturn", 8)).toBe(8)
      expect(sanitizeAssumptionRate(99999, "inflationRate", 5.5)).toBe(5.5)
    })
  })

  describe("Edge cases", () => {
    it("replaces a cleared field (NaN in memory, null once persisted as JSON)", () => {
      expect(sanitizeAssumptionRate(NaN, "inflationRate", 5.5)).toBe(5.5)
      expect(sanitizeAssumptionRate(null, "inflationRate", 5.5)).toBe(5.5)
      expect(sanitizeAssumptionRate(undefined, "equityReturn", 11)).toBe(11)
    })

    it("replaces non-numbers and infinities", () => {
      expect(sanitizeAssumptionRate("5.5", "inflationRate", 5)).toBe(5)
      expect(sanitizeAssumptionRate(Infinity, "cashReturn", 6)).toBe(6)
      expect(sanitizeAssumptionRate(-Infinity, "cashReturn", 6)).toBe(6)
    })

    it("treats the bounds as inclusive: 0% and each maximum are valid", () => {
      for (const field of Object.keys(ASSUMPTION_RATE_BOUNDS) as Array<
        keyof typeof ASSUMPTION_RATE_BOUNDS
      >) {
        const { min, max } = ASSUMPTION_RATE_BOUNDS[field]
        expect(sanitizeAssumptionRate(min, field, 1)).toBe(min)
        expect(sanitizeAssumptionRate(max, field, 1)).toBe(max)
        expect(sanitizeAssumptionRate(max + 0.01, field, 1)).toBe(1)
      }
    })

    it("replaces negative rates (deflation is outside the accepted input range)", () => {
      expect(sanitizeAssumptionRate(-1, "inflationRate", 5.5)).toBe(5.5)
    })
  })

  it("matches the documented form ranges", () => {
    expect(ASSUMPTION_RATE_BOUNDS).toEqual({
      equityReturn: { min: 0, max: 30 },
      bondReturn: { min: 0, max: 20 },
      cashReturn: { min: 0, max: 15 },
      inflationRate: { min: 0, max: 20 },
    })
  })
})
