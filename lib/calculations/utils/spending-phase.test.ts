import { describe, it, expect } from "vitest"
import { getSpendingPhaseMultiplier } from "./spending-phase"

describe("getSpendingPhaseMultiplier", () => {
  describe("Go-Go phase (years 0-15)", () => {
    it("should return 1.0 for year 0", () => {
      expect(getSpendingPhaseMultiplier(0)).toBe(1.0)
    })

    it("should return 1.0 for year 5", () => {
      expect(getSpendingPhaseMultiplier(5)).toBe(1.0)
    })

    it("should return 1.0 for year 10", () => {
      expect(getSpendingPhaseMultiplier(10)).toBe(1.0)
    })

    it("should return 1.0 for year 15 (boundary)", () => {
      expect(getSpendingPhaseMultiplier(15)).toBe(1.0)
    })
  })

  describe("Slow-Go phase (years 16-25)", () => {
    it("should return 0.8 for year 16", () => {
      expect(getSpendingPhaseMultiplier(16)).toBe(0.8)
    })

    it("should return 0.8 for year 20", () => {
      expect(getSpendingPhaseMultiplier(20)).toBe(0.8)
    })

    it("should return 0.8 for year 25 (boundary)", () => {
      expect(getSpendingPhaseMultiplier(25)).toBe(0.8)
    })
  })

  describe("No-Go phase (years 26+)", () => {
    it("should return 0.7 base for year 26", () => {
      // Base 0.7 + premium 0.15 * (26-25) / 10 = 0.7 + 0.015 = 0.715
      expect(getSpendingPhaseMultiplier(26)).toBeCloseTo(0.715, 5)
    })

    it("should return increasing values as years progress", () => {
      // Year 30: 0.7 + 0.15 * (30-25) / 10 = 0.7 + 0.075 = 0.775
      expect(getSpendingPhaseMultiplier(30)).toBeCloseTo(0.775, 5)
    })

    it("should return 0.85 at year 35", () => {
      // Year 35: 0.7 + 0.15 * (35-25) / 10 = 0.7 + 0.15 = 0.85
      expect(getSpendingPhaseMultiplier(35)).toBeCloseTo(0.85, 5)
    })

    it("should cap at 1.2 for very long retirements", () => {
      // Year 60: 0.7 + 0.15 * (60-25) / 10 = 0.7 + 0.525 = 1.225 -> capped at 1.2
      expect(getSpendingPhaseMultiplier(60)).toBe(1.2)
    })

    it("should cap at 1.2 for extreme cases", () => {
      expect(getSpendingPhaseMultiplier(100)).toBe(1.2)
    })
  })

  describe("Edge cases", () => {
    it("should handle negative years (treat as early retirement)", () => {
      // Negative years would be before retirement, but function should handle gracefully
      expect(getSpendingPhaseMultiplier(-1)).toBe(1.0)
    })

    it("should handle fractional years", () => {
      // 15.5 years - still in Go-Go phase boundary
      expect(getSpendingPhaseMultiplier(15.5)).toBe(0.8)
    })

    it("should handle exactly at phase transition boundaries", () => {
      expect(getSpendingPhaseMultiplier(15)).toBe(1.0) // End of Go-Go
      expect(getSpendingPhaseMultiplier(15.001)).toBe(0.8) // Start of Slow-Go
      expect(getSpendingPhaseMultiplier(25)).toBe(0.8) // End of Slow-Go
      expect(getSpendingPhaseMultiplier(25.001)).toBeCloseTo(0.70001, 4) // Start of No-Go
    })
  })

  describe("Medical premium calculation in No-Go phase", () => {
    it("should increase by 0.015 per year after year 25", () => {
      const year26 = getSpendingPhaseMultiplier(26)
      const year27 = getSpendingPhaseMultiplier(27)
      expect(year27 - year26).toBeCloseTo(0.015, 5)
    })

    it("should model SA medical inflation premium correctly", () => {
      // At year 35 (10 years into No-Go), premium should be 0.15
      // Total: 0.7 + 0.15 = 0.85
      const year35 = getSpendingPhaseMultiplier(35)
      expect(year35).toBeCloseTo(0.85, 5)
    })

    it("should reach cap at approximately year 58", () => {
      // 0.7 + 0.15 * (x-25) / 10 = 1.2
      // 0.15 * (x-25) / 10 = 0.5
      // (x-25) / 10 = 3.33
      // x = 58.33
      expect(getSpendingPhaseMultiplier(58)).toBeLessThan(1.2)
      expect(getSpendingPhaseMultiplier(59)).toBe(1.2)
    })
  })

  describe("Retirement planning scenarios", () => {
    it("should model typical 30-year retirement correctly", () => {
      // Person retires at 65, lives to 95 (30 years)
      const phases = {
        goGo: getSpendingPhaseMultiplier(5), // Age 70
        slowGo: getSpendingPhaseMultiplier(20), // Age 85
        noGo: getSpendingPhaseMultiplier(28), // Age 93
      }

      expect(phases.goGo).toBe(1.0)
      expect(phases.slowGo).toBe(0.8)
      expect(phases.noGo).toBeCloseTo(0.745, 3) // 0.7 + 0.15 * 3/10
    })

    it("should handle early retiree with 40-year retirement", () => {
      // Person retires at 55, lives to 95 (40 years)
      const year40 = getSpendingPhaseMultiplier(40)
      // 0.7 + 0.15 * (40-25) / 10 = 0.7 + 0.225 = 0.925
      expect(year40).toBeCloseTo(0.925, 3)
    })
  })
})
