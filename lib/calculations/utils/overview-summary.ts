/**
 * Overview page summary — the derived figures behind the "retirement verdict".
 *
 * Pure function so the Overview UI never owns calculation logic (see CLAUDE.md
 * "Common Pitfalls"). Replaces the inline derivation that used to live in
 * `components/dashboard/key-insights-summary.tsx`; the on-track rule and the
 * income-replacement basis are unchanged from that component.
 */

import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import type { ProjectionResult } from "@/types"
import {
  deflateToToday,
  escalateToRetirement,
  percentToRate,
  retirementRands,
  todayRands,
  type Rands,
} from "./money-time"
import { finiteOrZero } from "./invariant-guards"

/** Monte Carlo success rate (percent) at or above which a plan counts as on track. */
export const ON_TRACK_SUCCESS_RATE = 70

export interface OverviewSummaryInput {
  projection: Pick<
    ProjectionResult,
    "portfolioAtRetirement" | "monthlyIncomeAtRetirement" | "portfolioDepletionAge"
  >
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  /** Gross annual income today, used for the RA deduction limit. */
  annualIncome: number
  /** Goal monthly income in today's rands. */
  desiredMonthlyIncome: number
  /** Inflation as a percentage (5.5), as stored in `retirementGoals`. */
  inflationRate: number
  /** Monte Carlo success rate as a percentage, or null when no simulation has finished. */
  monteCarloSuccessRate: number | null
}

export interface OverviewSummary {
  yearsToRetirement: number
  /** Age the steady-return projection pays income until (depletion age, else life expectancy). */
  incomeEndAge: number
  /** Years of income between retirement and `incomeEndAge`. */
  yearsOfIncome: number
  /** Years between `incomeEndAge` and life expectancy with no income (0 when it lasts). */
  shortfallYears: number
  lastsToLifeExpectancy: boolean
  /** Monthly income at retirement, expressed in today's rands. */
  monthlyIncomeToday: Rands<"today">
  /** Portfolio at retirement, expressed in today's rands. */
  portfolioAtRetirementToday: Rands<"today">
  /** Goal income at the retirement date (nominal). */
  desiredIncomeAtRetirement: Rands<"atRetirement">
  /** Projected income as a percentage of goal income, or null when there is no goal. */
  incomeReplacementPercent: number | null
  isOnTrack: boolean
  /** Which result decided `isOnTrack`. */
  verdictBasis: "monte-carlo" | "steady-returns"
  /** Most a person can deduct for retirement-fund contributions, per month. */
  maxMonthlyRaContribution: number
}

export function calculateOverviewSummary(input: OverviewSummaryInput): OverviewSummary {
  const currentAge = finiteOrZero(input.currentAge)
  const retirementAge = Math.max(currentAge, finiteOrZero(input.retirementAge))
  const lifeExpectancy = Math.max(retirementAge, finiteOrZero(input.lifeExpectancy))
  const rate = percentToRate(input.inflationRate)

  const yearsToRetirement = retirementAge - currentAge

  const depletionAge = input.projection.portfolioDepletionAge
  const depletesEarly =
    depletionAge !== null && Number.isFinite(depletionAge) && depletionAge < lifeExpectancy
  const incomeEndAge = depletesEarly ? Math.max(retirementAge, depletionAge) : lifeExpectancy

  const monthlyIncomeAtRetirement = retirementRands(
    finiteOrZero(input.projection.monthlyIncomeAtRetirement),
  )
  const portfolioAtRetirement = retirementRands(
    finiteOrZero(input.projection.portfolioAtRetirement),
  )

  const desiredToday = todayRands(Math.max(0, finiteOrZero(input.desiredMonthlyIncome)))
  const desiredIncomeAtRetirement = escalateToRetirement(desiredToday, yearsToRetirement, rate)

  const incomeReplacementPercent =
    desiredIncomeAtRetirement > 0
      ? Math.round((monthlyIncomeAtRetirement / desiredIncomeAtRetirement) * 100)
      : null

  const successRate = input.monteCarloSuccessRate
  const hasSuccessRate = successRate !== null && Number.isFinite(successRate)
  const isOnTrack = hasSuccessRate ? successRate >= ON_TRACK_SUCCESS_RATE : !depletesEarly

  const annualIncome = Math.max(0, finiteOrZero(input.annualIncome))
  const maxAnnualDeduction = Math.min(
    annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction,
  )

  return {
    yearsToRetirement,
    incomeEndAge,
    yearsOfIncome: incomeEndAge - retirementAge,
    shortfallYears: lifeExpectancy - incomeEndAge,
    lastsToLifeExpectancy: !depletesEarly,
    monthlyIncomeToday: deflateToToday(monthlyIncomeAtRetirement, yearsToRetirement, rate),
    portfolioAtRetirementToday: deflateToToday(portfolioAtRetirement, yearsToRetirement, rate),
    desiredIncomeAtRetirement,
    incomeReplacementPercent,
    isOnTrack,
    verdictBasis: hasSuccessRate ? "monte-carlo" : "steady-returns",
    maxMonthlyRaContribution: maxAnnualDeduction / 12,
  }
}
