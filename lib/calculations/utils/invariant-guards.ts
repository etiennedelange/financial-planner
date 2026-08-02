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
 */

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
