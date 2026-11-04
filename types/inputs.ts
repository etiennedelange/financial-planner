export interface PersonalInfo {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualIncome: number // for tax calculation purposes
}

export interface RetirementGoals {
  desiredMonthlyIncome: number // in today's Rands
  inflationRate: number // annual %
  legacyAmount: number // desired inheritance
}

export type CompoundingMethod = "nominal" | "compound"

export const COMPOUNDING_METHOD_LABELS: Record<CompoundingMethod, string> = {
  nominal: "Nominal (Excel-compatible)",
  compound: "Compound (Actuarially correct)",
}

export const COMPOUNDING_METHOD_DESCRIPTIONS: Record<CompoundingMethod, string> = {
  nominal:
    "Simple division: 12% ÷ 12 = 1% per month. Matches Excel FV function but overstates effective returns by ~0.7% annually.",
  compound:
    "Compound conversion: (1.12)^(1/12) - 1 = 0.95% per month. Mathematically precise and recommended for accurate long-term projections.",
}

/**
 * How SA tax thresholds are assumed to move in future years. SARS publishes only the
 * current year's tables, so any projection beyond it is an assumption.
 *
 * - `historical` — each table rises by the share of inflation SARS actually passed on
 *   from 2016/17 to 2026/27 (see lib/constants/tax-relief-history.ts)
 * - `full`       — every threshold keeps pace with inflation
 * - `none`       — stress test: today's 2026/27 thresholds never change
 */
export type TaxThresholdRelief = "historical" | "full" | "none"

export const TAX_THRESHOLD_RELIEF_LABELS: Record<TaxThresholdRelief, string> = {
  historical: "Historical relief",
  full: "Full inflation relief",
  none: "No relief (stress test)",
}

export interface MarketAssumptions {
  equityReturn: number // nominal annual %
  bondReturn: number
  cashReturn: number
  equityVolatility: number // standard deviation %
  bondVolatility: number
  inflationRate: number
  compoundingMethod: CompoundingMethod
  /**
   * Absent on plans saved before 2026-10-31; `resolveTaxThresholdIndexation` reads that
   * as the default, `historical`.
   */
  taxThresholdRelief?: TaxThresholdRelief
}

export type DrawdownStrategy =
  | "fixed_percentage"
  | "fixed_amount_inflation_adjusted"
  | "variable_percentage"
  | "guardrails"

export const DRAWDOWN_STRATEGY_LABELS: Record<DrawdownStrategy, string> = {
  fixed_percentage: "Fixed Percentage",
  fixed_amount_inflation_adjusted: "Fixed Amount (Inflation Adjusted)",
  variable_percentage: "Variable Percentage",
  guardrails: "Guardrails Approach",
}

export interface DrawdownConfig {
  strategy: DrawdownStrategy
  initialWithdrawalRate: number // % of portfolio
  minimumWithdrawal: number // monthly floor
  maximumWithdrawal: number // monthly ceiling
  lumpSumPercentage: number // % of portfolio taken as lump sum at retirement (0-100)
  // Medical aid (retirement phase)
  monthlyMedicalAid?: number // Monthly contribution paid from retirement income
  medicalAidDependants?: number // Number of additional beneficiaries (0 = member only)
  // Guardrails specific (Guyton-Klinger decision rules)
  upperGuardrail?: number // % above target rate at which withdrawal is cut 10% (capital preservation)
  lowerGuardrail?: number // % below target rate at which withdrawal is raised 10% (prosperity rule)
}
