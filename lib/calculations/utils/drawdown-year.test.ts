import { describe, expect, it } from "vite-plus/test"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import type { AccountType } from "@/types"
import { calculateMonthlyReturn } from "./projection"
import {
  isPensionType,
  monthlyWithdrawalFactors,
  runDrawdownYear,
  type DrawdownPot,
} from "./drawdown-year"

const LA_MIN = SA_TAX_LIMITS.livingAnnuityMinDrawdownRate
const LA_MAX = SA_TAX_LIMITS.livingAnnuityMaxDrawdownRate

/** Independent reference: twelve month-ends of growth followed by one-twelfth of the income. */
function monthByMonth(balance: number, monthlyRate: number, annualWithdrawal: number): number {
  let b = balance
  for (let m = 0; m < 12; m++) b = b * (1 + monthlyRate) - annualWithdrawal / 12
  return b
}

const pot = (type: AccountType, balance: number, costBasis = balance): DrawdownPot => ({
  type,
  balance,
  costBasis,
})

describe("monthlyWithdrawalFactors", () => {
  describe("Compounding methods", () => {
    it.each([
      ["nominal", 0.12],
      ["compound", 0.12],
      ["nominal", -0.3],
      ["compound", 0.055],
    ] as const)("%s %s: closed form equals the month-by-month loop", (method, annual) => {
      const i = calculateMonthlyReturn(annual, method)
      const { growthFactor, withdrawalFactor } = monthlyWithdrawalFactors(i)
      expect(1_000_000 * growthFactor - 60_000 * withdrawalFactor).toBeCloseTo(
        monthByMonth(1_000_000, i, 60_000),
        6,
      )
    })

    it("compound 12% grows a balance by exactly 12% over the year", () => {
      const i = calculateMonthlyReturn(0.12, "compound")
      expect(monthlyWithdrawalFactors(i).growthFactor).toBeCloseTo(1.12, 12)
    })

    it("nominal 12% grows a balance by (1.01)^12 ≈ 12.68% over the year", () => {
      const i = calculateMonthlyReturn(0.12, "nominal")
      expect(monthlyWithdrawalFactors(i).growthFactor).toBeCloseTo(Math.pow(1.01, 12), 12)
    })
  })

  describe("Edge cases", () => {
    it("zero return: both factors are exactly 1", () => {
      expect(monthlyWithdrawalFactors(0)).toEqual({ growthFactor: 1, withdrawalFactor: 1 })
    })

    it("a -100% month wipes the balance; non-finite input is treated as 0%", () => {
      expect(monthlyWithdrawalFactors(-1).growthFactor).toBe(0)
      expect(monthlyWithdrawalFactors(-5).growthFactor).toBe(0)
      expect(monthlyWithdrawalFactors(Number.NaN)).toEqual({
        growthFactor: 1,
        withdrawalFactor: 1,
      })
    })
  })
})

describe("runDrawdownYear", () => {
  describe("Critical SA scenarios", () => {
    it("pays the compulsory 2.5% living annuity income even when no income is wanted", () => {
      const pots = [pot("retirement_annuity", 1_000_000)]
      const r = runDrawdownYear(pots, [0], 0, 0)
      expect(r.pensionWithdrawal).toBeCloseTo(1_000_000 * LA_MIN, 6)
      expect(r.shortfall).toBe(false)
      expect(pots[0].balance).toBeCloseTo(1_000_000 * (1 - LA_MIN), 6)
    })

    it("keeps the TFSA until the annuities reach their 17.5% ceiling", () => {
      const pots = [pot("retirement_annuity", 2_000_000), pot("tfsa", 500_000)]
      const r = runDrawdownYear(pots, [0, 0], 200_000, 0)
      // 2.5% minimum (R50,000), then more annuity income — R200,000 is under the R350,000
      // ceiling, so the TFSA is not touched
      expect(r.pensionWithdrawal).toBeCloseTo(200_000, 6)
      expect(r.tfsaWithdrawal).toBe(0)
      expect(r.shortfall).toBe(false)
    })

    it("pays the gap from the TFSA once the annuity is at its ceiling", () => {
      const pots = [pot("retirement_annuity", 1_000_000), pot("tfsa", 500_000)]
      const r = runDrawdownYear(pots, [0, 0], 250_000, 0)
      expect(r.pensionWithdrawal).toBeCloseTo(175_000, 6) // 17.5% of R1M
      expect(r.tfsaWithdrawal).toBeCloseTo(75_000, 6)
      expect(r.shortfall).toBe(false)
    })

    it("draws annuity income into the tax-free room before discretionary money", () => {
      // Room R100,000 (minimum R50,000 counts towards it), target R225,000:
      //   annuity R100,000 (minimum + R50,000 more), then discretionary R125,000
      const pots = [pot("retirement_annuity", 2_000_000), pot("discretionary", 1_000_000, 600_000)]
      const r = runDrawdownYear(pots, [0, 0], 225_000, 100_000)
      expect(r.pensionWithdrawal).toBeCloseTo(100_000, 6)
      expect(r.discretionaryWithdrawal).toBeCloseTo(125_000, 6)
      expect(r.capitalGainRealized).toBeCloseTo(125_000 * 0.4, 6)
    })

    it("the tax-free room never lifts an annuity past its ceiling, nor beyond the target", () => {
      const pots = [pot("retirement_annuity", 1_000_000), pot("tfsa", 1_000_000)]
      // Room R1M exceeds both the ceiling (R175,000) and the target (R120,000)
      const r = runDrawdownYear(pots, [0, 0], 120_000, 1_000_000)
      expect(r.pensionWithdrawal).toBeCloseTo(120_000, 6)
      expect(r.tfsaWithdrawal).toBe(0)
      const capped = [pot("retirement_annuity", 1_000_000), pot("tfsa", 1_000_000)]
      const r2 = runDrawdownYear(capped, [0, 0], 300_000, 1_000_000)
      expect(r2.pensionWithdrawal).toBeCloseTo(175_000, 6)
      expect(r2.tfsaWithdrawal).toBeCloseTo(125_000, 6)
    })

    it("a non-finite or negative tax-free room is treated as none", () => {
      const run = (room: number) =>
        runDrawdownYear(
          [pot("retirement_annuity", 2_000_000), pot("discretionary", 1_000_000)],
          [0, 0],
          200_000,
          room,
        )
      for (const room of [Number.NaN, -50_000]) {
        const r = run(room)
        expect(r.pensionWithdrawal).toBeCloseTo(50_000, 6) // the 2.5% minimum only
        expect(r.discretionaryWithdrawal).toBeCloseTo(150_000, 6)
      }
    })

    it("caps each living annuity at 17.5% of its start-of-year value and flags the shortfall", () => {
      const pots = [pot("preservation_fund", 1_000_000)]
      const r = runDrawdownYear(pots, [0.01], 400_000, 0)
      expect(r.pensionWithdrawal).toBeCloseTo(1_000_000 * LA_MAX, 6)
      expect(r.shortfall).toBe(true)
      // A capped annuity keeps a residual balance
      expect(pots[0].balance).toBeGreaterThan(0)
    })

    it("applies the band per annuity, not to their combined value", () => {
      const pots = [pot("pension_fund", 100_000), pot("retirement_annuity", 900_000)]
      const r = runDrawdownYear(pots, [0, 0], 1_000_000, 0)
      // 17.5% of each = 17,500 + 157,500
      expect(r.pensionWithdrawal).toBeCloseTo(175_000, 6)
      expect(pots[0].balance).toBeCloseTo(82_500, 6)
      expect(pots[1].balance).toBeCloseTo(742_500, 6)
    })

    it("beyond the tax-free room, uses discretionary money before more annuity income, and taxes only its gain", () => {
      // Discretionary R1M with a R600k cost base: 40% of every rand withdrawn is gain
      const pots = [pot("retirement_annuity", 1_000_000), pot("discretionary", 1_000_000, 600_000)]
      const r = runDrawdownYear(pots, [0, 0], 225_000, 0)
      expect(r.pensionWithdrawal).toBeCloseTo(25_000, 6)
      expect(r.discretionaryWithdrawal).toBeCloseTo(200_000, 6)
      expect(r.capitalGainRealized).toBeCloseTo(80_000, 6)
      expect(pots[1].costBasis).toBeCloseTo(480_000, 6)
    })

    it("a fully drained discretionary pot realises everything above its whole cost base", () => {
      const i = calculateMonthlyReturn(0.1, "nominal")
      const pots = [pot("discretionary", 100_000, 70_000)]
      const r = runDrawdownYear(pots, [i], 10_000_000, 0)
      expect(pots[0].balance).toBe(0)
      expect(pots[0].costBasis).toBe(0)
      expect(r.capitalGainRealized).toBeCloseTo(r.discretionaryWithdrawal - 70_000, 6)
    })
  })

  describe("Compounding methods", () => {
    it.each(["nominal", "compound"] as const)(
      "%s: a TFSA year matches the month-by-month reference",
      (method) => {
        const i = calculateMonthlyReturn(0.1, method)
        const pots = [pot("tfsa", 1_000_000)]
        const r = runDrawdownYear(pots, [i], 120_000, 0)
        expect(pots[0].balance).toBeCloseTo(monthByMonth(1_000_000, i, 120_000), 6)
        expect(r.tfsaWithdrawal).toBe(120_000)
      },
    )

    it("monthly withdrawals leave less than a year-end lump withdrawal would", () => {
      // R1M at 10% compound, R100k a year: year-end lump would leave exactly R1,000,000
      const i = calculateMonthlyReturn(0.1, "compound")
      const pots = [pot("tfsa", 1_000_000)]
      runDrawdownYear(pots, [i], 100_000, 0)
      expect(pots[0].balance).toBeLessThan(1_000_000)
      expect(pots[0].balance).toBeCloseTo(monthByMonth(1_000_000, i, 100_000), 6)
    })
  })

  describe("Edge cases", () => {
    it("drains a pot to exactly zero, never negative, and flags the shortfall", () => {
      const i = calculateMonthlyReturn(0.08, "compound")
      const pots = [pot("tfsa", 50_000)]
      const r = runDrawdownYear(pots, [i], 1_000_000, 0)
      expect(pots[0].balance).toBe(0)
      expect(r.shortfall).toBe(true)
      // The most R50k can pay in month-end instalments while compounding
      const { growthFactor, withdrawalFactor } = monthlyWithdrawalFactors(i)
      expect(r.tfsaWithdrawal).toBeCloseTo((50_000 * growthFactor) / withdrawalFactor, 6)
    })

    it("zero balances: nothing withdrawn, nothing grows, shortfall only when income was wanted", () => {
      const pots = [pot("tfsa", 0), pot("retirement_annuity", 0)]
      expect(runDrawdownYear(pots, [0.01, 0.01], 0, 0)).toMatchObject({
        tfsaWithdrawal: 0,
        pensionWithdrawal: 0,
        growth: 0,
        shortfall: false,
      })
      expect(runDrawdownYear(pots, [0.01, 0.01], 1000, 0).shortfall).toBe(true)
    })

    it("a negative or non-finite target is treated as zero", () => {
      const pots = [pot("tfsa", 1000)]
      expect(runDrawdownYear(pots, [0], -500, 0).tfsaWithdrawal).toBe(0)
      expect(runDrawdownYear(pots, [0], Number.NaN, 0).tfsaWithdrawal).toBe(0)
    })

    it("negative returns: still matches the month-by-month reference", () => {
      const i = calculateMonthlyReturn(-0.25, "nominal")
      const pots = [pot("tfsa", 1_000_000)]
      runDrawdownYear(pots, [i], 60_000, 0)
      expect(pots[0].balance).toBeCloseTo(monthByMonth(1_000_000, i, 60_000), 6)
    })

    it("conserves money: start + growth − withdrawals = end, across mixed pots", () => {
      const pots = [
        pot("retirement_annuity", 3_000_000),
        pot("tfsa", 400_000),
        pot("discretionary", 800_000, 500_000),
      ]
      const rates = [0.008, 0.007, 0.006]
      const start = pots.reduce((s, p) => s + p.balance, 0)
      const r = runDrawdownYear(pots, rates, 700_000, 0)
      const end = pots.reduce((s, p) => s + p.balance, 0)
      const withdrawn = r.tfsaWithdrawal + r.discretionaryWithdrawal + r.pensionWithdrawal
      expect(withdrawn).toBeCloseTo(700_000, 6)
      expect(start + r.growth - withdrawn).toBeCloseTo(end, 6)
    })
  })

  it("isPensionType covers exactly the three retirement-fund types", () => {
    expect(isPensionType("pension_fund")).toBe(true)
    expect(isPensionType("retirement_annuity")).toBe(true)
    expect(isPensionType("preservation_fund")).toBe(true)
    expect(isPensionType("tfsa")).toBe(false)
    expect(isPensionType("discretionary")).toBe(false)
  })
})
