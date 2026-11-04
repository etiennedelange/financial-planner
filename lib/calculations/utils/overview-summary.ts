/**
 * Overview page summary — the derived figures behind the "retirement verdict".
 *
 * Pure function so the Overview UI never owns calculation logic (see CLAUDE.md
 * "Common Pitfalls"). Replaces the inline derivation that used to live in
 * `components/dashboard/key-insights-summary.tsx` (removed); the on-track rule is unchanged.
 *
 * Deterministic only: market-risk (Monte Carlo) results live on the Risk page.
 * "On track" means the steady-return projection pays the income GOAL every year
 * (`incomeGoalShortfallAge === null`) — not merely that money survives, which a
 * percentage strategy always does however little it pays.
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

export interface OverviewSummaryInput {
  projection: Pick<
    ProjectionResult,
    "portfolioAtRetirement" | "monthlyIncomeAtRetirement" | "incomeGoalShortfallAge"
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
}

export interface OverviewSummary {
  yearsToRetirement: number
  /** Last age the projection pays the full goal income (shortfall age, else life expectancy). */
  goalIncomeUntilAge: number
  /** Years between retirement and `goalIncomeUntilAge`. */
  yearsOfGoalIncome: number
  /** Years between `goalIncomeUntilAge` and life expectancy paying less than the goal. */
  yearsBelowGoal: number
  /** True when the projection pays the goal income every year — the on-track verdict. */
  isOnTrack: boolean
  /** Monthly income at retirement, expressed in today's rands. */
  monthlyIncomeToday: Rands<"today">
  /** Portfolio at retirement, expressed in today's rands. */
  portfolioAtRetirementToday: Rands<"today">
  /** Goal income at the retirement date (nominal). */
  desiredIncomeAtRetirement: Rands<"atRetirement">
  /** Projected income as a percentage of goal income, or null when there is no goal. */
  incomeReplacementPercent: number | null
  /** Most a person can deduct for retirement-fund contributions, per month. */
  maxMonthlyRaContribution: number
}

export function calculateOverviewSummary(input: OverviewSummaryInput): OverviewSummary {
  const currentAge = finiteOrZero(input.currentAge)
  const retirementAge = Math.max(currentAge, finiteOrZero(input.retirementAge))
  const lifeExpectancy = Math.max(retirementAge, finiteOrZero(input.lifeExpectancy))
  const rate = percentToRate(input.inflationRate)

  const yearsToRetirement = retirementAge - currentAge

  const shortfallAge = input.projection.incomeGoalShortfallAge
  const hasShortfall = shortfallAge !== null && Number.isFinite(shortfallAge)
  const goalIncomeUntilAge = hasShortfall
    ? Math.min(lifeExpectancy, Math.max(retirementAge, shortfallAge))
    : lifeExpectancy

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

  const annualIncome = Math.max(0, finiteOrZero(input.annualIncome))
  const maxAnnualDeduction = Math.min(
    annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate,
    SA_TAX_LIMITS.pensionRaMaxDeduction,
  )

  return {
    yearsToRetirement,
    goalIncomeUntilAge,
    yearsOfGoalIncome: goalIncomeUntilAge - retirementAge,
    yearsBelowGoal: lifeExpectancy - goalIncomeUntilAge,
    isOnTrack: !hasShortfall,
    monthlyIncomeToday: deflateToToday(monthlyIncomeAtRetirement, yearsToRetirement, rate),
    portfolioAtRetirementToday: deflateToToday(portfolioAtRetirement, yearsToRetirement, rate),
    desiredIncomeAtRetirement,
    incomeReplacementPercent,
    maxMonthlyRaContribution: maxAnnualDeduction / 12,
  }
}
