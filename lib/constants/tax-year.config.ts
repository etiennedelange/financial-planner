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
  { min: 0,       max: 237100,   rate: 0.18, baseTax: 0      },
  { min: 237100,  max: 370500,   rate: 0.26, baseTax: 42678  },
  { min: 370500,  max: 512800,   rate: 0.31, baseTax: 77362  },
  { min: 512800,  max: 673000,   rate: 0.36, baseTax: 121475 },
  { min: 673000,  max: 857900,   rate: 0.39, baseTax: 179147 },
  { min: 857900,  max: 1817000,  rate: 0.41, baseTax: 251258 },
  { min: 1817000, max: Infinity, rate: 0.45, baseTax: 644489 },
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
  annualLimit:   36000,  // R36,000 p.a.
  lifetimeLimit: 500000, // R500,000 lifetime
} as const

// ---------------------------------------------------------------------------
// Medical aid tax credits (s6A of the Income Tax Act)
// These are direct reductions of tax payable, not deductions from income.
// Source: SARS Budget Tax Guide 2026/2027
// ---------------------------------------------------------------------------
export const MEDICAL_AID_CREDITS_CONFIG = {
  primaryMemberMonthly:      364, // Principal member
  firstDependantMonthly:     364, // First additional beneficiary
  additionalDependantMonthly: 246, // Each further beneficiary
} as const
