import { describe, expect, it } from "vite-plus/test"
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from "@/types"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { calculateProjection, calculateProjectionWithDrawdownReturns } from "./projection-engine"
import { buildFirstYearStress, calculateStressTest, summariseStressOutcome } from "./stress-test"
import { calculateMonthlyReturn } from "./utils/projection"
import { monthlyWithdrawalFactors } from "./utils/drawdown-year"
import { UNTYPED_STRESS_RETURN } from "./utils/account-risk"

const account = (o: Partial<Account> = {}): Account => ({
  id: "1",
  name: "Account",
  provider: "",
  type: "tfsa",
  currentBalance: 1_000_000,
  monthlyContribution: 0,
  expectedReturn: 10,
  annualFees: 0,
  contributionEscalation: 0,
  ...o,
})
const person = (currentAge: number, retirementAge: number, lifeExpectancy = 90): PersonalInfo => ({
  currentAge,
  retirementAge,
  lifeExpectancy,
  annualIncome: 600_000,
})
const goals = (desiredMonthlyIncome: number, inflationRate = 5.5): RetirementGoals => ({
  desiredMonthlyIncome,
  inflationRate,
  legacyAmount: 0,
})
const fixedAmount: DrawdownConfig = {
  strategy: "fixed_amount_inflation_adjusted",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 0,
  maximumWithdrawal: 1e12,
  lumpSumPercentage: 0,
}
const compound = { compoundingMethod: "compound", equityVolatility: 16.5 } as never
const nominal = { compoundingMethod: "nominal", equityVolatility: 16.5 } as never

describe("calculateStressTest", () => {
  describe("Critical SA scenarios", () => {
    it("a 2008-style first year brings an SA equity plan's shortfall forward", () => {
      // R6M at 65 paying R40k/month: lasts with steady 10%, not after a −37.6% first year
      const plan = [
        account({ type: "discretionary", currentBalance: 6_000_000, investmentType: "sa_equity" }),
      ]
      const r = calculateStressTest(plan, person(65, 65), goals(40_000), fixedAmount, compound)
      expect(r.shocks[0].marketReturn).toBe(-0.376)
      expect(r.stressed.incomeGoalShortfallAge).not.toBeNull()
      if (r.steady.incomeGoalShortfallAge !== null) {
        expect(r.stressed.incomeGoalShortfallAge!).toBeLessThan(r.steady.incomeGoalShortfallAge)
      }
      expect(r.stressed.finalBalance).toBeLessThanOrEqual(r.steady.finalBalance)
    })

    it.each([
      ["SA equity", "sa_equity"],
      ["global equity", "global_equity"],
      ["balanced", "balanced"],
      ["concentrated equity", "concentrated_equity"],
    ] as const)(
      "%s: the stressed shortfall age is never later than the steady one",
      (_label, investmentType) => {
        const plan = [account({ type: "discretionary", currentBalance: 4_000_000, investmentType })]
        const r = calculateStressTest(plan, person(65, 65), goals(30_000), fixedAmount, compound)
        const never = Number.POSITIVE_INFINITY
        expect(r.stressed.incomeGoalShortfallAge ?? never).toBeLessThanOrEqual(
          r.steady.incomeGoalShortfallAge ?? never,
        )
        expect(r.stressed.finalBalance).toBeLessThanOrEqual(r.steady.finalBalance)
        expect(r.stressed.lowestIncomeShareOfGoal!).toBeLessThanOrEqual(
          r.steady.lowestIncomeShareOfGoal!,
        )
      },
    )

    it("typed and untyped accounts use the documented stress returns, net of fees", () => {
      const plan = [
        account({ id: "a", investmentType: "balanced", annualFees: 1 }),
        account({ id: "b", investmentType: "global_equity", annualFees: 0.4 }),
        account({ id: "c", expectedReturn: 11, annualFees: 1 }),
        account({ id: "d", expectedReturn: 0 }),
      ]
      const { shocks, overrides } = buildFirstYearStress(plan, 0.165)
      expect(shocks.map((s) => s.marketReturn)).toEqual([
        INVESTMENT_TYPE_RISK.balanced.stressReturn,
        INVESTMENT_TYPE_RISK.global_equity.stressReturn,
        UNTYPED_STRESS_RETURN,
        null,
      ])
      expect(overrides).toHaveLength(1)
      expect(overrides[0][0]).toBeCloseTo(-0.167 - 0.01, 12)
      expect(overrides[0][1]).toBeCloseTo(-0.196 - 0.004, 12)
      expect(overrides[0][2]).toBeCloseTo(-0.376 - 0.01, 12)
      expect(overrides[0][3]).toBeNull()
      expect(shocks[1].understated).toBe(true)
      expect(shocks[2].period).toMatch(/no investment type/)
      expect(shocks[3].period).toMatch(/cash/)
    })
  })

  describe("Compounding methods", () => {
    it.each([
      ["compound", compound],
      ["nominal", nominal],
    ] as const)("%s: no overrides reproduces calculateProjection exactly", (_m, assumptions) => {
      const plan = [account({ investmentType: "sa_equity" })]
      const a = calculateProjection(plan, person(55, 65), goals(20_000), fixedAmount, assumptions)
      const b = calculateProjectionWithDrawdownReturns(
        plan,
        person(55, 65),
        goals(20_000),
        fixedAmount,
        assumptions,
        [],
      )
      expect(b).toEqual(a)
    })

    it("a null override keeps the account's own return", () => {
      const plan = [account()]
      const a = calculateProjection(plan, person(65, 65), goals(5000), fixedAmount, nominal)
      const b = calculateProjectionWithDrawdownReturns(
        plan,
        person(65, 65),
        goals(5000),
        fixedAmount,
        nominal,
        [[null]],
      )
      expect(b).toEqual(a)
    })

    it("compound: an override equal to the account's own net return (a 0% shock) changes nothing", () => {
      // Under `compound` the engine converts r geometrically too, so the override is exact
      const plan = [account({ expectedReturn: 10, annualFees: 1 })]
      const a = calculateProjection(plan, person(65, 65), goals(6000), fixedAmount, compound)
      const b = calculateProjectionWithDrawdownReturns(
        plan,
        person(65, 65),
        goals(6000),
        fixedAmount,
        compound,
        [[0.09]],
      )
      expect(b.yearlyProjections.map((y) => y.endingBalance)).toEqual(
        a.yearlyProjections.map((y) => y.endingBalance),
      )
    })

    it.each([
      ["compound", compound],
      ["nominal", nominal],
    ] as const)(
      "%s: a −40% year-0 shock gives the hand-computed ending balance",
      (_m, assumptions) => {
        // R1M TFSA (no tax), retired at 65, R5,000/month → W = R60,000 in year 0.
        // The override converts geometrically under BOTH methods, so year 0 returns −40%:
        //   ending = B · (1 + i)^12 − W · ((1 + i)^12 − 1) / (12i),  i = 0.6^(1/12) − 1
        const r = calculateProjectionWithDrawdownReturns(
          [account()],
          person(65, 65),
          goals(5000),
          fixedAmount,
          assumptions,
          [[-0.4]],
        )
        const i = calculateMonthlyReturn(-0.4, "compound")
        const { growthFactor, withdrawalFactor } = monthlyWithdrawalFactors(i)
        expect(growthFactor).toBeCloseTo(0.6, 12)
        const year0 = r.yearlyProjections[0]
        expect(year0.withdrawals).toBeCloseTo(60_000, 6)
        expect(year0.endingBalance).toBeCloseTo(1_000_000 * 0.6 - 60_000 * withdrawalFactor, 4)
        // Year 1 returns to the account's own 10%: ending > start less the withdrawal
        expect(r.yearlyProjections[1].endingBalance).toBeGreaterThan(
          year0.endingBalance - r.yearlyProjections[1].withdrawals,
        )
      },
    )
  })

  describe("Edge cases", () => {
    it("a plan that retires later shocks only the first RETIREMENT year, not accumulation", () => {
      const plan = [account({ investmentType: "sa_equity" })]
      const r = calculateStressTest(plan, person(55, 65), goals(5000), fixedAmount, compound)
      const steady = calculateProjection(plan, person(55, 65), goals(5000), fixedAmount, compound)
      const stressed = calculateProjectionWithDrawdownReturns(
        plan,
        person(55, 65),
        goals(5000),
        fixedAmount,
        compound,
        buildFirstYearStress(plan, 0.165).overrides,
      )
      expect(stressed.portfolioAtRetirement).toBe(steady.portfolioAtRetirement)
      expect(stressed.yearlyProjections[10].endingBalance).toBeLessThan(
        steady.yearlyProjections[10].endingBalance,
      )
      expect(r.retirementAge).toBe(65)
    })

    it("no income goal reports no shortfall and no income share", () => {
      const r = calculateStressTest([account()], person(65, 65), goals(0), fixedAmount, compound)
      expect(r.steady.incomeGoalShortfallAge).toBeNull()
      expect(r.stressed.lowestIncomeShareOfGoal).toBeNull()
    })

    it("zero balance: both outcomes are zero and the goal is never met", () => {
      const r = calculateStressTest(
        [account({ currentBalance: 0 })],
        person(65, 65),
        goals(10_000),
        fixedAmount,
        compound,
      )
      expect(r.steady.finalBalance).toBe(0)
      expect(r.stressed.finalBalance).toBe(0)
      expect(r.stressed.lowestIncomeShareOfGoal).toBe(0)
      expect(r.stressed.incomeGoalShortfallAge).toBe(65)
    })

    it("an override below −100% is clamped, so balances stay finite and non-negative", () => {
      const r = calculateProjectionWithDrawdownReturns(
        [account()],
        person(65, 65),
        goals(1000),
        fixedAmount,
        compound,
        [[-3]],
      )
      r.yearlyProjections.forEach((y) => {
        expect(Number.isFinite(y.endingBalance)).toBe(true)
        expect(y.endingBalance).toBeGreaterThanOrEqual(0)
      })
    })

    it("a non-finite override is ignored", () => {
      const plan = [account()]
      const a = calculateProjection(plan, person(65, 65), goals(5000), fixedAmount, compound)
      const b = calculateProjectionWithDrawdownReturns(
        plan,
        person(65, 65),
        goals(5000),
        fixedAmount,
        compound,
        [[Number.NaN]],
      )
      expect(b).toEqual(a)
    })

    it("summariseStressOutcome deflates the final balance to today's rands", () => {
      const p = calculateProjection(
        [account()],
        person(65, 65, 75),
        goals(0),
        fixedAmount,
        compound,
      )
      const s = summariseStressOutcome(p, person(65, 65, 75), goals(0))
      expect(s.finalBalanceToday).toBeCloseTo(s.finalBalance / Math.pow(1.055, 10), 4)
    })

    it("works with no assumptions (default equity volatility, nominal)", () => {
      const r = calculateStressTest(
        [account({ expectedReturn: 11 })],
        person(65, 65),
        goals(5000),
        fixedAmount,
        undefined,
      )
      expect(r.shocks[0].marketReturn).toBe(UNTYPED_STRESS_RETURN)
    })
  })
})
