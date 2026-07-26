// South African financial defaults
export const SA_DEFAULTS = {
  // Inflation & returns
  inflation: 0.055, // 5.5%
  medicalInflation: 0.09, // 9% - SA medical costs grow faster than general inflation
  equityReturn: 0.11, // 11%
  bondReturn: 0.08, // 8%
  cashReturn: 0.065, // 6.5%

  // Volatility
  equityVolatility: 0.165, // 16.5%
  bondVolatility: 0.06, // 6%

  // Retirement planning
  safeWithdrawalRate: 0.035, // 3.5% (more conservative for SA conditions)
  lifeExpectancy: 90,
  contributionEscalation: 0.06, // 6%

  // Medical costs in retirement (monthly, today's Rands)
  baseMedicalCostMonthly: 3500, // Base medical aid contribution
  medicalCostGrowthAge: 0.02, // Additional 2% per year of age over 65

  // Default ages
  defaultCurrentAge: 35,
  defaultRetirementAge: 65,

  // Default values for new accounts
  defaultExpectedReturn: 10, // 10%
  defaultAnnualFees: 1, // 1%
  defaultContributionEscalation: 6, // 6%
} as const

/**
 * Multiply a decimal rate by 100 for display, without the floating-point tail.
 *
 * `0.035 * 100` is `3.5000000000000004` in IEEE-754. These values are not display-only:
 * `calculator-store.ts` seeds `drawdownConfig.initialWithdrawalRate` from
 * `safeWithdrawalRate`, so the artefact was reaching application state and any serialised
 * plan or share link built from it — as well as rendering verbatim in the debug window.
 *
 * Rounded to 4 decimal places, which is far finer than any rate this app expresses while
 * still removing the tail.
 */
function toPercent(decimalRate: number): number {
  return Math.round(decimalRate * 100 * 10000) / 10000
}

// Display-friendly percentages (multiply decimals by 100)
export const SA_DEFAULTS_DISPLAY = {
  inflation: toPercent(SA_DEFAULTS.inflation),
  medicalInflation: toPercent(SA_DEFAULTS.medicalInflation),
  equityReturn: toPercent(SA_DEFAULTS.equityReturn),
  bondReturn: toPercent(SA_DEFAULTS.bondReturn),
  cashReturn: toPercent(SA_DEFAULTS.cashReturn),
  equityVolatility: toPercent(SA_DEFAULTS.equityVolatility),
  bondVolatility: toPercent(SA_DEFAULTS.bondVolatility),
  safeWithdrawalRate: toPercent(SA_DEFAULTS.safeWithdrawalRate),
  contributionEscalation: toPercent(SA_DEFAULTS.contributionEscalation),
} as const
