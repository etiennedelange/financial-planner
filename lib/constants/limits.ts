import {
  TAX_REBATES_CONFIG,
  TAX_THRESHOLDS_CONFIG,
  RETIREMENT_CONTRIBUTION_LIMITS_CONFIG,
  TFSA_LIMITS_CONFIG,
  MAX_LUMP_SUM_COMMUTATION_PERCENTAGE,
  CGT_ANNUAL_EXCLUSION_CONFIG,
} from './tax-year.config'

export const SA_TAX_LIMITS = {
  // Pension/RA contribution limits
  pensionRaDeductionRate: RETIREMENT_CONTRIBUTION_LIMITS_CONFIG.pensionRaDeductionRate,
  pensionRaMaxDeduction:  RETIREMENT_CONTRIBUTION_LIMITS_CONFIG.pensionRaMaxDeduction,

  // TFSA limits
  tfsaAnnualLimit:   TFSA_LIMITS_CONFIG.annualLimit,
  tfsaLifetimeLimit: TFSA_LIMITS_CONFIG.lifetimeLimit,

  // Tax rebates
  primaryRebate:   TAX_REBATES_CONFIG.primary,
  secondaryRebate: TAX_REBATES_CONFIG.secondary,
  tertiaryRebate:  TAX_REBATES_CONFIG.tertiary,

  // Tax-free thresholds
  taxThresholdUnder65:  TAX_THRESHOLDS_CONFIG.under65,
  taxThreshold65To74:   TAX_THRESHOLDS_CONFIG.age65to74,
  taxThreshold75Plus:   TAX_THRESHOLDS_CONFIG.age75plus,

  // Capital gains tax: inclusion rate of the gain treated as taxable income (individuals)
  cgtInclusionRateIndividual: 0.40,
  // Capital gains tax: annual exclusion before inclusion rate applies (individuals)
  cgtAnnualExclusion: CGT_ANNUAL_EXCLUSION_CONFIG.individual,

  // Max % of a pension/RA/preservation fund that may be commuted as a lump sum;
  // the remainder must be annuitised (SA Income Tax Act one-third rule)
  maxLumpSumCommutationPercentage: MAX_LUMP_SUM_COMMUTATION_PERCENTAGE,
} as const
