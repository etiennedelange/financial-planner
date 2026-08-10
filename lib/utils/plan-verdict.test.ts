import { describe, it, expect } from "vitest"
import { buildPlanVerdict } from "./plan-verdict"

describe("buildPlanVerdict", () => {
  it("returns a neutral verdict when there is no simulation result", () => {
    const verdict = buildPlanVerdict({ successRate: null, depletionAge: null })
    expect(verdict.tone).toBe("neutral")
    expect(verdict.headline.length).toBeGreaterThan(0)
  })

  it("returns a success verdict for a high success rate", () => {
    const verdict = buildPlanVerdict({ successRate: 95, depletionAge: null })
    expect(verdict.tone).toBe("success")
  })

  it("returns a success verdict at the excellent threshold", () => {
    const verdict = buildPlanVerdict({ successRate: 90, depletionAge: null })
    expect(verdict.tone).toBe("success")
  })

  it("returns a good verdict below excellent", () => {
    const verdict = buildPlanVerdict({ successRate: 80, depletionAge: null })
    expect(verdict.tone).toBe("good")
  })

  it("returns a warning verdict for a fair success rate", () => {
    const verdict = buildPlanVerdict({ successRate: 65, depletionAge: null })
    expect(verdict.tone).toBe("warning")
  })

  it("returns a danger verdict for a critical success rate", () => {
    const verdict = buildPlanVerdict({ successRate: 25, depletionAge: null })
    expect(verdict.tone).toBe("danger")
  })

  it("promotes the verdict to danger when income depletes", () => {
    const verdict = buildPlanVerdict({ successRate: 80, depletionAge: 78 })
    expect(verdict.tone).toBe("danger")
    expect(verdict.headline).toContain("78")
  })

  it("keeps the success tone when income lasts to life expectancy", () => {
    const verdict = buildPlanVerdict({ successRate: 95, depletionAge: 90 })
    expect(verdict.tone).toBe("success")
  })
})
