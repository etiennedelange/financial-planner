import type { Account } from "@/types"

/**
 * Whole-portfolio aggregates for the single-portfolio calculators (optimal contribution,
 * cost of delay, investment scenarios), which take one return, fee and escalation rather
 * than per-account values.
 *
 * Previously copied verbatim into the Charts page and the Insights panel; the Risk page
 * needed it a third time, so it is exported here instead (CLAUDE.md: never copy
 * calculation logic).
 */
export interface PortfolioTotals {
  totalBalance: number
  totalContribution: number
  /** Balance-weighted expected return, decimal; 10% when there is no balance to weight by */
  weightedReturn: number
  /** Balance-weighted annual fees, decimal; 1% when there is no balance to weight by */
  weightedFees: number
  /** Simple average of contribution escalation, decimal; 6% when there are no accounts */
  avgEscalation: number
}

export function computePortfolioTotals(accounts: Account[]): PortfolioTotals {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const totalContribution = accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
  const weighted = (pick: (acc: Account) => number, fallback: number) =>
    totalBalance > 0
      ? accounts.reduce(
          (sum, acc) => sum + (pick(acc) / 100) * (acc.currentBalance / totalBalance),
          0,
        )
      : fallback
  return {
    totalBalance,
    totalContribution,
    weightedReturn: weighted((acc) => acc.expectedReturn, 0.1),
    weightedFees: weighted((acc) => acc.annualFees, 0.01),
    avgEscalation:
      accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) / accounts.length
        : 0.06,
  }
}
