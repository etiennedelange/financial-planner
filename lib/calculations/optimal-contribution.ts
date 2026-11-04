import type { PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod } from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { projectFinalSavings } from "./utils/projection"
import { escalate, percentToRate } from "./utils/money-time"
import { finiteOrZero } from "./utils/invariant-guards"
import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"

interface OptimalContributionParams {
  currentSavings: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  expectedReturn: number // decimal
  fees: number // decimal
  contributionEscalation: number // decimal
  compoundingMethod: CompoundingMethod
}

interface OptimalContributionResult {
  optimalMonthlyContribution: number
  targetNestEgg: number
  projectedNestEgg: number
  yearsToRetirement: number
  /**
   * False when no monthly contribution up to MAX_MONETARY_AMOUNT reaches the target, which
   * is always the case with no years left to contribute. `optimalMonthlyContribution` is
   * then 0 and must NOT be read as "nothing more is needed".
   */
  isAchievable: boolean
}

/** Search starts here and doubles until a contribution reaches the target. */
const INITIAL_SEARCH_CEILING = 100000

/**
 * Calculate optimal monthly contribution using binary search
 * Finds the minimum contribution needed to achieve desired retirement income
 */
export function calculateOptimalContribution(
  params: OptimalContributionParams,
): OptimalContributionResult {
  const {
    currentSavings,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    expectedReturn,
    fees,
    contributionEscalation,
    compoundingMethod,
  } = params

  const yearsToRetirement = finiteOrZero(personalInfo.retirementAge - personalInfo.currentAge)
  const inflationRate = percentToRate(retirementGoals.inflationRate)
  const netReturn = finiteOrZero(expectedReturn - fees)
  const safeCurrentSavings = finiteOrZero(currentSavings)
  const safeEscalation = finiteOrZero(contributionEscalation)

  // Calculate target nest egg based on desired income
  const desiredMonthlyAtRetirement = escalate(
    retirementGoals.desiredMonthlyIncome,
    yearsToRetirement,
    inflationRate,
  )
  const desiredAnnualAtRetirement = desiredMonthlyAtRetirement * 12

  // Use withdrawal rate to determine required nest egg.
  // A 0% (or non-finite) withdrawal rate would otherwise divide to Infinity — a
  // non-finite target nest egg that leaks into the result (Phase 9.1). Guard it.
  const withdrawalRate = finiteOrZero(drawdownConfig.initialWithdrawalRate) / 100
  const targetNestEgg = withdrawalRate > 0 ? desiredAnnualAtRetirement / withdrawalRate : 0

  // Handle edge case: already have enough
  const currentProjection = projectFinalSavings(
    safeCurrentSavings,
    0,
    yearsToRetirement,
    safeEscalation,
    netReturn,
    compoundingMethod,
  )
  if (currentProjection >= targetNestEgg) {
    return {
      optimalMonthlyContribution: 0,
      targetNestEgg,
      projectedNestEgg: currentProjection,
      yearsToRetirement,
      isAchievable: true,
    }
  }

  const projectWith = (monthlyContribution: number) =>
    projectFinalSavings(
      safeCurrentSavings,
      monthlyContribution,
      yearsToRetirement,
      safeEscalation,
      netReturn,
      compoundingMethod,
    )

  // The search used to have a fixed R100k/month ceiling. A goal needing more — or any goal
  // with no years left to contribute — never satisfied the search, so the result stayed at
  // R0 and the insights panel told the user "You're on track!". Grow the ceiling until it
  // reaches the target, and report the goal as unachievable if even the largest accepted
  // amount does not.
  let maxContribution = INITIAL_SEARCH_CEILING
  while (projectWith(maxContribution) < targetNestEgg && maxContribution < MAX_MONETARY_AMOUNT) {
    maxContribution = Math.min(maxContribution * 2, MAX_MONETARY_AMOUNT)
  }
  if (projectWith(maxContribution) < targetNestEgg) {
    return {
      optimalMonthlyContribution: 0,
      targetNestEgg,
      projectedNestEgg: currentProjection,
      yearsToRetirement,
      isAchievable: false,
    }
  }

  // Binary search to find optimal contribution
  let minContribution = 0
  let optimalContribution = maxContribution

  while (maxContribution - minContribution > 100) {
    // Within R100 precision
    const midContribution = (minContribution + maxContribution) / 2

    const finalSavings = projectWith(midContribution)

    if (finalSavings >= targetNestEgg) {
      maxContribution = midContribution
      optimalContribution = midContribution
    } else {
      minContribution = midContribution
    }
  }

  // Get projected nest egg with optimal contribution
  const projectedNestEgg = projectWith(optimalContribution)

  return {
    optimalMonthlyContribution: Math.ceil(optimalContribution / 100) * 100, // Round up to nearest R100
    targetNestEgg,
    projectedNestEgg,
    yearsToRetirement,
    isAchievable: true,
  }
}
