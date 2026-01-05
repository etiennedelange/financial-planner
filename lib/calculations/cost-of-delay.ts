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

  // Scenario: delay 1 year
  // Current savings grow for 1 year without contributions, then save for remaining years
  const savingsAfterOneYear = currentSavings * Math.pow(1 + netReturn, 1)
  const oneYearDelayNestEgg = projectFinalSavings(
    savingsAfterOneYear,
    monthlyContribution,
    yearsToRetirement - 1,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )

  // Scenario: delay 2 years
  const savingsAfterTwoYears = currentSavings * Math.pow(1 + netReturn, 2)
  const twoYearDelayNestEgg = projectFinalSavings(
    savingsAfterTwoYears,
    monthlyContribution,
    yearsToRetirement - 2,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )

  // Scenario: delay 5 years
  const savingsAfterFiveYears = currentSavings * Math.pow(1 + netReturn, 5)
  const fiveYearDelayNestEgg = projectFinalSavings(
    savingsAfterFiveYears,
    monthlyContribution,
    Math.max(0, yearsToRetirement - 5),
    contributionEscalation,
    netReturn,
    compoundingMethod
  )

  const costOfOneYearDelay = baselineNestEgg - oneYearDelayNestEgg
  const costOfTwoYearDelay = baselineNestEgg - twoYearDelayNestEgg
  const costOfFiveYearDelay = baselineNestEgg - fiveYearDelayNestEgg

  return {
    baselineNestEgg,
    oneYearDelayNestEgg,
    twoYearDelayNestEgg,
    fiveYearDelayNestEgg,
    costOfOneYearDelay,
    costOfTwoYearDelay,
    costOfFiveYearDelay,
    percentageLostOneYear: (costOfOneYearDelay / baselineNestEgg) * 100,
    percentageLostTwoYear: (costOfTwoYearDelay / baselineNestEgg) * 100,
    percentageLostFiveYear: (costOfFiveYearDelay / baselineNestEgg) * 100,
  }
}
