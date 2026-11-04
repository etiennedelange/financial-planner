import { describe, expect, it } from "vite-plus/test"
import { SA_DEFAULTS } from "./defaults"
import {
  CAUTIOUS_VOLATILITY_FACTOR,
  INVESTMENT_TYPE_RISK,
  INVESTMENT_TYPES,
  type InvestmentType,
} from "./investment-types"

const risk = (t: InvestmentType) => INVESTMENT_TYPE_RISK[t]
const impliedCorrelation = (a: InvestmentType, b: InvestmentType) =>
  Math.sqrt(risk(a).factorLoading * risk(b).factorLoading)

describe("INVESTMENT_TYPE_RISK", () => {
  describe("Critical SA scenarios", () => {
    it("ranks volatility from cash to concentrated equity", () => {
      // The ordering a user expects, and the reason the types exist: one equity volatility
      // used to be applied to every account, cash and balanced funds included.
      const vols = INVESTMENT_TYPES.map((t) => risk(t).volatility)
      expect(vols).toEqual([...vols].sort((a, b) => a - b))
    })

    it("pins the researched rand volatilities (docs/history/2026-11-04-investment-type-risk-research.md)", () => {
      expect(risk("cash").volatility).toBe(0.006)
      expect(risk("conservative").volatility).toBe(0.05)
      expect(risk("balanced").volatility).toBe(0.091)
      expect(risk("sa_equity").volatility).toBe(0.16)
      expect(risk("global_equity").volatility).toBe(0.163)
      expect(risk("concentrated_equity").volatility).toBe(0.284)
    })

    it("the fitted equity loadings reproduce the measured rand correlations", () => {
      // Measured: SA ↔ global 0.56, SA ↔ Nasdaq 0.53, global ↔ Nasdaq 0.93 (annual log, rand)
      expect(impliedCorrelation("sa_equity", "global_equity")).toBeCloseTo(0.56, 1)
      expect(impliedCorrelation("sa_equity", "concentrated_equity")).toBeCloseTo(0.53, 1)
      expect(impliedCorrelation("global_equity", "concentrated_equity")).toBeCloseTo(0.93, 1)
    })

    it("SA equity's stress return is the 2008–09 category fall, worse than its worst calendar year", () => {
      // Worst rolling 12 months −37.6% vs the ALSI's worst calendar year (2008) of −23.2%
      expect(risk("sa_equity").stressReturn).toBe(-0.376)
      expect(risk("sa_equity").stressReturn).toBeLessThan(-0.232)
    })

    it("flags the stress returns that are calendar years, which understate a 12-month fall", () => {
      const understated = INVESTMENT_TYPES.filter((t) => risk(t).stressUnderstated)
      expect(understated).toEqual(["global_equity", "concentrated_equity"])
    })

    it("cash does not fall in the stress test", () => {
      expect(risk("cash").stressReturn).toBeGreaterThan(0)
    })
  })

  describe("Model constraints", () => {
    it.each(INVESTMENT_TYPES)(
      "%s: factor loading in [0, 1], volatility positive and plausible",
      (t) => {
        expect(risk(t).factorLoading).toBeGreaterThanOrEqual(0)
        expect(risk(t).factorLoading).toBeLessThanOrEqual(1)
        expect(risk(t).volatility).toBeGreaterThan(0)
        expect(risk(t).volatility).toBeLessThan(0.5)
      },
    )

    it.each(INVESTMENT_TYPES)(
      "%s: stress return above −100% and no worse than max drawdown",
      (t) => {
        const { stressReturn, maxDrawdown } = risk(t)
        expect(stressReturn).toBeGreaterThan(-1)
        if (maxDrawdown !== null) expect(maxDrawdown).toBeLessThanOrEqual(Math.min(0, stressReturn))
      },
    )

    it("cash is independent of the market; only the two fund types use assumed loadings", () => {
      expect(risk("cash").factorLoading).toBe(0)
      const assumed = INVESTMENT_TYPES.filter((t) => risk(t).factorLoadingAssumed)
      expect(assumed).toEqual(["conservative", "balanced"])
    })

    it("the cautious factor is the documented 1.3", () => {
      expect(CAUTIOUS_VOLATILITY_FACTOR).toBe(1.3)
    })
  })

  describe("Sources", () => {
    it.each(INVESTMENT_TYPES)(
      "%s: has sources, a verification date, and an honest secondary flag",
      (t) => {
        const { sources, verifiedOn, secondary } = risk(t)
        expect(sources.length).toBeGreaterThan(0)
        expect(verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        sources.forEach((s) => expect(s.url).toMatch(/^(https?:\/\/|scripts\/)/))
        expect(secondary).toBe(sources.some((s) => s.kind === "secondary"))
      },
    )
  })

  describe("Suggested returns", () => {
    it("derive from the app's SA defaults rather than history", () => {
      expect(risk("cash").suggestedReturn).toBe(6.5)
      expect(risk("sa_equity").suggestedReturn).toBe(SA_DEFAULTS.equityReturn * 100)
      expect(risk("global_equity").suggestedReturn).toBe(11)
      expect(risk("concentrated_equity").suggestedReturn).toBe(11)
      // 30/70 and 65/35 equity/bond blends of 11% and 8%
      expect(risk("conservative").suggestedReturn).toBe(8.9)
      // 9.95 rounds to 10, which also matches SA_DEFAULTS.defaultExpectedReturn for new accounts
      expect(risk("balanced").suggestedReturn).toBe(10)
      expect(risk("balanced").suggestedReturn).toBe(SA_DEFAULTS.defaultExpectedReturn)
    })

    it("never rise with risk beyond the equity default", () => {
      INVESTMENT_TYPES.forEach((t) =>
        expect(risk(t).suggestedReturn).toBeLessThanOrEqual(SA_DEFAULTS.equityReturn * 100),
      )
    })
  })

  describe("Edge cases", () => {
    it("lists every type exactly once", () => {
      expect(new Set(INVESTMENT_TYPES).size).toBe(INVESTMENT_TYPES.length)
      expect(Object.keys(INVESTMENT_TYPE_RISK).sort()).toEqual([...INVESTMENT_TYPES].sort())
    })

    it("has no floating-point tail on any suggested return", () => {
      INVESTMENT_TYPES.forEach((t) =>
        expect(String(risk(t).suggestedReturn)).not.toMatch(/\.\d{3,}/),
      )
    })
  })
})
