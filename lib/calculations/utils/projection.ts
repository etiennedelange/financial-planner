import type { CompoundingMethod } from "@/types"

/**
 * Project final savings using monthly compounding
 * Single source of truth for all accumulation calculations
 *
 * @param currentSavings - Starting balance
 * @param monthlyContribution - Fixed monthly contribution amount
 * @param years - Number of years to project
 * @param contributionGrowth - Annual contribution escalation rate (decimal, e.g., 0.06 for 6%)
 * @param annualReturn - Annual return rate (decimal, net of fees, e.g., 0.12 for 12%)
 * @param compoundingMethod - 'nominal' for Excel FV compatibility, 'compound' for actuarial accuracy
 * @returns Projected balance after specified years
 *
 * @example
 * // Excel FV compatible (nominal method)
 * projectFinalSavings(100000, 1000, 30, 0.06, 0.12, 'nominal')
 *
 * // Actuarially correct (compound method)
 * projectFinalSavings(100000, 1000, 30, 0.06, 0.12, 'compound')
 */
export function projectFinalSavings(
  currentSavings: number,
  monthlyContribution: number,
  years: number,
  contributionGrowth: number,
  annualReturn: number,
  compoundingMethod: CompoundingMethod
): number {
  if (years <= 0) return currentSavings

  let totalSavings = currentSavings

  // Calculate monthly return based on compounding method
  const monthlyReturn = calculateMonthlyReturn(annualReturn, compoundingMethod)

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
 * Calculate monthly return from annual return
 * Exported for testing and debug purposes
 *
 * @param annualReturn - Annual return rate (decimal, e.g., 0.12 for 12%)
 * @param method - Compounding method to use
 * @returns Monthly return rate (decimal)
 *
 * @example
 * // Nominal (Excel-compatible): 12% / 12 = 1%
 * calculateMonthlyReturn(0.12, 'nominal') // 0.01
 *
 * // Compound (Actuarially correct): (1.12)^(1/12) - 1 ≈ 0.9489%
 * calculateMonthlyReturn(0.12, 'compound') // 0.009488793
 */
export function calculateMonthlyReturn(
  annualReturn: number,
  method: CompoundingMethod
): number {
  return method === 'compound'
    ? Math.pow(1 + annualReturn, 1 / 12) - 1  // Actuarially correct: (1 + r)^(1/12) - 1
    : annualReturn / 12  // Excel-compatible nominal: r / 12
}

/**
 * Get a human-readable description of the monthly return calculation
 * Useful for debug output and user documentation
 *
 * @param annualReturn - Annual return rate (decimal)
 * @param method - Compounding method
 * @returns Formatted string showing the calculation
 *
 * @example
 * formatMonthlyReturnFormula(0.12, 'nominal')
 * // "0.1200 / 12 = 0.010000 (1.000% per month)"
 *
 * formatMonthlyReturnFormula(0.12, 'compound')
 * // "(1 + 0.1200)^(1/12) - 1 = 0.009489 (0.949% per month)"
 */
export function formatMonthlyReturnFormula(
  annualReturn: number,
  method: CompoundingMethod
): string {
  const monthlyReturn = calculateMonthlyReturn(annualReturn, method)
  const monthlyPercent = (monthlyReturn * 100).toFixed(3)

  if (method === 'compound') {
    return `(1 + ${annualReturn.toFixed(4)})^(1/12) - 1 = ${monthlyReturn.toFixed(6)} (${monthlyPercent}% per month)`
  } else {
    return `${annualReturn.toFixed(4)} / 12 = ${monthlyReturn.toFixed(6)} (${monthlyPercent}% per month)`
  }
}
