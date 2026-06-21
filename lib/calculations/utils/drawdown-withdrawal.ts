import type { DrawdownConfig } from "@/types"

/**
 * Guyton-Klinger-style decision rules: when the actual withdrawal rate drifts
 * outside the configured guardrail band around the target rate, cut or raise
 * the withdrawal by this fixed step. 10% is the standard figure from the
 * original Guyton-Klinger research and is not user-configurable here.
 */
const GUARDRAIL_ADJUSTMENT_FACTOR = 0.1

/** Default guardrail band (%) when the user hasn't set upper/lowerGuardrail. */
const DEFAULT_GUARDRAIL_BAND = 20

/**
 * Recompute next year's annual withdrawal during drawdown, per strategy.
 *
 * Called once per drawdown year (year >= 1; year 0's withdrawal comes from
 * the initial-withdrawal calculation in each engine). `currentBalance` must
 * be the post-growth, pre-withdrawal portfolio balance for that year so all
 * strategies react to the live portfolio rather than a stale snapshot.
 *
 * @param previousWithdrawal - The annual withdrawal used in the prior year
 * @param currentBalance - Portfolio balance this year, after growth, before withdrawal
 * @param config - Drawdown configuration (strategy, rate, min/max, guardrails)
 * @param yearsSinceToday - Years from today to this drawdown year (yearsToRetirement + year), for inflating min/max to nominal terms
 * @param inflationRate - Annual inflation rate (decimal)
 * @param desiredMonthlyIncomeToday - Monte Carlo only: when provided, `fixed_percentage`
 *   uses the greater of the percentage-based withdrawal and this desired income (inflated
 *   to the current year), mirroring the year-0 baseline so the success-rate metric keeps
 *   testing against the user's actual income goal in every drawdown year, not just the first.
 *   Omit for the deterministic engine, which uses a pure percentage-of-portfolio.
 */
export function calculateNextWithdrawal(
  previousWithdrawal: number,
  currentBalance: number,
  config: DrawdownConfig,
  yearsSinceToday: number,
  inflationRate: number,
  desiredMonthlyIncomeToday?: number
): number {
  switch (config.strategy) {
    case "fixed_percentage": {
      // True percentage-of-portfolio: re-derived from the live balance every
      // year, so it falls when the portfolio falls and rises when it grows.
      const target = currentBalance * (config.initialWithdrawalRate / 100)
      if (desiredMonthlyIncomeToday === undefined) return target
      const desiredAnnualAtYear =
        desiredMonthlyIncomeToday * 12 * Math.pow(1 + inflationRate, yearsSinceToday)
      return Math.max(target, desiredAnnualAtYear)
    }

    case "variable_percentage": {
      // Percentage-of-portfolio, bounded by an inflation-adjusted floor/ceiling
      // so a market crash or rally can't swing the withdrawal unboundedly.
      const target = currentBalance * (config.initialWithdrawalRate / 100)
      return clampToInflatedBounds(target, config, yearsSinceToday, inflationRate)
    }

    case "guardrails": {
      // Decision rules: hold the inflation-adjusted withdrawal steady unless
      // the actual rate (previous withdrawal / current balance) breaches the
      // upper or lower guardrail band around the target rate, in which case
      // apply a one-off step adjustment.
      const targetRate = config.initialWithdrawalRate / 100
      const actualRate = currentBalance > 0 ? previousWithdrawal / currentBalance : 0
      const upperBand = targetRate * (1 + (config.upperGuardrail ?? DEFAULT_GUARDRAIL_BAND) / 100)
      const lowerBand = targetRate * (1 - (config.lowerGuardrail ?? DEFAULT_GUARDRAIL_BAND) / 100)

      let next = previousWithdrawal * (1 + inflationRate)
      if (actualRate > upperBand) {
        next = previousWithdrawal * (1 - GUARDRAIL_ADJUSTMENT_FACTOR) // capital preservation rule
      } else if (actualRate < lowerBand) {
        next = previousWithdrawal * (1 + GUARDRAIL_ADJUSTMENT_FACTOR) // prosperity rule
      }

      return clampToInflatedBounds(next, config, yearsSinceToday, inflationRate)
    }

    case "fixed_amount_inflation_adjusted":
    default:
      return previousWithdrawal * (1 + inflationRate)
  }
}

function clampToInflatedBounds(
  amount: number,
  config: DrawdownConfig,
  yearsSinceToday: number,
  inflationRate: number
): number {
  const inflationFactor = Math.pow(1 + inflationRate, yearsSinceToday)
  const minAtYear = config.minimumWithdrawal * inflationFactor * 12
  const maxAtYear = config.maximumWithdrawal * inflationFactor * 12
  return Math.min(Math.max(amount, minAtYear), maxAtYear)
}
