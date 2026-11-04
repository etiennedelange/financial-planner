import { describe, expect, it } from "vite-plus/test"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { INVESTMENT_TYPES, type InvestmentType } from "@/types"
import { resolveAccountRisk, UNTYPED_RISK_GROUP, UNTYPED_STRESS_RETURN } from "./account-risk"

describe("resolveAccountRisk", () => {
  describe("Critical SA scenarios", () => {
    it("a Satrix Nasdaq 100 TFSA gets the concentrated-equity figures, not the global setting", () => {
      const risk = resolveAccountRisk(
        { expectedReturn: 12, investmentType: "concentrated_equity" },
        0.165,
      )
      expect(risk).toEqual({
        volatility: 0.284,
        factorLoading: 0.88,
        riskGroup: "concentrated_equity",
        investmentType: "concentrated_equity",
        stressReturn: -0.212,
      })
    })

    it.each(INVESTMENT_TYPES)("%s: uses its type's researched volatility and loading", (t) => {
      const risk = resolveAccountRisk({ expectedReturn: 10, investmentType: t }, 0.165)
      expect(risk.volatility).toBe(INVESTMENT_TYPE_RISK[t].volatility)
      expect(risk.factorLoading).toBe(INVESTMENT_TYPE_RISK[t].factorLoading)
      expect(risk.riskGroup).toBe(t)
    })
  })

  describe("Untyped accounts keep the pre-feature behaviour", () => {
    it("uses the global volatility and moves in lockstep with the market", () => {
      expect(resolveAccountRisk({ expectedReturn: 10 }, 0.165)).toEqual({
        volatility: 0.165,
        factorLoading: 1,
        riskGroup: UNTYPED_RISK_GROUP,
        investmentType: null,
        stressReturn: UNTYPED_STRESS_RETURN,
      })
    })

    it("a 0% expected return still marks a cash account with no volatility", () => {
      expect(resolveAccountRisk({ expectedReturn: 0 }, 0.165).volatility).toBe(0)
    })

    it("passes the caller's global volatility through unchanged, including 0", () => {
      expect(resolveAccountRisk({ expectedReturn: 10 }, 0).volatility).toBe(0)
      expect(resolveAccountRisk({ expectedReturn: 10 }, 0.25).volatility).toBe(0.25)
    })
  })

  describe("Edge cases", () => {
    it("a typed account ignores the 0% cash marker: the type is the more specific statement", () => {
      const risk = resolveAccountRisk({ expectedReturn: 0, investmentType: "sa_equity" }, 0.165)
      expect(risk.volatility).toBe(0.16)
    })

    it("an unknown stored value (e.g. a corrupt import) falls back to untyped", () => {
      const risk = resolveAccountRisk(
        { expectedReturn: 10, investmentType: "crypto" as InvestmentType },
        0.165,
      )
      expect(risk.riskGroup).toBe(UNTYPED_RISK_GROUP)
      expect(risk.volatility).toBe(0.165)
    })
  })

  describe("Stress return (historical stress test)", () => {
    it.each(INVESTMENT_TYPES)("%s: uses its type's researched stress return", (t) => {
      expect(
        resolveAccountRisk({ expectedReturn: 10, investmentType: t }, 0.165).stressReturn,
      ).toBe(INVESTMENT_TYPE_RISK[t].stressReturn)
    })

    it("an untyped equity account falls like SA equity (-37.6%)", () => {
      expect(UNTYPED_STRESS_RETURN).toBe(-0.376)
      expect(resolveAccountRisk({ expectedReturn: 11 }, 0.165).stressReturn).toBe(-0.376)
    })

    it("an untyped 0% (cash) account does not fall", () => {
      expect(resolveAccountRisk({ expectedReturn: 0 }, 0.165).stressReturn).toBeNull()
    })
  })
})
