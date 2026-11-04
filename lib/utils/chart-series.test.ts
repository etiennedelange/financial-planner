import { describe, expect, it } from "vite-plus/test"
import type { Account, DrawdownConfig } from "@/types"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { runMonteCarloSimulation } from "@/lib/monte-carlo/simulation-engine"
import {
  buildBalanceSeries,
  buildPercentileSeries,
  yearsFromNowAtRowEnd,
  yearsFromNowAtRowStart,
} from "./chart-series"
import { toRealValue } from "./currency"

const accounts: Account[] = [
  {
    id: "pf",
    name: "Pension",
    provider: "",
    type: "pension_fund",
    currentBalance: 1_750_000,
    monthlyContribution: 15_000,
    expectedReturn: 10.5,
    annualFees: 1.5,
    contributionEscalation: 5,
  },
]
const person = { currentAge: 39, retirementAge: 65, lifeExpectancy: 100, annualIncome: 1_150_000 }
const goals = { desiredMonthlyIncome: 35_000, inflationRate: 5.5, legacyAmount: 0 }
const dd = {
  strategy: "fixed_amount_inflation_adjusted",
  initialWithdrawalRate: 3.5,
  minimumWithdrawal: 0,
  maximumWithdrawal: 1e12,
  lumpSumPercentage: 4,
} as DrawdownConfig
const assumptions = { compoundingMethod: "compound", equityVolatility: 0 } as never
const nominalAt39 = { displayMode: "nominal", inflationRate: 0.055, currentAge: 39 } as const
const realAt39 = { displayMode: "real", inflationRate: 0.055, currentAge: 39 } as const

describe("chart series: a balance is plotted at the age just reached", () => {
  describe("Critical SA scenarios", () => {
    it("the deterministic chart's value at the retirement age is portfolioAtRetirement", () => {
      // Regression: the chart used to plot each year's ENDING balance at the age DURING
      // that year, so "65" showed the balance after the first retirement year
      // (R66.3M against R65.0M at retirement for the user's plan, 2026-11-04)
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const series = buildBalanceSeries(p.yearlyProjections, nominalAt39)
      expect(series.find((pt) => pt.age === 65)!.balance).toBeCloseTo(p.portfolioAtRetirement, 6)
    })

    it("the Monte Carlo chart at zero volatility matches the deterministic chart at every age", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const mc = runMonteCarloSimulation(
        accounts,
        person,
        goals,
        dd,
        { numberOfRuns: 1, randomSeed: 1, volatilityScale: 1 },
        assumptions,
      )
      const det = buildBalanceSeries(p.yearlyProjections, nominalAt39)
      const sim = buildPercentileSeries(mc.percentiles, 1_750_000, nominalAt39)
      expect(sim.map((pt) => pt.age)).toEqual(det.map((pt) => pt.age))
      sim.forEach((pt, i) => expect(pt.p50).toBeCloseTo(det[i].balance, 4))
      expect(sim.find((pt) => pt.age === 65)!.p50).toBeCloseTo(p.portfolioAtRetirement, 4)
    })
  })

  describe("Series shape", () => {
    it("starts at today's balance at the current age and ends at life expectancy", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const series = buildBalanceSeries(p.yearlyProjections, nominalAt39)
      expect(series[0]).toEqual({ age: 39, balance: 1_750_000, contributions: 0, withdrawals: 0 })
      expect(series.at(-1)!.age).toBe(100)
      expect(series).toHaveLength(p.yearlyProjections.length + 1)
    })

    it("percentile series starts every band at the starting balance", () => {
      const s = buildPercentileSeries({ p10: [1], p25: [2], p50: [3], p75: [4], p90: [5] }, 100, {
        displayMode: "nominal",
        inflationRate: 0.055,
        currentAge: 40,
      })
      expect(s).toEqual([
        { age: 40, p10: 100, p25: 100, p50: 100, p75: 100, p90: 100 },
        { age: 41, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 },
      ])
    })
  })

  describe("Edge cases", () => {
    it("empty input gives an empty series", () => {
      expect(buildBalanceSeries([], nominalAt39)).toEqual([])
      expect(buildPercentileSeries(undefined, 100, nominalAt39)).toEqual([])
      expect(
        buildPercentileSeries({ p10: [], p25: [], p50: [], p75: [], p90: [] }, 100, nominalAt39),
      ).toEqual([])
    })

    it("a non-finite starting balance starts the bands at 0", () => {
      expect(
        buildPercentileSeries(
          { p10: [1], p25: [1], p50: [1], p75: [1], p90: [1] },
          Number.NaN,
          nominalAt39,
        )[0].p50,
      ).toBe(0)
    })
  })
})

describe("table deflation: a row's ending balance in today's rands", () => {
  const inflation = 0.055
  const real = (value: number, years: number) => toRealValue(value, years, inflation)

  describe("Critical SA scenarios", () => {
    it.each(["compound", "nominal"] as const)(
      "%s: equals the next row's starting balance in today's rands, every year but the retirement boundary",
      (compoundingMethod) => {
        const p = calculateProjection(accounts, person, goals, dd, {
          compoundingMethod,
        } as never)
        const rows = p.yearlyProjections
        let checked = 0
        for (let i = 0; i < rows.length - 1; i++) {
          // At the boundary the lump sum leaves between one row's end and the next's start
          if (rows[i + 1].age === person.retirementAge) continue
          expect(rows[i + 1].startingBalance).toBeCloseTo(rows[i].endingBalance, 4)
          expect(real(rows[i].endingBalance, yearsFromNowAtRowEnd(rows[i].age, 39))).toBeCloseTo(
            real(rows[i + 1].startingBalance, yearsFromNowAtRowStart(rows[i + 1].age, 39)),
            4,
          )
          checked++
        }
        expect(checked).toBe(rows.length - 2)
      },
    )

    it("the last accumulation row's ending balance matches the at-retirement figure in today's rands", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const last = p.yearlyProjections[person.retirementAge - person.currentAge - 1]
      expect(last.age).toBe(64)
      expect(real(last.endingBalance, yearsFromNowAtRowEnd(last.age, 39))).toBeCloseTo(
        real(p.portfolioAtRetirement, person.retirementAge - person.currentAge),
        4,
      )
    })

    it("the old start-of-year basis overstated the ending balance by one year of inflation", () => {
      // Regression guard: `age - currentAge` for the ENDING balance was 5.5% too high
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const row = p.yearlyProjections[10]
      const wrong = real(row.endingBalance, yearsFromNowAtRowStart(row.age, 39))
      const right = real(row.endingBalance, yearsFromNowAtRowEnd(row.age, 39))
      expect(wrong / right).toBeCloseTo(1 + inflation, 10)
    })
  })

  describe("Edge cases", () => {
    it("the first row's start is today (0 years) and its end is 1 year away", () => {
      expect(yearsFromNowAtRowStart(39, 39)).toBe(0)
      expect(yearsFromNowAtRowEnd(39, 39)).toBe(1)
    })

    it("0% inflation: start and end bases give the same figure", () => {
      expect(toRealValue(1000, yearsFromNowAtRowEnd(50, 39), 0)).toBe(1000)
    })
  })
})

describe("chart series in Today's Value mode", () => {
  describe("Critical SA scenarios", () => {
    it("the balance at the retirement line is portfolioAtRetirement in today's rands", () => {
      // Regression: both balance charts ignored Today's Value and plotted nominal rands
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const at65 = buildBalanceSeries(p.yearlyProjections, realAt39).find((pt) => pt.age === 65)!
      expect(at65.balance).toBeCloseTo(toRealValue(p.portfolioAtRetirement, 26, 0.055), 4)
      expect(at65.balance).toBeLessThan(p.portfolioAtRetirement / 3)
    })

    it("Monte Carlo and deterministic real series agree at every age at zero volatility", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const mc = runMonteCarloSimulation(
        accounts,
        person,
        goals,
        dd,
        { numberOfRuns: 1, randomSeed: 1, volatilityScale: 1 },
        assumptions,
      )
      const det = buildBalanceSeries(p.yearlyProjections, realAt39)
      const sim = buildPercentileSeries(mc.percentiles, 1_750_000, realAt39)
      sim.forEach((pt, i) => expect(pt.p50).toBeCloseTo(det[i].balance, 4))
    })

    it("each point is deflated by the years to that birthday; today's balance is unchanged", () => {
      const s = buildPercentileSeries(
        { p10: [1055], p25: [1055], p50: [1055], p75: [1055], p90: [1055] },
        1000,
        { displayMode: "real", inflationRate: 0.055, currentAge: 40 },
      )
      expect(s[0].p50).toBe(1000)
      expect(s[1].p50).toBeCloseTo(1000, 10)
    })
  })

  describe("Edge cases", () => {
    it("flows are deflated on the start-of-year basis the tables use", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      const row = p.yearlyProjections[10]
      const pt = buildBalanceSeries(p.yearlyProjections, realAt39)[11]
      expect(pt.age).toBe(row.age + 1)
      expect(pt.contributions).toBeCloseTo(
        toRealValue(row.contributions, yearsFromNowAtRowStart(row.age, 39), 0.055),
        6,
      )
    })

    it("0% inflation: real and nominal series are identical", () => {
      const p = calculateProjection(accounts, person, goals, dd, assumptions)
      expect(buildBalanceSeries(p.yearlyProjections, { ...realAt39, inflationRate: 0 })).toEqual(
        buildBalanceSeries(p.yearlyProjections, nominalAt39),
      )
    })
  })
})
