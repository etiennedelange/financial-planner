import type { ProjectionResult } from "@/types"
import { escalate, percentToRate } from "./money-time"

export interface SustainabilityPoint {
  age: number
  income: number // monthly income, in display basis
  target: number // monthly desired income, in display basis
}

export interface IncomeSustainabilitySeries {
  points: SustainabilityPoint[]
  depletionAge: number | null
}

interface BuildIncomeSustainabilitySeriesParams {
  projection: ProjectionResult
  desiredMonthlyIncome: number
  currentAge: number
  retirementAge: number
  inflationRate: number // percent, e.g. 5.5
  displayMode: "nominal" | "real"
}

/**
 * Build the drawdown-phase income-vs-target series for the "Will my income last?"
 * chart. Drawdown years only (age >= retirementAge). Both series share the same
 * display basis so the gap between them is a fair comparison:
 *
 *  - nominal: projected gross monthly withdrawal vs. desired income escalated to
 *    that age
 *  - real:    projected gross monthly withdrawal deflated to today's value vs.
 *    desired income as entered today
 */
export function buildIncomeSustainabilitySeries({
  projection,
  desiredMonthlyIncome,
  currentAge,
  retirementAge,
  inflationRate,
  displayMode,
}: BuildIncomeSustainabilitySeriesParams): IncomeSustainabilitySeries {
  const rate = percentToRate(inflationRate)

  const points: SustainabilityPoint[] = []
  for (const row of projection.yearlyProjections) {
    if (row.age < retirementAge) continue

    const income =
      displayMode === "real" ? row.inflationAdjustedWithdrawal / 12 : row.withdrawals / 12

    const target =
      displayMode === "real"
        ? desiredMonthlyIncome
        : escalate(desiredMonthlyIncome, row.age - currentAge, rate)

    points.push({ age: row.age, income, target })
  }

  return { points, depletionAge: projection.portfolioDepletionAge }
}
