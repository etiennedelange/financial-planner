// South African financial defaults
export const SA_DEFAULTS = {
  // Inflation & returns
  inflation: 0.055, // 5.5%
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

  // Default ages
  defaultCurrentAge: 35,
  defaultRetirementAge: 65,

  // Default values for new accounts
  defaultExpectedReturn: 10, // 10%
  defaultAnnualFees: 1, // 1%
  defaultContributionEscalation: 6, // 6%
} as const

// Display-friendly percentages (multiply decimals by 100)
export const SA_DEFAULTS_DISPLAY = {
  inflation: SA_DEFAULTS.inflation * 100,
  equityReturn: SA_DEFAULTS.equityReturn * 100,
  bondReturn: SA_DEFAULTS.bondReturn * 100,
  cashReturn: SA_DEFAULTS.cashReturn * 100,
  equityVolatility: SA_DEFAULTS.equityVolatility * 100,
  bondVolatility: SA_DEFAULTS.bondVolatility * 100,
  safeWithdrawalRate: SA_DEFAULTS.safeWithdrawalRate * 100,
  contributionEscalation: SA_DEFAULTS.contributionEscalation * 100,
} as const
