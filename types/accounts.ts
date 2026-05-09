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
}

export interface AccountSummary {
  totalBalance: number
  totalMonthlyContribution: number
  weightedReturn: number
  weightedFees: number
}
