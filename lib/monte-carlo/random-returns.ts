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
  rng: RandomSource = Math.random
): number {
  // The source can return exactly 0; Math.log(0) = -Infinity would poison
  // the whole draw. Number.MIN_VALUE is indistinguishable from 0 for this purpose.
  const u1 = rng() || Number.MIN_VALUE
  const u2 = rng()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + stdDev * z0
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
  rng: RandomSource = Math.random
): number[] {
  const returns: number[] = []

  for (let i = 0; i < years; i++) {
    // Use log-normal distribution for realistic return modeling
    // Adjust mean to account for volatility drag
    const logMean = Math.log(1 + expectedReturn) - (volatility * volatility) / 2
    const logReturn = randomNormal(logMean, volatility, rng)
    returns.push(Math.exp(logReturn) - 1)
  }

  return returns
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
