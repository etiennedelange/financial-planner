/**
 * SA Tax Year Configuration — 2026/2027
 *
 * To update for a new tax year:
 *  1. Change TAX_YEAR below
 *  2. Update every value in this file from the SARS Budget Tax Guide
 *  3. Run `npm test` — failing tests will show you what changed
 *
 * Source: https://www.sars.gov.za/wp-content/uploads/Docs/Budget/Budget2026/Budget-tax-guide-2026-web-version.pdf
 */

export const TAX_YEAR = '2026/2027'

// ---------------------------------------------------------------------------
// Income tax brackets
// min = lower bound of bracket (inclusive), max = upper bound (inclusive)
// ---------------------------------------------------------------------------
export const INCOME_TAX_BRACKETS_CONFIG = [
  { min: 0,       max: 245100,   rate: 0.18, baseTax: 0      },
  { min: 245100,  max: 383100,   rate: 0.26, baseTax: 44118  },
  { min: 383100,  max: 530200,   rate: 0.31, baseTax: 79998  },
  { min: 530200,  max: 695800,   rate: 0.36, baseTax: 125599 },
  { min: 695800,  max: 887000,   rate: 0.39, baseTax: 185215 },
  { min: 887000,  max: 1878600,  rate: 0.41, baseTax: 259783 },
  { min: 1878600, max: Infinity, rate: 0.45, baseTax: 666339 },
] as const

// ---------------------------------------------------------------------------
// Retirement / severance lump sum tax table
// threshold = upper bound of tier; previousTax = cumulative tax at lower bound
// ---------------------------------------------------------------------------
export const RETIREMENT_LUMP_SUM_CONFIG = [
  { threshold: 550000,  rate: 0,    previousTax: 0      },
  { threshold: 770000,  rate: 0.18, previousTax: 0      },
  { threshold: 1155000, rate: 0.27, previousTax: 39600  },
  { threshold: Infinity, rate: 0.36, previousTax: 143550 },
] as const

// ---------------------------------------------------------------------------
// Maximum share of a pension/RA/preservation fund that may be commuted as a
// lump sum at retirement — the rest must be annuitised. SA law caps this at
// one-third of the retirement-fund interest.
// ---------------------------------------------------------------------------
export const MAX_LUMP_SUM_COMMUTATION_PERCENTAGE = 100 / 3

// ---------------------------------------------------------------------------
// Capital Gains Tax — annual exclusion for individuals (s5(1) Eighth Schedule)
// ---------------------------------------------------------------------------
export const CGT_ANNUAL_EXCLUSION_CONFIG = {
  individual: 50000,
} as const

// ---------------------------------------------------------------------------
// Rebates (reduce tax liability directly)
// ---------------------------------------------------------------------------
export const TAX_REBATES_CONFIG = {
  primary:   17820, // All individuals
  secondary:  9765, // Age 65–74
  tertiary:   3249, // Age 75+
} as const

// ---------------------------------------------------------------------------
// Tax-free thresholds (income below these = zero tax after rebates)
// ---------------------------------------------------------------------------
export const TAX_THRESHOLDS_CONFIG = {
  under65:  99000,
  age65to74: 153250,
  age75plus: 171300,
} as const

// ---------------------------------------------------------------------------
// Retirement fund contribution limits
// ---------------------------------------------------------------------------
export const RETIREMENT_CONTRIBUTION_LIMITS_CONFIG = {
  pensionRaDeductionRate: 0.275,  // 27.5% of greater of remuneration or taxable income
  pensionRaMaxDeduction:  430000, // Annual rand cap (R430,000 from Budget 2026)
} as const

// ---------------------------------------------------------------------------
// Tax-Free Savings Account limits
// ---------------------------------------------------------------------------
export const TFSA_LIMITS_CONFIG = {
  annualLimit:   46000,  // R46,000 p.a. (increased from R36,000 effective 1 March 2026)
  lifetimeLimit: 500000, // R500,000 lifetime
} as const

// ---------------------------------------------------------------------------
// Medical aid tax credits (s6A of the Income Tax Act)
// These are direct reductions of tax payable, not deductions from income.
// Source: SARS Budget Tax Guide 2026/2027
//
// NOTE (2026-08-14): no minimum contribution level is required to claim these flat
// credits. The 3x/4x and 7.5%-of-taxable-income thresholds apply to the s6B additional
// medical expenses credit, which this app does not model.
// ---------------------------------------------------------------------------
export const MEDICAL_AID_CREDITS_CONFIG = {
  primaryMemberMonthly:      376, // Principal member
  firstDependantMonthly:     376, // First additional beneficiary
  additionalDependantMonthly: 254, // Each further beneficiary
} as const

// ---------------------------------------------------------------------------
// Dividend withholding tax (DWT) — documented simplification, NOT modelled.
// SARS Budget Tax Guide 2026/2027: dividends paid by resident companies to individuals
// attract a final 20% dividends tax, withheld at source. The engines treat every account's
// expectedReturn as 100% capital appreciation, so no dividend stream is recognised and no
// DWT is deducted. Only discretionary accounts held in the individual's name would be
// affected (retirement funds and TFSAs are DWT-exempt wrappers). Modelling it would require
// a dividend-yield assumption splitting total return into dividend + capital components.
// ---------------------------------------------------------------------------
