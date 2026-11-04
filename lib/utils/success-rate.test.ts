import { describe, it, expect } from "vite-plus/test"
import {
  formatSuccessRange,
  getSuccessRateBand,
  SUCCESS_RATE_BANDS,
  successRange,
} from "./success-rate"
import { getSuccessRateStyle } from "./success-rate"

describe("getSuccessRateStyle", () => {
  it("returns Excellent for rate >= 90", () => {
    const style = getSuccessRateStyle(90)
    expect(style.label).toBe("Excellent")
    expect(style.text).toBe("text-chart-2")
    expect(style.bg).toBe("bg-[hsl(var(--chart-2))]")
    expect(style.border).toBe("border-[hsl(var(--chart-2))]")
  })

  it("returns Excellent for rate 100", () => {
    const style = getSuccessRateStyle(100)
    expect(style.label).toBe("Excellent")
  })

  it("returns Good for rate >= 75 and < 90", () => {
    const style = getSuccessRateStyle(75)
    expect(style.label).toBe("Good")
    expect(style.text).toBe("text-chart-4")
    expect(style.bg).toBe("bg-[hsl(var(--chart-4))]")
    expect(style.border).toBe("border-[hsl(var(--chart-4))]")
  })

  it("returns Good for rate 89", () => {
    const style = getSuccessRateStyle(89)
    expect(style.label).toBe("Good")
  })

  it("returns Fair for rate >= 60 and < 75", () => {
    const style = getSuccessRateStyle(60)
    expect(style.label).toBe("Fair")
    expect(style.text).toBe("text-warning")
    expect(style.bg).toBe("bg-[hsl(var(--warning))]")
    expect(style.border).toBe("border-[hsl(var(--warning))]")
  })

  it("returns Fair for rate 74", () => {
    const style = getSuccessRateStyle(74)
    expect(style.label).toBe("Fair")
  })

  it("returns At Risk for rate >= 40 and < 60", () => {
    const style = getSuccessRateStyle(40)
    expect(style.label).toBe("At Risk")
    expect(style.text).toBe("text-warning")
    expect(style.bg).toBe("bg-[hsl(var(--warning))]")
    expect(style.border).toBe("border-[hsl(var(--warning))]")
  })

  it("returns At Risk for rate 59", () => {
    const style = getSuccessRateStyle(59)
    expect(style.label).toBe("At Risk")
  })

  it("returns Critical for rate < 40", () => {
    const style = getSuccessRateStyle(39)
    expect(style.label).toBe("Critical")
    expect(style.text).toBe("text-destructive")
    expect(style.bg).toBe("bg-destructive")
    expect(style.border).toBe("border-destructive")
  })

  it("returns Critical for rate 0", () => {
    const style = getSuccessRateStyle(0)
    expect(style.label).toBe("Critical")
    expect(style.text).toBe("text-destructive")
  })
})

describe("SUCCESS_RATE_BANDS", () => {
  it("is ordered from the highest threshold down and ends with a catch-all", () => {
    const mins = SUCCESS_RATE_BANDS.map((b) => b.min)
    expect(mins).toEqual([...mins].sort((a, b) => b - a))
    expect(mins.at(-1)).toBe(-Infinity)
  })

  it("puts a NaN rate in the Critical band rather than throwing", () => {
    expect(getSuccessRateBand(Number.NaN).label).toBe("Critical")
  })
})

describe("successRange", () => {
  it("orders cautious and central low to high", () => {
    expect(successRange(82, 70)).toEqual({ low: 70, high: 82 })
  })

  it("still orders an inverted pair (adaptive strategies, sampling)", () => {
    expect(successRange(70, 72)).toEqual({ low: 70, high: 72 })
  })

  it("collapses to the central figure with no cautious result", () => {
    expect(successRange(82, null)).toEqual({ low: 82, high: 82 })
    expect(successRange(82, Number.NaN)).toEqual({ low: 82, high: 82 })
  })
})

describe("formatSuccessRange", () => {
  it("shows a range with an en dash", () => {
    expect(formatSuccessRange({ low: 70.4, high: 82.2 })).toBe("70–82%")
  })

  it("shows one figure when both ends round to the same percent (e.g. zero volatility)", () => {
    expect(formatSuccessRange({ low: 99.6, high: 100 })).toBe("100%")
    expect(formatSuccessRange({ low: 0, high: 0 })).toBe("0%")
  })
})
