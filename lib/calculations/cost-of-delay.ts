import type { PersonalInfo, RetirementGoals, CompoundingMethod } from "@/types"
import { projectFinalSavings } from "./utils/projection"

interface CostOfDelayParams {
  currentSavings: number
  monthlyContribution: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  expectedReturn: number // decimal
  fees: number // decimal
  contributionEscalation: number // decimal
  compoundingMethod: CompoundingMethod
}

interface CostOfDelayResult {
  baselineNestEgg: number
  oneYearDelayNestEgg: number
  twoYearDelayNestEgg: number
  fiveYearDelayNestEgg: number
  costOfOneYearDelay: number
  costOfTwoYearDelay: number
  costOfFiveYearDelay: number
  percentageLostOneYear: number
  percentageLostTwoYear: number
  percentageLostFiveYear: number
}

/**
 * Calculate the cost of delaying retirement savings
 * Shows impact of waiting 1, 2, or 5 years to start saving
 */
/**
 * Nest egg if saving is delayed by `delayYears`: existing savings grow
 * untouched (no contributions) for as much of the delay as actually fits
 * before retirement, then the remaining years (if any) accumulate normally.
 * Both legs route through projectFinalSavings so the delay period uses the
 * exact same monthly-compounding convention as the rest of the engine,
 * instead of a naive annual Math.pow that drifted from it under nominal
 * compounding.
 */
function nestEggAfterDelay(
  currentSavings: number,
  monthlyContribution: number,
  yearsToRetirement: number,
  delayYears: number,
  contributionEscalation: number,
  netReturn: number,
  compoundingMethod: CompoundingMethod
): number {
  // Can't delay longer than the time actually available before retirement —
  // otherwise the delay scenario simulates growth past a retirement date
  // that's already arrived, making it look better than the baseline.
  const effectiveDelay = Math.min(delayYears, Math.max(0, yearsToRetirement))
  const savingsAfterDelay = projectFinalSavings(
    currentSavings,
    0,
    effectiveDelay,
    0,
    netReturn,
    compoundingMethod
  )
  const remainingYears = Math.max(0, yearsToRetirement - delayYears)
  return projectFinalSavings(
    savingsAfterDelay,
    monthlyContribution,
    remainingYears,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )
}

export function calculateCostOfDelay(params: CostOfDelayParams): CostOfDelayResult {
  const {
    currentSavings,
    monthlyContribution,
    personalInfo,
    retirementGoals,
    expectedReturn,
    fees,
    contributionEscalation,
    compoundingMethod,
  } = params

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const netReturn = expectedReturn - fees

  // Baseline: start saving now
  const baselineNestEgg = projectFinalSavings(
    currentSavings,
    monthlyContribution,
    yearsToRetirement,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )

  const oneYearDelayNestEgg = nestEggAfterDelay(
    currentSavings, monthlyContribution, yearsToRetirement, 1, contributionEscalation, netReturn, compoundingMethod
  )
  const twoYearDelayNestEgg = nestEggAfterDelay(
    currentSavings, monthlyContribution, yearsToRetirement, 2, contributionEscalation, netReturn, compoundingMethod
  )
  const fiveYearDelayNestEgg = nestEggAfterDelay(
    currentSavings, monthlyContribution, yearsToRetirement, 5, contributionEscalation, netReturn, compoundingMethod
  )

  const costOfOneYearDelay = baselineNestEgg - oneYearDelayNestEgg
  const costOfTwoYearDelay = baselineNestEgg - twoYearDelayNestEgg
  const costOfFiveYearDelay = baselineNestEgg - fiveYearDelayNestEgg

  // baselineNestEgg is legitimately 0 with zero savings + zero contribution —
  // guard the division instead of surfacing NaN to the UI.
  const percentOf = (cost: number) => (baselineNestEgg > 0 ? (cost / baselineNestEgg) * 100 : 0)

  return {
    baselineNestEgg,
    oneYearDelayNestEgg,
    twoYearDelayNestEgg,
    fiveYearDelayNestEgg,
    costOfOneYearDelay,
    costOfTwoYearDelay,
    costOfFiveYearDelay,
    percentageLostOneYear: percentOf(costOfOneYearDelay),
    percentageLostTwoYear: percentOf(costOfTwoYearDelay),
    percentageLostFiveYear: percentOf(costOfFiveYearDelay),
  }
}
