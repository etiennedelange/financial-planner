/**
 * A source of uniform random numbers in [0, 1). Defaults to `Math.random` everywhere,
 * so callers that do not care about reproducibility are unaffected.
 */
export type RandomSource = () => number

/**
 * Deterministic PRNG (mulberry32) for reproducible simulations.
 *
 * Monte Carlo was previously unseeded, which had two costs: simulation results could not
 * be pinned by the golden harness, and at least one integration test was flaky because it
 * asserted a threshold against a 50-draw sample. `SimulationConfig.randomSeed` existed in
 * the type but was never read by the engine.
 *
 * mulberry32 is chosen for being tiny, dependency-free and fast, with a period (2^32) far
 * beyond what a retirement simulation consumes. It is NOT cryptographically secure and
 * must never be used for anything security-related.
 */
export function createSeededRandom(seed: number): RandomSource {
  // Coerce to a 32-bit integer; a non-finite seed would otherwise produce NaN forever.
  let a = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Box-Muller transform for generating normally distributed random numbers
 *
 * @param rng - source of uniform randomness; defaults to `Math.random`
 */
export function randomNormal(
  mean: number,
  stdDev: number,
  rng: RandomSource = Math.random,
): number {
  // The source can return exactly 0; Math.log(0) = -Infinity would poison
  // the whole draw. Number.MIN_VALUE is indistinguishable from 0 for this purpose.
  const u1 = rng() || Number.MIN_VALUE
  const u2 = rng()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + stdDev * z0
}

/**
 * One standard-normal draw per year: the market shock that every account in a simulation
 * run shares.
 *
 * Accounts used to draw independent sequences, i.e. zero correlation. Every account is
 * given the same equity volatility, so they are modelled as the same risky market — yet
 * splitting one portfolio across three identical accounts shrank its volatility by
 * roughly 1/sqrt(3) and lifted the success rate from 90% to 99% for the same money.
 * A shared shock makes the accounts perfectly correlated, consistent with that
 * single-market assumption.
 */
export function generateMarketShocks(years: number, rng: RandomSource = Math.random): number[] {
  const shocks: number[] = []
  for (let i = 0; i < years; i++) shocks.push(randomNormal(0, 1, rng))
  return shocks
}

/**
 * Correlated yearly shocks for a one-factor model: one market shock per year plus one
 * idiosyncratic shock per group (investment type), combined as
 *
 *   shock_g(t) = √ρ_g · z_market(t) + √(1 − ρ_g) · z_g(t)
 *
 * so every shock is standard normal, two groups correlate √(ρ_i · ρ_j), and accounts in the
 * same group share an identical sequence (splitting a portfolio across accounts of one
 * type cannot diversify it against itself).
 *
 * Reproducibility and backward compatibility: the market shocks are drawn first, exactly
 * as `generateMarketShocks` draws them, and a group with ρ = 1 consumes no further draws.
 * A plan whose accounts all load fully on the market therefore consumes the generator
 * identically to the pre-factor engine. Other groups draw their idiosyncratic sequences
 * afterwards in the iteration order of `loadings`, so callers must pass a stable order.
 *
 * @param loadings - group id → ρ in [0, 1]; values outside are clamped, non-finite → 1
 */
export function generateFactorShocks(
  years: number,
  loadings: ReadonlyMap<string, number>,
  rng: RandomSource = Math.random,
): { market: number[]; groups: Map<string, number[]> } {
  const market = generateMarketShocks(years, rng)
  const groups = new Map<string, number[]>()
  for (const [group, rawLoading] of loadings) {
    const rho = Number.isFinite(rawLoading) ? Math.min(1, Math.max(0, rawLoading)) : 1
    if (rho === 1) {
      groups.set(group, market)
      continue
    }
    const own = generateMarketShocks(years, rng)
    const a = Math.sqrt(rho)
    const b = Math.sqrt(1 - rho)
    groups.set(
      group,
      market.map((z, t) => a * z + b * own[t]),
    )
  }
  return { market, groups }
}

/**
 * Annual log-normal returns for one account from a shared shock sequence.
 *
 * `expectedReturn` is the TYPICAL (median, compound) annual return: logMean = ln(1 + r),
 * with no volatility-drag correction. Every year's median simple return is therefore r,
 * the median path compounds at exactly r, and the deterministic projection sits in the
 * middle of the Monte Carlo range. The arithmetic mean of the draws is higher,
 * (1 + r)·e^(σ²/2) − 1. Decided 2026-11-04, because SA fund and index long-run returns
 * are quoted as compound (CAGR) figures; before that the log mean was lowered by σ²/2 so
 * the arithmetic mean equalled r and the median path landed ~34% below the projection
 * after 30 years at σ = 16.5%.
 */
export function returnsFromShocks(
  expectedReturn: number,
  volatility: number,
  shocks: number[],
): number[] {
  const logMean = Math.log(1 + expectedReturn)
  return shocks.map((z) => Math.exp(logMean + volatility * z) - 1)
}

/**
 * Generate a sequence of random annual returns using log-normal distribution
 * This is more realistic for modeling investment returns
 *
 * @param rng - source of uniform randomness; pass `createSeededRandom(seed)` for a
 *   reproducible sequence. Defaults to `Math.random`.
 */
export function generateReturnSequence(
  expectedReturn: number,
  volatility: number,
  years: number,
  rng: RandomSource = Math.random,
): number[] {
  return returnsFromShocks(expectedReturn, volatility, generateMarketShocks(years, rng))
}

/**
 * Get percentile value from a sorted array
 */
export function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0

  const index = (percentile / 100) * (sortedArray.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower

  if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1]
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
}
