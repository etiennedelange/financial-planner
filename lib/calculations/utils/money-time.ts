/**
 * Money–time utilities: the single place where amounts move between points in time.
 *
 * WHY THIS MODULE EXISTS
 *
 * Every rand figure in this app carries an implicit *basis* — the date whose purchasing
 * power it is expressed in. A withdrawal at retirement and a salary today are both "rands",
 * but dividing one by the other is meaningless. Before this module the codebase had 21
 * hand-rolled `Math.pow(1 + inflation, n)` expressions across 10 files, using five
 * different exponent expressions, and the two most recent P0 bugs were both a wrong
 * exponent:
 *
 *   - replacement ratio divided a nominal at-retirement rand by a present-day rand,
 *     overstating it by (1+i)^yearsToRetirement — a 5x error over 30 years
 *   - `inflationAdjustedWithdrawal` used ^year instead of ^(yearsToRetirement + year)
 *
 * Rules:
 *   1. Never write `Math.pow(1 + inflation…)` outside this file. Use `escalate`/`deflate`.
 *   2. Rates are ALWAYS decimals here (0.055), never percentages (5.5). Convert once at
 *      the boundary with `percentToRate`.
 *   3. When two amounts meet in an expression, they must share a basis. The `Rands<B>`
 *      types below make that checkable at compile time on the paths that have burned us.
 */

// ---------------------------------------------------------------------------
// Rate handling
// ---------------------------------------------------------------------------

/** An annual rate as a decimal fraction, e.g. 0.055 for 5.5%. */
export type DecimalRate = number

/**
 * Convert a user-facing percentage (5.5) into a decimal rate (0.055).
 *
 * Call this ONCE at the store/props boundary. Below that boundary every rate is already
 * a decimal, so a stray `/ 100` deeper in the stack is a bug.
 */
export function percentToRate(percent: number): DecimalRate {
  if (!Number.isFinite(percent)) return 0
  return percent / 100
}

// ---------------------------------------------------------------------------
// Core time-value operations
// ---------------------------------------------------------------------------

/**
 * Compound growth factor over `years` at `rate`.
 *
 * Returns 1 (identity) for non-finite input so a broken rate cannot silently poison an
 * otherwise valid amount — the caller keeps its money rather than getting NaN.
 */
export function inflationFactor(years: number, rate: DecimalRate): number {
  if (!Number.isFinite(years) || !Number.isFinite(rate)) return 1
  return Math.pow(1 + rate, years)
}

/**
 * Move an amount FORWARD in time (today's rands → nominal rands `years` from now).
 *
 * @param amount - the amount in its starting basis
 * @param years - how many years forward; negative values move backward
 * @param rate - annual inflation as a decimal (0.055), not a percentage
 */
export function escalate(amount: number, years: number, rate: DecimalRate): number {
  if (!Number.isFinite(amount)) return 0
  return amount * inflationFactor(years, rate)
}

/**
 * Move an amount BACKWARD in time (nominal rands `years` from now → today's rands).
 *
 * Exact inverse of {@link escalate} for the same `years` and `rate`.
 */
export function deflate(amount: number, years: number, rate: DecimalRate): number {
  if (!Number.isFinite(amount)) return 0
  const factor = inflationFactor(years, rate)
  return factor === 0 ? 0 : amount / factor
}

// ---------------------------------------------------------------------------
// Basis-tagged amounts
// ---------------------------------------------------------------------------

declare const BASIS: unique symbol

/** The date whose purchasing power an amount is expressed in. */
export type MoneyBasis = 'today' | 'atRetirement'

/**
 * A rand amount tagged with the point in time it is expressed in.
 *
 * This is a compile-time-only tag — at runtime it is just a number, so it costs nothing.
 * Use it on any function where mixing bases is a realistic mistake; `Rands<'today'>` and
 * `Rands<'atRetirement'>` are not assignable to each other, so the compiler rejects the
 * comparison instead of the user discovering it in a wrong figure on screen.
 */
export type Rands<B extends MoneyBasis> = number & { readonly [BASIS]: (basis: B) => B }

/** Tag an amount as being in today's rands. */
export function todayRands(amount: number): Rands<'today'> {
  return amount as Rands<'today'>
}

/** Tag an amount as being in nominal rands at the retirement date. */
export function retirementRands(amount: number): Rands<'atRetirement'> {
  return amount as Rands<'atRetirement'>
}

/** Today's rands → nominal rands at the retirement date. */
export function escalateToRetirement(
  amount: Rands<'today'>,
  yearsToRetirement: number,
  rate: DecimalRate
): Rands<'atRetirement'> {
  return escalate(amount, yearsToRetirement, rate) as Rands<'atRetirement'>
}

/** Nominal rands at the retirement date → today's rands. */
export function deflateToToday(
  amount: Rands<'atRetirement'>,
  yearsToRetirement: number,
  rate: DecimalRate
): Rands<'today'> {
  return deflate(amount, yearsToRetirement, rate) as Rands<'today'>
}
