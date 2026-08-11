import { deflate } from "@/lib/calculations/utils/money-time"

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
  return deflate(nominalValue, yearsFromNow, inflationRate)
}

/**
 * Formatting options for {@link formatCurrency}.
 */
export interface FormatCurrencyOptions {
  /** Compact notation (R1.2M / R350K / R1.5B) — used for chart axis ticks. */
  compact?: boolean
  /** Fraction digits for the full (non-compact) path. Default 0. */
  decimals?: number
  /** Display basis; 'real' deflates the value to today's Rands. Default 'nominal'. */
  displayMode?: 'nominal' | 'real'
  /** Years from now, used only when displayMode is 'real'. */
  yearsFromNow?: number
  /** Annual inflation rate (as decimal), used only when displayMode is 'real'. */
  inflationRate?: number
}

/**
 * The single source of truth for currency formatting.
 *
 * Two call shapes are supported so the historical positional API and the
 * options-object API both resolve here:
 *
 *   formatCurrency(value)                          → "R1 250 000"
 *   formatCurrency(value, 'real', 5, 0.055)        → deflated to today's Rands
 *   formatCurrency(value, { compact: true })       → "R1.3M"
 *   formatCurrency(value, { decimals: 2 })         → "R1 250 000.00"
 *
 * @param value - The monetary value to format
 */
export function formatCurrency(value: number, options?: FormatCurrencyOptions): string
export function formatCurrency(
  value: number,
  displayMode: 'nominal' | 'real',
  yearsFromNow?: number,
  inflationRate?: number
): string
export function formatCurrency(
  value: number,
  displayModeOrOptions: 'nominal' | 'real' | FormatCurrencyOptions = 'nominal',
  yearsFromNow: number = 0,
  inflationRate: number = 0.055
): string {
  const options: FormatCurrencyOptions =
    typeof displayModeOrOptions === 'string'
      ? { displayMode: displayModeOrOptions, yearsFromNow, inflationRate }
      : (displayModeOrOptions ?? {})

  const {
    compact = false,
    decimals = 0,
    displayMode = 'nominal',
    yearsFromNow: fromNow = 0,
    inflationRate: infl = 0.055,
  } = options

  const displayValue =
    displayMode === 'real' ? toRealValue(value, fromNow, infl) : value

  if (compact) {
    if (Math.abs(displayValue) >= 1_000_000_000) {
      return `R${(displayValue / 1_000_000_000).toFixed(1)}B`
    }
    if (Math.abs(displayValue) >= 1_000_000) {
      return `R${(displayValue / 1_000_000).toFixed(1)}M`
    }
    if (Math.abs(displayValue) >= 1_000) {
      return `R${(displayValue / 1_000).toFixed(0)}K`
    }
  }

  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
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
