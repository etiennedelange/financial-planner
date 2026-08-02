import type { Account } from "@/types"

export const SEED_ACCOUNTS: Omit<Account, "id">[] = [
  {
    name: "qweqwe",
    provider: "qweqw",
    type: "retirement_annuity",
    currentBalance: 165000,
    monthlyContribution: 5000,
    expectedReturn: 10.5,
    annualFees: 1.9,
    contributionEscalation: 10,
  },
  {
    name: "p",
    provider: "p",
    type: "pension_fund",
    currentBalance: 1750000,
    monthlyContribution: 15000,
    expectedReturn: 10.5,
    annualFees: 1.5,
    contributionEscalation: 5,
  },
  {
    name: "tfsa",
    provider: "tfsa",
    type: "tfsa",
    currentBalance: 80000,
    monthlyContribution: 3000,
    expectedReturn: 10.5,
    annualFees: 1.8,
    contributionEscalation: 6,
    tfsaContributionsToDate: 85000,
  },
]
