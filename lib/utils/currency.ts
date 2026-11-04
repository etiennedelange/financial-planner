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
  inflationRate: number,
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
  displayMode?: "nominal" | "real"
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
  displayMode: "nominal" | "real",
  yearsFromNow?: number,
  inflationRate?: number,
): string
export function formatCurrency(
  value: number,
  displayModeOrOptions: "nominal" | "real" | FormatCurrencyOptions = "nominal",
  yearsFromNow: number = 0,
  inflationRate: number = 0.055,
): string {
  const options: FormatCurrencyOptions =
    typeof displayModeOrOptions === "string"
      ? { displayMode: displayModeOrOptions, yearsFromNow, inflationRate }
      : (displayModeOrOptions ?? {})

  const {
    compact = false,
    decimals = 0,
    displayMode = "nominal",
    yearsFromNow: fromNow = 0,
    inflationRate: infl = 0.055,
  } = options

  const rawValue = displayMode === "real" ? toRealValue(value, fromNow, infl) : value
  // An invalid number is a defect upstream, not an amount: show "—", never "RNaN" or "R∞"
  if (!Number.isFinite(rawValue)) return NO_VALUE
  // −0.4 rounds to zero at 0 decimals; without this Intl renders "-R 0"
  const displayValue = roundsToZero(rawValue, decimals) ? 0 : rawValue

  if (compact) {
    // Sign first, like the full format ("-R 1 250 000"), so the two read alike
    const sign = displayValue < 0 ? "-" : ""
    const abs = Math.abs(displayValue)
    // Each threshold sits where the smaller unit would round up to 1,000 ("R1000.0M",
    // "R1000K"), so the next unit takes over at that point
    if (abs >= 999_950_000) return `${sign}R${(abs / 1_000_000_000).toFixed(1)}B`
    if (abs >= 999_500) return `${sign}R${(abs / 1_000_000).toFixed(1)}M`
    if (abs >= 999.5) return `${sign}R${(abs / 1_000).toFixed(0)}K`
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(displayValue)
}

/** Shown in place of an amount that is not a finite number */
export const NO_VALUE = "—"

function roundsToZero(value: number, decimals: number): boolean {
  const scale = Math.pow(10, decimals)
  return Math.round(Math.abs(value) * scale) === 0
}

/**
 * Format currency with compact notation (e.g., R1.2M)
 */
export function formatCurrencyCompact(
  value: number,
  displayMode: "nominal" | "real" = "nominal",
  yearsFromNow: number = 0,
  inflationRate: number = 0.055,
): string {
  const displayValue =
    displayMode === "real" ? toRealValue(value, yearsFromNow, inflationRate) : value
  if (!Number.isFinite(displayValue)) return NO_VALUE

  // Thresholds on the magnitude, so negatives compact too ("-R2.5M", not "R-2500000"), and
  // on the ROUNDED value, so R999.60 reads "R1k" rather than "R1000"
  const sign = Math.round(displayValue) < 0 ? "-" : ""
  const abs = Math.abs(displayValue)
  if (abs >= 999_500) return `${sign}R${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 999.5) return `${sign}R${(abs / 1_000).toFixed(0)}k`
  return `${sign}R${abs.toFixed(0)}`
}
