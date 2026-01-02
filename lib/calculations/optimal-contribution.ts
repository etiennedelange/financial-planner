import type { PersonalInfo, RetirementGoals, DrawdownConfig } from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"

interface OptimalContributionParams {
  currentSavings: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  expectedReturn: number // decimal
  fees: number // decimal
  contributionEscalation: number // decimal
}

interface OptimalContributionResult {
  optimalMonthlyContribution: number
  targetNestEgg: number
  projectedNestEgg: number
  yearsToRetirement: number
}

/**
 * Project final savings using monthly compounding
 * Matches the C# calculator's ProjectFinalSavings logic
 */
function projectFinalSavings(
  currentSavings: number,
  monthlyContribution: number,
  years: number,
  contributionGrowth: number,
  realReturn: number
): number {
  let totalSavings = currentSavings
  // Using simple division to match Excel FV and industry convention (nominal annual rate)
  // Original: const monthlyReturn = Math.pow(1 + realReturn, 1 / 12) - 1
  const monthlyReturn = realReturn / 12

  for (let year = 0; year < years; year++) {
    for (let month = 0; month < 12; month++) {
      // Apply growth first (end-of-period contributions, matches Excel FV type=0)
      totalSavings *= 1 + monthlyReturn
      // Then add contribution (smooth escalation)
      const monthlyContributionAdjusted =
        monthlyContribution * Math.pow(1 + contributionGrowth, year + month / 12)
      totalSavings += monthlyContributionAdjusted
    }
  }

  return totalSavings
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
    netReturn
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
      netReturn
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
    netReturn
  )

  return {
    optimalMonthlyContribution: Math.ceil(optimalContribution / 100) * 100, // Round up to nearest R100
    targetNestEgg,
    projectedNestEgg,
    yearsToRetirement,
  }
}
