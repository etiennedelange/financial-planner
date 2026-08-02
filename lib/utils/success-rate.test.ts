import { describe, it, expect } from "vitest"
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
