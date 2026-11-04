import type { SimulationResult, YearlyProjection } from "@/types"
import { toRealValue } from "./currency"

/**
 * How a chart expresses rands: future (nominal) amounts, or today's rands. Required by the
 * builders, so a chart cannot forget it: until 2026-11-04 both balance charts ignored the
 * app's Today's Value setting and always plotted nominal rands (a plan worth ~R27M in
 * today's rands plotted up to ~R1.8B), while the income chart beside them did convert.
 */
export interface DisplayBasis {
  displayMode: "nominal" | "real"
  /** Annual inflation as a decimal (0.055) */
  inflationRate: number
  currentAge: number
}

/** A point's balance is ON a birthday, `age − currentAge` years from now */
function atAge(value: number, age: number, basis: DisplayBasis): number {
  return basis.displayMode === "real"
    ? toRealValue(value, age - basis.currentAge, basis.inflationRate)
    : value
}

/**
 * Balance-over-age chart series. Both engines record each year's ENDING balance against
 * the age the person is DURING that year (row `age`; Monte Carlo index i = year i + 1),
 * so plotting `endingBalance` at `age` put every point a year early: the chart showed the
 * balance after the first retirement year at "65", while the headline "portfolio at
 * retirement, age 65" is the balance ON the 65th birthday (fixed 2026-11-04).
 *
 * These builders plot each year-end balance at the age just reached (age + 1), and start
 * the series at today's balance at the current age, so the chart's value at the
 * retirement line equals `portfolioAtRetirement`.
 */

export interface BalancePoint {
  age: number
  balance: number
  contributions: number
  withdrawals: number
}

export function buildBalanceSeries(
  projections: YearlyProjection[],
  basis: DisplayBasis,
): BalancePoint[] {
  if (projections.length === 0) return []
  const first = projections[0]
  return [
    {
      age: first.age,
      balance: atAge(first.startingBalance, first.age, basis),
      contributions: 0,
      withdrawals: 0,
    },
    ...projections.map((p) => ({
      age: p.age + 1,
      balance: atAge(p.endingBalance, p.age + 1, basis),
      // Flows during the year leading up to this age, on the start-of-year basis the
      // tables use (yearsFromNowAtRowStart)
      contributions: atAge(p.contributions, p.age, basis),
      withdrawals: atAge(p.withdrawals, p.age, basis),
    })),
  ]
}

export interface PercentilePoint {
  age: number
  p10: number
  p25: number
  p50: number
  p75: number
  p90: number
}

export function buildPercentileSeries(
  percentiles: SimulationResult["percentiles"] | undefined,
  startingBalance: number,
  basis: DisplayBasis,
): PercentilePoint[] {
  if (!percentiles || percentiles.p50.length === 0) return []
  const { currentAge } = basis
  const start = Number.isFinite(startingBalance) ? startingBalance : 0
  return [
    { age: currentAge, p10: start, p25: start, p50: start, p75: start, p90: start },
    ...percentiles.p50.map((_, index) => {
      const age = currentAge + index + 1
      return {
        age,
        p10: atAge(percentiles.p10[index], age, basis),
        p25: atAge(percentiles.p25[index], age, basis),
        p50: atAge(percentiles.p50[index], age, basis),
        p75: atAge(percentiles.p75[index], age, basis),
        p90: atAge(percentiles.p90[index], age, basis),
      }
    }),
  ]
}

/**
 * Years from now for converting a projection row's figures to today's rands. A row's
 * `startingBalance` — and, by this app's convention, the flows paid during the year — sit
 * at the START of the year the person is `rowAge`; its `endingBalance` sits at the END,
 * one year later. Deflating the ending balance by the start-of-year count overstated it by
 * one year of inflation (about 5.5%) in Today's Value mode (fixed 2026-11-04). Tables must
 * use these rather than writing `age - currentAge` inline.
 */
export function yearsFromNowAtRowStart(rowAge: number, currentAge: number): number {
  return rowAge - currentAge
}

export function yearsFromNowAtRowEnd(rowAge: number, currentAge: number): number {
  return yearsFromNowAtRowStart(rowAge, currentAge) + 1
}
