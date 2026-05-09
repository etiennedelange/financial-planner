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
  nominal: "Simple division: 12% ÷ 12 = 1% per month. Matches Excel FV function but overstates effective returns by ~0.7% annually.",
  compound: "Compound conversion: (1.12)^(1/12) - 1 = 0.95% per month. Mathematically precise and recommended for accurate long-term projections.",
}

export interface MarketAssumptions {
  equityReturn: number // nominal annual %
  bondReturn: number
  cashReturn: number
  equityVolatility: number // standard deviation %
  bondVolatility: number
  inflationRate: number
  compoundingMethod: CompoundingMethod
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
  monthlyMedicalAid?: number    // Monthly contribution paid from retirement income
  medicalAidDependants?: number // Number of additional beneficiaries (0 = member only)
  // Guardrails specific
  upperGuardrail?: number // % above which to increase withdrawal
  lowerGuardrail?: number // % below which to decrease withdrawal
}
