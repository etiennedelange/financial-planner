import { describe, expect, it } from "vite-plus/test"
import type { Account } from "@/types"
import { computePortfolioTotals } from "./portfolio-totals"

const account = (o: Partial<Account>): Account => ({
  id: "a",
  name: "A",
  provider: "",
  type: "retirement_annuity",
  currentBalance: 0,
  monthlyContribution: 0,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 6,
  ...o,
})

describe("computePortfolioTotals", () => {
  describe("Critical SA scenarios", () => {
    it("weights return and fees by balance; averages escalation per account", () => {
      // R750k RA at 12% / 1.5% fees, R250k TFSA at 8% / 0.5% fees
      const totals = computePortfolioTotals([
        account({
          currentBalance: 750_000,
          monthlyContribution: 3000,
          expectedReturn: 12,
          annualFees: 1.5,
          contributionEscalation: 10,
        }),
        account({
          type: "tfsa",
          currentBalance: 250_000,
          monthlyContribution: 1000,
          expectedReturn: 8,
          annualFees: 0.5,
          contributionEscalation: 0,
        }),
      ])
      expect(totals.totalBalance).toBe(1_000_000)
      expect(totals.totalContribution).toBe(4000)
      expect(totals.weightedReturn).toBeCloseTo(0.75 * 0.12 + 0.25 * 0.08, 12) // 11%
      expect(totals.weightedFees).toBeCloseTo(0.75 * 0.015 + 0.25 * 0.005, 12) // 1.25%
      expect(totals.avgEscalation).toBeCloseTo(0.05, 12)
    })
  })

  describe("Edge cases", () => {
    it("zero balance falls back to 10% return and 1% fees", () => {
      const totals = computePortfolioTotals([account({ monthlyContribution: 2000 })])
      expect(totals.weightedReturn).toBe(0.1)
      expect(totals.weightedFees).toBe(0.01)
      expect(totals.totalContribution).toBe(2000)
    })

    it("no accounts: zero totals and the 6% default escalation", () => {
      expect(computePortfolioTotals([])).toEqual({
        totalBalance: 0,
        totalContribution: 0,
        weightedReturn: 0.1,
        weightedFees: 0.01,
        avgEscalation: 0.06,
      })
    })
  })
})
