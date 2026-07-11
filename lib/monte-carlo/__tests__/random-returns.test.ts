import { describe, it, expect, vi } from 'vitest'
import { randomNormal, generateReturnSequence, getPercentile } from '../random-returns'

describe('randomNormal', () => {
  it('should generate normally distributed random numbers', () => {
    const samples = Array.from({ length: 1000 }, () => randomNormal(0, 1))

    // Calculate mean - should be close to 0
    const mean = samples.reduce((sum, x) => sum + x, 0) / samples.length
    expect(Math.abs(mean)).toBeLessThan(0.2)

    // Calculate variance - should be close to 1
    const variance = samples.reduce((sum, x) => sum + (x - mean) ** 2, 0) / samples.length
    expect(Math.abs(variance - 1)).toBeLessThan(0.2)
  })

  it('should respect provided mean and standard deviation', () => {
    const mean = 5
    const stdDev = 2
    const samples = Array.from({ length: 100 }, () => randomNormal(mean, stdDev))

    const sampleMean = samples.reduce((sum, x) => sum + x, 0) / samples.length
    expect(Math.abs(sampleMean - mean)).toBeLessThan(0.5)
  })

  it('should generate different values on each call', () => {
    const val1 = randomNormal(0, 1)
    const val2 = randomNormal(0, 1)
    // Extremely unlikely to be the same
    expect(val1).not.toBe(val2)
  })

  it('should stay finite when Math.random() returns exactly 0', () => {
    // Box-Muller's u1 feeds Math.log(u1); Math.random() can return exactly 0,
    // giving Math.log(0) = -Infinity and poisoning the whole draw with ±Infinity.
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.5)
    try {
      const result = randomNormal(0.1, 0.15)
      expect(Number.isFinite(result)).toBe(true)
    } finally {
      randomSpy.mockRestore()
    }
  })
})

describe('generateReturnSequence', () => {
  it('should generate correct number of returns', () => {
    const returns = generateReturnSequence(0.10, 0.15, 30)
    expect(returns.length).toBe(30)
  })

  it('should generate returns with log-normal distribution', () => {
    const returns = generateReturnSequence(0.10, 0.15, 100)

    // All returns should be numbers
    expect(returns.every((r) => typeof r === 'number')).toBe(true)

    // Returns should be reasonable (typically -50% to +50%)
    expect(returns.every((r) => r > -0.99 && r < 2)).toBe(true)
  })

  it('should have mean close to expected return', () => {
    const returns = generateReturnSequence(0.12, 0.15, 1000)
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length

    // Mean should be roughly close to expected return
    expect(Math.abs(mean - 0.12)).toBeLessThan(0.05)
  })

  it('should have volatility close to specified volatility', () => {
    const returns = generateReturnSequence(0.10, 0.16, 1000)

    // Calculate sample volatility
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length
    const variance = returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / returns.length
    const sampleVolatility = Math.sqrt(variance)

    // Should be reasonably close to 0.16
    expect(Math.abs(sampleVolatility - 0.16)).toBeLessThan(0.05)
  })

  it('should handle zero volatility', () => {
    const returns = generateReturnSequence(0.10, 0, 10)

    // With zero volatility, all returns should be approximately the expected return
    expect(returns.every((r) => Math.abs(r - 0.10) < 0.01)).toBe(true)
  })

  it('should handle different time periods', () => {
    const short = generateReturnSequence(0.10, 0.15, 5)
    const long = generateReturnSequence(0.10, 0.15, 50)

    expect(short.length).toBe(5)
    expect(long.length).toBe(50)
  })
})

describe('getPercentile', () => {
  it('should return 0 for empty array', () => {
    expect(getPercentile([], 50)).toBe(0)
  })

  it('should return the value for single element array', () => {
    expect(getPercentile([5], 50)).toBe(5)
  })

  it('should return minimum for 0th percentile', () => {
    const data = [1, 2, 3, 4, 5]
    expect(getPercentile(data, 0)).toBe(1)
  })

  it('should return maximum for 100th percentile', () => {
    const data = [1, 2, 3, 4, 5]
    expect(getPercentile(data, 100)).toBe(5)
  })

  it('should return median (50th percentile)', () => {
    const data = [1, 2, 3, 4, 5]
    const median = getPercentile(data, 50)
    expect(median).toBe(3)
  })

  it('should interpolate between values', () => {
    const data = [1, 2, 3, 4, 5]
    const p25 = getPercentile(data, 25)

    // 25th percentile should be between 1 and 2
    expect(p25).toBeGreaterThanOrEqual(1)
    expect(p25).toBeLessThanOrEqual(2)
  })

  it('should handle percentiles correctly', () => {
    const data = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]

    expect(getPercentile(data, 0)).toBe(10)
    expect(getPercentile(data, 25)).toBeGreaterThan(25) // 25th percentile is around 32.5
    expect(getPercentile(data, 50)).toBeGreaterThanOrEqual(45) // Median around 50-55
    expect(getPercentile(data, 75)).toBeLessThan(85) // 75th percentile is around 67.5
    expect(getPercentile(data, 100)).toBe(100)
  })

  it('should maintain order for different percentiles', () => {
    const data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

    const p10 = getPercentile(data, 10)
    const p25 = getPercentile(data, 25)
    const p50 = getPercentile(data, 50)
    const p75 = getPercentile(data, 75)
    const p90 = getPercentile(data, 90)

    expect(p10).toBeLessThanOrEqual(p25)
    expect(p25).toBeLessThanOrEqual(p50)
    expect(p50).toBeLessThanOrEqual(p75)
    expect(p75).toBeLessThanOrEqual(p90)
  })

  it('should handle large arrays', () => {
    const data = Array.from({ length: 1000 }, (_, i) => i + 1)

    // For 1000 elements, 50th percentile should be around element 500
    const median = getPercentile(data, 50)
    expect(median).toBeGreaterThan(450)
    expect(median).toBeLessThan(550)
  })

  it('should handle negative values', () => {
    const data = [-100, -50, 0, 50, 100]

    expect(getPercentile(data, 0)).toBe(-100)
    expect(getPercentile(data, 50)).toBe(0)
    expect(getPercentile(data, 100)).toBe(100)
  })
})
