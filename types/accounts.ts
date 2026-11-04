export type AccountType =
  | "pension_fund"
  | "retirement_annuity"
  | "preservation_fund"
  | "tfsa"
  | "discretionary"

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  pension_fund: "Pension Fund",
  retirement_annuity: "Retirement Annuity (RA)",
  preservation_fund: "Preservation Fund",
  tfsa: "Tax-Free Savings Account (TFSA)",
  discretionary: "Discretionary Investment",
}

/**
 * What an account is invested in, separate from its tax wrapper (`AccountType`). Drives its
 * Monte Carlo volatility and correlation; figures live in lib/constants/investment-types.ts.
 */
export const INVESTMENT_TYPES = [
  "cash",
  "conservative",
  "balanced",
  "sa_equity",
  "global_equity",
  "concentrated_equity",
] as const

export type InvestmentType = (typeof INVESTMENT_TYPES)[number]

export function isInvestmentType(value: unknown): value is InvestmentType {
  return typeof value === "string" && (INVESTMENT_TYPES as readonly string[]).includes(value)
}

export interface Account {
  id: string
  name: string
  provider: string
  type: AccountType
  currentBalance: number // in Rands
  monthlyContribution: number // in Rands
  expectedReturn: number // annual % (e.g., 10 for 10%)
  annualFees: number // % p.a.
  contributionEscalation: number // annual % increase
  // TFSA only: cumulative past contributions (not balance — growth doesn't count)
  tfsaContributionsToDate?: number
  // Optional: an account without one keeps the global equity volatility and moves in
  // lockstep with the market, exactly as before investment types existed
  investmentType?: InvestmentType
}

export interface AccountSummary {
  totalBalance: number
  totalMonthlyContribution: number
  weightedReturn: number
  weightedFees: number
}
