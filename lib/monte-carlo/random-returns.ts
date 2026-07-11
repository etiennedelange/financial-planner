/**
 * Box-Muller transform for generating normally distributed random numbers
 */
export function randomNormal(mean: number, stdDev: number): number {
  // Math.random() can return exactly 0; Math.log(0) = -Infinity would poison
  // the whole draw. Number.MIN_VALUE is indistinguishable from 0 for this purpose.
  const u1 = Math.random() || Number.MIN_VALUE
  const u2 = Math.random()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + stdDev * z0
}

/**
 * Generate a sequence of random annual returns using log-normal distribution
 * This is more realistic for modeling investment returns
 */
export function generateReturnSequence(
  expectedReturn: number,
  volatility: number,
  years: number
): number[] {
  const returns: number[] = []

  for (let i = 0; i < years; i++) {
    // Use log-normal distribution for realistic return modeling
    // Adjust mean to account for volatility drag
    const logMean = Math.log(1 + expectedReturn) - (volatility * volatility) / 2
    const logReturn = randomNormal(logMean, volatility)
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
