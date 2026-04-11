/**
 * Spending Phase Multiplier Utility
 *
 * Models the "Go-Go, Slow-Go, No-Go" retirement spending phases.
 * This is a well-documented pattern in retirement planning that recognizes
 * spending patterns change throughout retirement.
 *
 * Phase breakdown:
 * - Go-Go (Years 0-15): Active retirement with full spending (100%)
 * - Slow-Go (Years 15-25): Reduced activity and travel (80%)
 * - No-Go (Years 25+): Less active, but higher medical costs (70% base + medical premium)
 *
 * @see https://www.kitces.com/blog/retirement-spending-smile-2/
 */

/**
 * Calculate spending phase multiplier based on years in retirement
 *
 * @param yearsInRetirement - Number of years since retirement started (0-indexed)
 * @returns Spending multiplier (0.7 to 1.2)
 *
 * @example
 * getSpendingPhaseMultiplier(5)  // Returns 1.0 (Go-Go phase)
 * getSpendingPhaseMultiplier(20) // Returns 0.8 (Slow-Go phase)
 * getSpendingPhaseMultiplier(30) // Returns 0.775 (No-Go phase with medical premium)
 */
export function getSpendingPhaseMultiplier(yearsInRetirement: number): number {
  if (yearsInRetirement <= 15) {
    // Go-Go phase: full spending - travel, hobbies, active lifestyle
    return 1.0
  } else if (yearsInRetirement <= 25) {
    // Slow-Go phase: reduced activity spending
    return 0.8
  } else {
    // No-Go phase: lower base but add medical premium
    // SA medical inflation is typically 9% vs 5.5% general inflation
    const baseRate = 0.7
    const medicalPremium = 0.15 * (yearsInRetirement - 25) / 10
    return Math.min(baseRate + medicalPremium, 1.2) // Cap at 120%
  }
}
