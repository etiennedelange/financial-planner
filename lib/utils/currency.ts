/**
 * Convert nominal (future) value to real (today's) value
 * @param nominalValue - Value in future Rands
 * @param yearsFromNow - Number of years in the future
 * @param inflationRate - Annual inflation rate (as decimal, e.g., 0.055 for 5.5%)
 * @returns Value in today's Rands
 */
export function toRealValue(
  nominalValue: number,
  yearsFromNow: number,
  inflationRate: number
): number {
  if (yearsFromNow === 0) return nominalValue
  return nominalValue / Math.pow(1 + inflationRate, yearsFromNow)
}

/**
 * Format currency value based on display mode
 * @param value - The monetary value to format
 * @param displayMode - Whether to show as 'nominal' or 'real'
 * @param yearsFromNow - Number of years in the future (for real value calculation)
 * @param inflationRate - Annual inflation rate (as decimal)
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number,
  displayMode: 'nominal' | 'real' = 'nominal',
  yearsFromNow: number = 0,
  inflationRate: number = 0.055
): string {
  const displayValue =
    displayMode === 'real' ? toRealValue(value, yearsFromNow, inflationRate) : value

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(displayValue)
}

/**
 * Format currency with compact notation (e.g., R1.2M)
 */
export function formatCurrencyCompact(
  value: number,
  displayMode: 'nominal' | 'real' = 'nominal',
  yearsFromNow: number = 0,
  inflationRate: number = 0.055
): string {
  const displayValue =
    displayMode === 'real' ? toRealValue(value, yearsFromNow, inflationRate) : value

  if (displayValue >= 1_000_000) {
    return `R${(displayValue / 1_000_000).toFixed(1)}M`
  } else if (displayValue >= 1_000) {
    return `R${(displayValue / 1_000).toFixed(0)}k`
  } else {
    return `R${displayValue.toFixed(0)}`
  }
}
