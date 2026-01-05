import type { PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod } from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { projectFinalSavings } from "./utils/projection"

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
}

/**
 * Calculate optimal monthly contribution using binary search
 * Finds the minimum contribution needed to achieve desired retirement income
 */
export function calculateOptimalContribution(
  params: OptimalContributionParams
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

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflationRate = retirementGoals.inflationRate / 100
  const netReturn = expectedReturn - fees

  // Calculate target nest egg based on desired income
  const desiredMonthlyAtRetirement =
    retirementGoals.desiredMonthlyIncome * Math.pow(1 + inflationRate, yearsToRetirement)
  const desiredAnnualAtRetirement = desiredMonthlyAtRetirement * 12

  // Use withdrawal rate to determine required nest egg
  const withdrawalRate = drawdownConfig.initialWithdrawalRate / 100
  const targetNestEgg = desiredAnnualAtRetirement / withdrawalRate

  // Binary search to find optimal contribution
  let minContribution = 0
  let maxContribution = 100000 // Upper limit in ZAR
  let optimalContribution = 0

  // Handle edge case: already have enough
  const currentProjection = projectFinalSavings(
    currentSavings,
    0,
    yearsToRetirement,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )
  if (currentProjection >= targetNestEgg) {
    return {
      optimalMonthlyContribution: 0,
      targetNestEgg,
      projectedNestEgg: currentProjection,
      yearsToRetirement,
    }
  }

  while (maxContribution - minContribution > 100) {
    // Within R100 precision
    const midContribution = (minContribution + maxContribution) / 2

    const finalSavings = projectFinalSavings(
      currentSavings,
      midContribution,
      yearsToRetirement,
      contributionEscalation,
      netReturn,
      compoundingMethod
    )

    if (finalSavings >= targetNestEgg) {
      maxContribution = midContribution
      optimalContribution = midContribution
    } else {
      minContribution = midContribution
    }
  }

  // Get projected nest egg with optimal contribution
  const projectedNestEgg = projectFinalSavings(
    currentSavings,
    optimalContribution,
    yearsToRetirement,
    contributionEscalation,
    netReturn,
    compoundingMethod
  )

  return {
    optimalMonthlyContribution: Math.ceil(optimalContribution / 100) * 100, // Round up to nearest R100
    targetNestEgg,
    projectedNestEgg,
    yearsToRetirement,
  }
}
