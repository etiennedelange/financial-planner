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

export interface MarketAssumptions {
  equityReturn: number // nominal annual %
  bondReturn: number
  cashReturn: number
  equityVolatility: number // standard deviation %
  bondVolatility: number
  inflationRate: number
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
  // Guardrails specific
  upperGuardrail?: number // % above which to increase withdrawal
  lowerGuardrail?: number // % below which to decrease withdrawal
}
