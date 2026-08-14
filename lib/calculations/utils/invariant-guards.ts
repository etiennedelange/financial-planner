/**
 * Runtime guards for engine invariants that must never be violated.
 *
 * Phase 10 Step 5. The projection engine clamps balances with `Math.max(0, …)` before
 * writing them into a `YearlyProjection`. That clamp protects rendering, but on its own it
 * also *hides* a defect: if the engine's arithmetic ever produced a negative balance, the
 * clamp would quietly turn it into 0 and nobody would learn about it. Two of the old
 * invariant tests were unfalsifiable for exactly this reason — they asserted
 * `endingBalance >= 0`, which the clamp guarantees regardless of whether the logic is right.
 *
 * The guard below closes that gap: the clamp stays (so a bug cannot render as a negative
 * portfolio), but a negative value now raises before it can be clamped.
 *
 * Phase 9.1 added `finiteOrZero` / `safePositiveDivide` / `sanitizeAccounts`: NaN/Infinity
 * inputs (direct engine calls, debug tools, malformed saved plans) must not poison every
 * downstream division into NaN/Infinity — they degrade to a safe finite value instead.
 */
import type { Account } from "@/types"

/**
 * Assert that a balance has not gone negative, then return it unchanged.
 *
 * A negative balance is an engine defect, not a state to display: withdrawals are capped
 * at the available balance, so no valid input can produce one. Probed across 360 scenario
 * combinations (5 opening balances x 3 contribution levels x 4 strategies x 2 lump-sum
 * settings x 3 income targets) with zero occurrences, so this should never fire in
 * practice — that is the point of it.
 *
 * Deliberately does NOT throw on `NaN`: NaN is a distinct defect with its own guards
 * (see `money-time.ts` and `calculateReplacementRatio`), and reporting it as a negative
 * balance would send whoever is debugging down the wrong path. `-0` is likewise allowed —
 * it arises from ordinary float arithmetic and means zero.
 *
 * @param value - the balance to check
 * @param context - where it came from, e.g. "drawdown year age 70"; appears in the error
 */
export function assertNonNegativeBalance(value: number, context: string): number {
  // `value < 0` is false for both NaN and -0, which is exactly what we want.
  if (value < 0) {
    throw new Error(
      `projection-engine invariant violated: negative balance (${value}) at ${context}. ` +
        `Withdrawals are capped at the available balance, so this indicates an arithmetic ` +
        `defect in the engine rather than an input problem.`
    )
  }
  return value
}

/**
 * Return 0 for non-finite input, else the value unchanged.
 *
 * Used at the engine entry points so a NaN/Infinity input (direct API/test usage,
 * debug tools, malformed saved plans) cannot poison every downstream division
 * into NaN. Matches the money-time convention: a broken input degrades to a safe
 * zero rather than throwing or propagating.
 */
export function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0
}

/**
 * Guarded division: returns `fallback` (default 0) when the denominator is not
 * positive-finite, preventing the division from producing NaN/±Infinity.
 *
 * Used at the engine division points that previously divided unconditionally
 * (e.g. `gainFraction` at projection-engine) — a zero or NaN denominator there
 * used to leak NaN into the CGT/tax arithmetic for the whole year.
 */
export function safePositiveDivide(
  numerator: number,
  denominator: number,
  fallback: number = 0
): number {
  return Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0
    ? numerator / denominator
    : fallback
}

/**
 * Return a copy of `accounts` with every non-finite numeric field coerced to 0.
 *
 * Applied at the engine entry points so a NaN/Infinity balance, return, fee, or
 * escalation (direct API/test usage, debug tools, malformed saved plans) cannot
 * poison the compounding arithmetic. Finite values pass through unchanged, so
 * this never alters the output for valid inputs.
 */
export function sanitizeAccounts(accounts: Account[]): Account[] {
  return accounts.map((acc) => ({
    ...acc,
    currentBalance: finiteOrZero(acc.currentBalance),
    monthlyContribution: finiteOrZero(acc.monthlyContribution),
    expectedReturn: finiteOrZero(acc.expectedReturn),
    annualFees: finiteOrZero(acc.annualFees),
    contributionEscalation: finiteOrZero(acc.contributionEscalation),
    tfsaContributionsToDate:
      acc.tfsaContributionsToDate === undefined
        ? undefined
        : finiteOrZero(acc.tfsaContributionsToDate),
  }))
}
