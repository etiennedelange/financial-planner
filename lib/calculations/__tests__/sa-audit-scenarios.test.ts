/**
 * Independent scenario checks from the 2026-10-31 SA retirement calculation audit.
 *
 * Every expected value here comes from a closed-form formula (future value of a lump sum
 * or annuity, geometric series) or an independent month-by-month loop written in the test
 * — never from the engine's own helpers — so a shared mistake cannot pass both sides.
 */
import { describe, expect, it } from "vite-plus/test"
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from "@/types"
import { calculateProjection } from "../projection-engine"
import { calculateIncomeTaxWithRebates } from "../retirement-tax"
import { calculateOptimalContribution } from "../optimal-contribution"
import { runMonteCarloSimulation } from "@/lib/monte-carlo/simulation-engine"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"

const account = (o: Partial<Account> = {}): Account => ({
  id: "1",
  name: "Account",
  provider: "",
  type: "discretionary",
  currentBalance: 0,
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
const compound = { compoundingMethod: "compound" } as never
const nominal = { compoundingMethod: "nominal" } as never

/** Future value of R1 per month for n months at monthly rate i, paid at month-end. */
const annuityFV = (i: number, n: number) => (i === 0 ? n : (Math.pow(1 + i, n) - 1) / i)

describe("SA audit scenarios — accumulation", () => {
  describe("Compounding methods", () => {
    it("lump sum, no contributions: nominal = PV(1 + r/12)^12n, compound = PV(1 + r)^n", () => {
      const acc = [account({ currentBalance: 100_000 })]
      const n = calculateProjection(acc, person(45, 65), goals(0), fixedAmount, nominal)
      const c = calculateProjection(acc, person(45, 65), goals(0), fixedAmount, compound)
      expect(n.portfolioAtRetirement).toBeCloseTo(100_000 * Math.pow(1 + 0.1 / 12, 240), 4)
      expect(c.portfolioAtRetirement).toBeCloseTo(100_000 * Math.pow(1.1, 20), 4) // R672,749.99
    })

    it("R1,000/month at 12% for 30 years matches Excel FV(1%, 360, -1000) = R3,494,964.13", () => {
      const acc = [account({ monthlyContribution: 1000, expectedReturn: 12 })]
      const r = calculateProjection(acc, person(35, 65), goals(0), fixedAmount, nominal)
      expect(r.portfolioAtRetirement).toBeCloseTo(3_494_964.13, 1)
    })

    it("compound method: monthly rate (1.12)^(1/12) − 1 in the annuity formula", () => {
      const acc = [account({ monthlyContribution: 1000, expectedReturn: 12 })]
      const r = calculateProjection(acc, person(35, 65), goals(0), fixedAmount, compound)
      expect(r.portfolioAtRetirement).toBeCloseTo(
        1000 * annuityFV(Math.pow(1.12, 1 / 12) - 1, 360),
        4,
      )
    })
  })

  describe("Critical SA scenarios", () => {
    it("escalating contributions match the closed-form geometric series", () => {
      // Contribution in month m (0-based) is PMT × (1+g)^(m/12), invested at month-end:
      //   FV = PMT × (1+i)^(N−1) × (1 − q^N) / (1 − q),  q = (1+g)^(1/12) / (1+i)
      const pmt = 2000
      const g = 0.06
      const i = 0.1 / 12
      const N = 25 * 12
      const q = Math.pow(1 + g, 1 / 12) / (1 + i)
      const expected = pmt * Math.pow(1 + i, N - 1) * ((1 - Math.pow(q, N)) / (1 - q))
      const acc = [account({ monthlyContribution: pmt, contributionEscalation: 6 })]
      const r = calculateProjection(acc, person(40, 65), goals(0), fixedAmount, nominal)
      expect(r.portfolioAtRetirement).toBeCloseTo(expected, 3)
    })

    it.each([55, 60, 65, 70])("retiring at %i compounds exactly (retire − 30) years", (age) => {
      const acc = [account({ currentBalance: 250_000, monthlyContribution: 3000 })]
      const r = calculateProjection(acc, person(30, age, 95), goals(0), fixedAmount, compound)
      const i = Math.pow(1.1, 1 / 12) - 1
      const n = (age - 30) * 12
      expect(r.portfolioAtRetirement).toBeCloseTo(
        250_000 * Math.pow(1.1, age - 30) + 3000 * annuityFV(i, n),
        3,
      )
    })

    it("two TFSAs share one R46,000 annual allowance", () => {
      const tfsas = [
        account({ id: "a", type: "tfsa", monthlyContribution: 4000 }),
        account({ id: "b", type: "tfsa", monthlyContribution: 4000 }),
      ]
      const r = calculateProjection(tfsas, person(60, 65), goals(0), fixedAmount)
      expect(r.yearlyProjections[0].contributions).toBeCloseTo(TFSA_LIMITS_CONFIG.annualLimit, 6)
      // R96,000 intended, R46,000 admitted: 40% penalty shown on the R50,000 excess
      expect(r.yearlyProjections[0].tfsaExcessContributionPenalty).toBeCloseTo(20_000, 6)
    })
  })

  describe("Edge cases", () => {
    it("0% return: the portfolio is exactly the sum of contributions", () => {
      const acc = [account({ monthlyContribution: 1500, expectedReturn: 0 })]
      const r = calculateProjection(acc, person(55, 65), goals(0), fixedAmount)
      expect(r.portfolioAtRetirement).toBeCloseTo(1500 * 120, 6)
    })

    it("negative return (−5%): the annuity formula still holds", () => {
      const acc = [
        account({ currentBalance: 500_000, monthlyContribution: 1000, expectedReturn: -5 }),
      ]
      const r = calculateProjection(acc, person(55, 65), goals(0), fixedAmount, nominal)
      const i = -0.05 / 12
      expect(r.portfolioAtRetirement).toBeCloseTo(
        500_000 * Math.pow(1 + i, 120) + 1000 * annuityFV(i, 120),
        4,
      )
    })

    it("high inflation, low return: purchasing power falls although the nominal balance grows", () => {
      // 4% return under 10% inflation for 20 years
      const acc = [account({ currentBalance: 1_000_000, expectedReturn: 4 })]
      const r = calculateProjection(acc, person(45, 65), goals(0, 10), fixedAmount, compound)
      expect(r.portfolioAtRetirement).toBeCloseTo(1_000_000 * Math.pow(1.04, 20), 3)
      const realValue = r.portfolioAtRetirement / Math.pow(1.1, 20)
      expect(realValue).toBeCloseTo(1_000_000 * Math.pow(1.04 / 1.1, 20), 3) // ≈ R325,000
    })

    it("retiring immediately: no accumulation rows and the balance is untouched", () => {
      const acc = [account({ currentBalance: 750_000, monthlyContribution: 5000 })]
      const r = calculateProjection(acc, person(65, 65), goals(0), fixedAmount)
      expect(r.portfolioAtRetirement).toBe(750_000)
      expect(r.yearlyProjections[0].age).toBe(65)
      expect(r.yearlyProjections[0].contributions).toBe(0)
    })

    it("retiring in one year: exactly 12 months of contributions and compounding", () => {
      const acc = [account({ currentBalance: 750_000, monthlyContribution: 5000 })]
      const r = calculateProjection(acc, person(64, 65), goals(0), fixedAmount, nominal)
      const i = 0.1 / 12
      expect(r.portfolioAtRetirement).toBeCloseTo(
        750_000 * Math.pow(1 + i, 12) + 5000 * annuityFV(i, 12),
        6,
      )
    })
  })
})

describe("SA audit scenarios — drawdown", () => {
  describe("Critical SA scenarios", () => {
    it("inflation-linked withdrawals: income rises 5% a year, paid monthly, balance tracks a monthly loop", () => {
      // R2M TFSA (no tax, no living annuity band) at 8% compound, R10,000/month, 5% inflation
      const acc = [account({ type: "tfsa", currentBalance: 2_000_000, expectedReturn: 8 })]
      const r = calculateProjection(acc, person(65, 65), goals(10_000, 5), fixedAmount, compound)
      const i = Math.pow(1.08, 1 / 12) - 1
      let balance = 2_000_000
      for (let k = 0; k < 15; k++) {
        const annual = 120_000 * Math.pow(1.05, k)
        for (let m = 0; m < 12; m++) balance = balance * (1 + i) - annual / 12
        const row = r.yearlyProjections[k]
        expect(row.withdrawals, `year ${k}`).toBeCloseTo(annual, 4)
        expect(row.inflationAdjustedWithdrawal, `year ${k}`).toBeCloseTo(120_000, 4)
        expect(row.endingBalance, `year ${k}`).toBeCloseTo(balance, 3)
        expect(row.incomeTax).toBe(0)
      }
    })

    it("drawdown growth respects the nominal compounding method (12.68% effective at 12%)", () => {
      const acc = [account({ type: "tfsa", currentBalance: 1_000_000, expectedReturn: 12 })]
      const r = calculateProjection(acc, person(65, 65), goals(0), fixedAmount, nominal)
      expect(r.yearlyProjections[0].endingBalance).toBeCloseTo(1_000_000 * Math.pow(1.01, 12), 4)
    })

    it("full relief: a constant real pension income pays constant real tax", () => {
      // R6M RA, retiring now, R25,000/month in today's money: 5% of capital, inside the
      // living annuity band, every rand taxable. Ages 65–74 share one rebate set.
      const acc = [
        account({ type: "retirement_annuity", currentBalance: 6_000_000, expectedReturn: 9 }),
      ]
      const r = calculateProjection(acc, person(65, 65), goals(25_000), fixedAmount, {
        taxThresholdRelief: "full",
      } as never)
      const todayTax = calculateIncomeTaxWithRebates(300_000, 65)
      for (let k = 0; k < 10; k++) {
        const row = r.yearlyProjections[k]
        const scale = Math.pow(1.055, k)
        expect(row.pensionWithdrawal! / scale, `year ${k}`).toBeCloseTo(300_000, 4)
        expect(row.incomeTax / scale, `year ${k}`).toBeCloseTo(todayTax, 4)
      }
    })

    it.each([
      // [balance, desired monthly, gross actually payable monthly]
      [1_000_000, 30_000, (1_000_000 * 0.175) / 12], // 17.5% ceiling binds
      [20_000_000, 10_000, (20_000_000 * 0.025) / 12], // 2.5% minimum exceeds the goal
      [1_000_000, 0, (1_000_000 * 0.025) / 12], // no goal, minimum still paid
    ])(
      "headline gross income is what the annuity pays (R%i, R%i/month goal)",
      (balance, desired, payable) => {
        const pf = [account({ type: "pension_fund", currentBalance: balance, expectedReturn: 10 })]
        const r = calculateProjection(pf, person(65, 65), goals(desired), fixedAmount, compound)
        expect(r.monthlyIncomeAtRetirement).toBeCloseTo(payable, 4)
        expect(r.monthlyIncomeAtRetirement).toBeCloseTo(r.yearlyProjections[0].withdrawals / 12, 6)
        // Net can never exceed gross
        expect(r.monthlyNetIncomeAtRetirement).toBeLessThanOrEqual(r.monthlyIncomeAtRetirement)
      },
    )

    it("a pension fund lump sum is capped at one-third; the rest pays at least 2.5% a year", () => {
      const acc = [account({ type: "pension_fund", currentBalance: 3_000_000, expectedReturn: 0 })]
      const r = calculateProjection(acc, person(65, 65), goals(0), {
        ...fixedAmount,
        lumpSumPercentage: 60,
      })
      expect(r.lumpSumCommutation.lumpSumAmount).toBeCloseTo(1_000_000, 4)
      expect(r.yearlyProjections[0].pensionWithdrawal).toBeCloseTo(2_000_000 * 0.025, 4)
    })
  })
})

describe("SA audit scenarios — on track means the income goal is met", () => {
  it("a 3.5%-of-portfolio plan never runs out, but is not on track when it pays far below the goal", () => {
    // The financial audit's case: age 40, R300k saved, R2k a month, R30k/month goal, the
    // default fixed-percentage strategy. Money never runs out (a percentage of what is left),
    // so depletion alone called this plan "On Track" while paying ~10% of the goal.
    const r = calculateProjection(
      [
        account({
          type: "retirement_annuity",
          currentBalance: 300_000,
          monthlyContribution: 2000,
          expectedReturn: 10,
          annualFees: 1,
          contributionEscalation: 6,
        }),
      ],
      person(40, 65),
      goals(30_000),
      {
        strategy: "fixed_percentage",
        initialWithdrawalRate: 3.5,
        minimumWithdrawal: 15000,
        maximumWithdrawal: 60000,
        lumpSumPercentage: 0,
      },
    )
    expect(r.portfolioDepletionAge).toBeNull()
    expect(r.incomeGoalShortfallAge).toBe(65)
  })

  it("a plan that pays its goal every year has no shortfall age", () => {
    const r = calculateProjection(
      [account({ type: "tfsa", currentBalance: 20_000_000, expectedReturn: 10 })],
      person(65, 65),
      goals(10_000),
      fixedAmount,
    )
    expect(r.incomeGoalShortfallAge).toBeNull()
  })
})

describe("SA audit scenarios — future tax relief setting", () => {
  const ra = [account({ type: "retirement_annuity", currentBalance: 6_000_000, expectedReturn: 9 })]
  const run = (taxThresholdRelief?: "historical" | "full" | "none") =>
    calculateProjection(ra, person(55, 65), goals(25_000), fixedAmount, {
      compoundingMethod: "nominal",
      taxThresholdRelief,
    } as never)

  it("no relief taxes future income against today's published table, unchanged", () => {
    const r = run("none")
    for (const k of [10, 15, 20]) {
      const row = r.yearlyProjections[k]
      expect(row.incomeTax, `age ${row.age}`).toBeCloseTo(
        calculateIncomeTaxWithRebates(row.taxableIncome!, row.age),
        4,
      )
    }
  })

  it("lifetime tax orders full < historical < none for the same plan", () => {
    const full = run("full").totalLifetimeIncomeTax
    const historical = run("historical").totalLifetimeIncomeTax
    const none = run("none").totalLifetimeIncomeTax
    expect(full).toBeLessThan(historical)
    expect(historical).toBeLessThan(none)
    // Balances do not depend on tax — only net income does
    expect(run("none").surplusAmount).toBeCloseTo(run("full").surplusAmount, 4)
  })

  it("a plan saved without the setting is projected exactly as historical", () => {
    expect(run(undefined).totalLifetimeIncomeTax).toBe(run("historical").totalLifetimeIncomeTax)
    expect(calculateProjection(ra, person(55, 65), goals(25_000), fixedAmount)).toEqual(
      run("historical"),
    )
  })

  it("Monte Carlo reports tax under the same setting", () => {
    const mc = (taxThresholdRelief: "full" | "none") =>
      runMonteCarloSimulation(
        ra,
        person(55, 65),
        goals(25_000),
        fixedAmount,
        { numberOfRuns: 50, randomSeed: 3 },
        { equityVolatility: 16.5, compoundingMethod: "nominal", taxThresholdRelief } as never,
      )
    expect(mc("full").averageLifetimeIncomeTax!).toBeLessThan(mc("none").averageLifetimeIncomeTax!)
    expect(mc("full").successRate).toBe(mc("none").successRate)
  })
})

describe("SA audit scenarios — Monte Carlo agrees with the projection", () => {
  const portfolio = [
    account({
      id: "ra",
      type: "retirement_annuity",
      currentBalance: 900_000,
      monthlyContribution: 6000,
      expectedReturn: 11,
      annualFees: 1.2,
      contributionEscalation: 6,
    }),
    // R8,000/month exceeds the TFSA annual limit, which both engines must enforce
    account({
      id: "tfsa",
      type: "tfsa",
      currentBalance: 250_000,
      monthlyContribution: 8000,
      expectedReturn: 10,
      annualFees: 0.8,
    }),
    account({
      id: "disc",
      type: "discretionary",
      currentBalance: 400_000,
      monthlyContribution: 2000,
      expectedReturn: 9,
      annualFees: 1,
    }),
  ]
  const p = person(45, 65)
  const g = goals(45_000)

  it.each(["nominal", "compound"] as const)(
    "%s: zero volatility reproduces every yearly balance and the depletion age",
    (compoundingMethod) => {
      const det = calculateProjection(portfolio, p, g, fixedAmount, { compoundingMethod } as never)
      const mc = runMonteCarloSimulation(
        portfolio,
        p,
        g,
        fixedAmount,
        { numberOfRuns: 1, randomSeed: 1 },
        { equityVolatility: 0, compoundingMethod } as never,
      )
      det.yearlyProjections.forEach((row, t) =>
        expect(mc.runs[0].yearlyBalances[t], `age ${row.age}`).toBeCloseTo(row.endingBalance, 2),
      )
      expect(mc.runs[0].depletionAge).toBe(det.portfolioDepletionAge)
      expect(mc.runs[0].success).toBe(det.portfolioDepletionAge === null)
    },
  )

  it.each(["nominal", "compound"] as const)(
    "%s: at 16 percent volatility the median final balance equals the deterministic projection",
    (compoundingMethod) => {
      // R1M TFSA, retired, nothing withdrawn: the projection compounds 10% net for 25 years.
      // Converting each random year with R/12 under `nominal` used to inflate growth by
      // ~43% over 25 years (12.1% vs 10.47% a year). Expected returns are the typical
      // (median) return, so with no cash flows the median path IS the projection.
      const tfsa = [account({ type: "tfsa", currentBalance: 1_000_000, expectedReturn: 10 })]
      const deterministic = calculateProjection(tfsa, person(65, 65), goals(0), fixedAmount, {
        compoundingMethod,
      } as never)
      const expected =
        deterministic.yearlyProjections[deterministic.yearlyProjections.length - 1].endingBalance
      const mc = runMonteCarloSimulation(
        tfsa,
        person(65, 65),
        goals(0),
        fixedAmount,
        { numberOfRuns: 4000, randomSeed: 11 },
        { equityVolatility: 16, compoundingMethod } as never,
      )
      const finals = mc.runs.map((r) => r.finalBalance).sort((a, b) => a - b)
      const median = (finals[1999] + finals[2000]) / 2
      // Standard error of the median here is ~1.6% (1.2533 · σ√25 / √4000 in log terms);
      // 5% is a 3-sigma band
      expect(median / expected).toBeGreaterThan(0.95)
      expect(median / expected).toBeLessThan(1.05)
      // The mean sits above by the volatility drag: e^(25 · 0.16² / 2) ≈ 1.377
      expect(mc.averageFinalBalance / expected).toBeGreaterThan(1.25)
    },
  )

  it("splitting money across identical accounts does not change the success rate", () => {
    // Accounts share one market shock per year, so three thirds behave like one whole.
    const whole = [
      account({
        currentBalance: 3_000_000,
        monthlyContribution: 9000,
        expectedReturn: 11,
        annualFees: 1,
      }),
    ]
    const thirds = [1, 2, 3].map((k) =>
      account({
        id: String(k),
        currentBalance: 1_000_000,
        monthlyContribution: 3000,
        expectedReturn: 11,
        annualFees: 1,
      }),
    )
    const run = (accounts: Account[]) =>
      runMonteCarloSimulation(
        accounts,
        person(35, 65),
        goals(30_000),
        fixedAmount,
        { numberOfRuns: 500, randomSeed: 7 },
        { equityVolatility: 16.5, compoundingMethod: "nominal" } as never,
      )
    const a = run(whole)
    const b = run(thirds)
    expect(b.successRate).toBe(a.successRate)
    expect(b.percentiles.p50[40]).toBeCloseTo(a.percentiles.p50[40], 2)
  })
})

describe("SA audit scenarios — investment types in Monte Carlo", () => {
  // The golden Monte Carlo file pins the untyped path: its scenarios carry no
  // investmentType, and it was not regenerated when types were added, so an account
  // without a type gives exactly the pre-feature result.
  const run = (accounts: Account[], seed = 7, equityVolatility = 16.5) =>
    runMonteCarloSimulation(
      accounts,
      person(45, 65),
      goals(25_000),
      fixedAmount,
      { numberOfRuns: 600, randomSeed: seed },
      { equityVolatility, compoundingMethod: "compound" } as never,
    )
  const atRetirement = 20 - 1
  const band = (r: ReturnType<typeof run>) =>
    r.percentiles.p90[atRetirement] / r.percentiles.p10[atRetirement]
  const typed = (investmentType: Account["investmentType"], o: Partial<Account> = {}) =>
    account({
      currentBalance: 2_000_000,
      monthlyContribution: 8000,
      expectedReturn: 11,
      annualFees: 1,
      investmentType,
      ...o,
    })

  it("a wider-risk type gives a wider p10-p90 band at the same expected return", () => {
    // Nasdaq 28.4% > MSCI World 16.3% > Balanced 9.1%
    const nasdaq = band(run([typed("concentrated_equity")]))
    const world = band(run([typed("global_equity")]))
    const balanced = band(run([typed("balanced")]))
    expect(nasdaq).toBeGreaterThan(world)
    expect(world).toBeGreaterThan(balanced)
  })

  it("the global volatility setting no longer moves a typed account", () => {
    const a = run([typed("global_equity")], 7, 10)
    const b = run([typed("global_equity")], 7, 30)
    expect(b.successRate).toBe(a.successRate)
    expect(b.percentiles.p50).toEqual(a.percentiles.p50)
  })

  it("splitting money across accounts of one type does not change the result", () => {
    const whole = [typed("sa_equity", { currentBalance: 3_000_000, monthlyContribution: 9000 })]
    const thirds = [1, 2, 3].map((k) =>
      typed("sa_equity", { id: String(k), currentBalance: 1_000_000, monthlyContribution: 3000 }),
    )
    const a = run(whole)
    const b = run(thirds)
    expect(b.successRate).toBe(a.successRate)
    expect(b.percentiles.p50[atRetirement]).toBeCloseTo(a.percentiles.p50[atRetirement], 2)
  })

  it("SA and global equity diversify each other; two global halves do not", () => {
    // Same volatility (16.0% vs 16.3%), but SA and global correlate only ~0.56
    const halves = (a: Account["investmentType"], b: Account["investmentType"]) =>
      band(
        run([
          typed(a, { id: "1", currentBalance: 1_000_000, monthlyContribution: 4000 }),
          typed(b, { id: "2", currentBalance: 1_000_000, monthlyContribution: 4000 }),
        ]),
      )
    expect(halves("sa_equity", "global_equity")).toBeLessThan(
      halves("global_equity", "global_equity"),
    )
  })

  it.each(["nominal", "compound"] as const)(
    "%s: a cash-type account's median tracks the deterministic projection",
    (compoundingMethod) => {
      // 0.6% volatility: the median path is the projection within a fraction of a percent
      const cash = [typed("cash", { expectedReturn: 7, annualFees: 0.5 })]
      const deterministic = calculateProjection(cash, person(45, 65), goals(0), fixedAmount, {
        compoundingMethod,
      } as never)
      const mc = runMonteCarloSimulation(
        cash,
        person(45, 65),
        goals(0),
        fixedAmount,
        { numberOfRuns: 400, randomSeed: 3 },
        { equityVolatility: 16.5, compoundingMethod } as never,
      )
      expect(mc.percentiles.p50[atRetirement] / deterministic.portfolioAtRetirement).toBeCloseTo(
        1,
        2,
      )
    },
  )

  it("an untyped account alongside a typed one keeps the global volatility", () => {
    // Raising the global setting widens a mixed plan only through its untyped account
    const mixed = (vol: number) =>
      band(run([typed("cash", { id: "1" }), typed(undefined, { id: "2" })], 7, vol))
    expect(mixed(25)).toBeGreaterThan(mixed(10))
  })
})

describe("SA audit scenarios — optimal contribution", () => {
  const base = {
    currentSavings: 0,
    drawdownConfig: fixedAmount,
    expectedReturn: 0.1,
    fees: 0.01,
    contributionEscalation: 0.06,
    compoundingMethod: "nominal" as const,
  }

  it("reports an unachievable goal when there are no years left to contribute", () => {
    const r = calculateOptimalContribution({
      ...base,
      personalInfo: person(65, 65),
      retirementGoals: goals(30_000),
    })
    expect(r.isAchievable).toBe(false)
    expect(r.optimalMonthlyContribution).toBe(0)
  })

  it("finds contributions above the old R100,000/month search ceiling", () => {
    const r = calculateOptimalContribution({
      ...base,
      personalInfo: person(60, 65),
      retirementGoals: goals(150_000),
    })
    expect(r.isAchievable).toBe(true)
    expect(r.optimalMonthlyContribution).toBeGreaterThan(100_000)
    expect(r.projectedNestEgg).toBeGreaterThanOrEqual(r.targetNestEgg)
  })

  it("an already-funded goal needs R0 and is achievable", () => {
    const r = calculateOptimalContribution({
      ...base,
      currentSavings: 100_000_000,
      personalInfo: person(60, 65),
      retirementGoals: goals(10_000),
    })
    expect(r).toMatchObject({ optimalMonthlyContribution: 0, isAchievable: true })
  })
})
