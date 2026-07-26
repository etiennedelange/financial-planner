import type { DrawdownConfig } from "@/types"
import { escalate } from "./money-time"

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
 * Which baseline a caller wants the withdrawal measured against.
 *
 * The deterministic projection and the Monte Carlo simulation legitimately ask
 * different questions, and this argument names that difference instead of leaving
 * it implicit in an omitted parameter:
 *
 * - `'strategy'` — pure strategy mathematics: "what does this strategy actually pay?"
 *   Used by the deterministic projection engine.
 * - `'desiredIncomeFloor'` — strategy mathematics, but never below the user's desired
 *   income: "can the user achieve their goal?" Used by Monte Carlo, because a success
 *   rate measured against a percentage-of-portfolio withdrawal would approach 100% for
 *   `fixed_percentage` in all cases (a percentage of a shrinking balance never depletes)
 *   and the metric would be meaningless.
 */
export type WithdrawalBaseline = "strategy" | "desiredIncomeFloor"

/**
 * Compute the year-0 (first drawdown year) annual withdrawal, per strategy.
 *
 * This is the single source of truth for the initial withdrawal. It previously existed
 * three times — privately in `projection-engine.ts`, again in `simulation-engine.ts`
 * with different semantics, and copied verbatim into `components/debug/debug-window.tsx`
 * — which let the deterministic projection and the Monte Carlo success rate model
 * different plans from identical inputs.
 *
 * @param portfolioValue - Portfolio at retirement, AFTER any lump-sum commutation
 * @param desiredMonthlyIncomeToday - Desired monthly income in TODAY's rands
 * @param config - Drawdown configuration (strategy, rate, min/max)
 * @param yearsToRetirement - Years from today to the retirement date, for escalating
 *   today's-rand inputs to their nominal value at retirement
 * @param inflationRate - Annual inflation rate (decimal, e.g. 0.055)
 * @param baseline - See {@link WithdrawalBaseline}. Required: callers must state intent.
 */
export function calculateInitialWithdrawal(
  portfolioValue: number,
  desiredMonthlyIncomeToday: number,
  config: DrawdownConfig,
  yearsToRetirement: number,
  inflationRate: number,
  baseline: WithdrawalBaseline
): number {
  const desiredAnnualAtRetirement =
    escalate(desiredMonthlyIncomeToday * 12, yearsToRetirement, inflationRate)

  switch (config.strategy) {
    case "fixed_percentage": {
      const target = portfolioValue * (config.initialWithdrawalRate / 100)
      return baseline === "desiredIncomeFloor"
        ? Math.max(target, desiredAnnualAtRetirement)
        : target
    }

    case "fixed_amount_inflation_adjusted":
      // Both baselines agree: this strategy IS the desired income.
      return desiredAnnualAtRetirement

    case "variable_percentage":
    case "guardrails":
      // The min/max band is a user input and applies to both baselines. Monte Carlo
      // previously skipped it at year 0 while `calculateNextWithdrawal` applied it from
      // year 1 onward, so the simulation disagreed with itself across that boundary.
      return clampToInflatedBounds(
        desiredAnnualAtRetirement,
        config,
        yearsToRetirement,
        inflationRate
      )

    default:
      return portfolioValue * (config.initialWithdrawalRate / 100)
  }
}

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
        escalate(desiredMonthlyIncomeToday * 12, yearsSinceToday, inflationRate)
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
  const minAtYear = escalate(config.minimumWithdrawal * 12, yearsSinceToday, inflationRate)
  const maxAtYear = escalate(config.maximumWithdrawal * 12, yearsSinceToday, inflationRate)
  return Math.min(Math.max(amount, minAtYear), maxAtYear)
}
