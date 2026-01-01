// South African tax limits (2024/2025 Tax Year)
export const SA_TAX_LIMITS = {
  // Pension/RA contribution limits
  pensionRaDeductionRate: 0.275, // 27.5% of income
  pensionRaMaxDeduction: 350000, // R350,000 p.a.

  // TFSA limits
  tfsaAnnualLimit: 36000, // R36,000 p.a.
  tfsaLifetimeLimit: 500000, // R500,000 lifetime

  // Tax thresholds
  primaryRebate: 17235, // Primary rebate for under 65
  secondaryRebate: 9444, // Secondary rebate for 65-74
  tertiaryRebate: 3145, // Tertiary rebate for 75+

  // Tax-free threshold
  taxThresholdUnder65: 95750,
  taxThreshold65To74: 148217,
  taxThreshold75Plus: 165689,
} as const
