/**
 * Format a number as South African Rand currency
 */
export function formatCurrency(
  value: number,
  options?: { compact?: boolean; decimals?: number }
): string {
  const { compact = false, decimals = 0 } = options || {}

  if (compact) {
    if (Math.abs(value) >= 1000000000) {
      return `R${(value / 1000000000).toFixed(1)}B`
    }
    if (Math.abs(value) >= 1000000) {
      return `R${(value / 1000000).toFixed(1)}M`
    }
    if (Math.abs(value) >= 1000) {
      return `R${(value / 1000).toFixed(0)}K`
    }
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Format a number as a percentage
 */
export function formatPercentage(
  value: number,
  options?: { decimals?: number }
): string {
  const { decimals = 1 } = options || {}
  return `${value.toFixed(decimals)}%`
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(
  value: number,
  options?: { decimals?: number }
): string {
  const { decimals = 0 } = options || {}
  return new Intl.NumberFormat("en-ZA", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/**
 * Parse a currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove currency symbol, spaces, and thousand separators
  const cleaned = value.replace(/[R\s,]/g, "")
  const parsed = parseFloat(cleaned)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format age in years
 */
export function formatAge(age: number): string {
  return `${age} years`
}
