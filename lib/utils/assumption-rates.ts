/**
 * Accepted ranges (in %) for the Market Assumptions rates. Single source of truth for the
 * form's validation schema and the persisted-state migration, so the two cannot drift.
 */
export const ASSUMPTION_RATE_BOUNDS = {
  equityReturn: { min: 0, max: 30 },
  bondReturn: { min: 0, max: 20 },
  cashReturn: { min: 0, max: 15 },
  inflationRate: { min: 0, max: 20 },
} as const

export type AssumptionRateField = keyof typeof ASSUMPTION_RATE_BOUNDS

/**
 * A persisted assumption rate, or `fallback` when it is unusable.
 *
 * Before the form validated its input (issue #34), a cleared field stored NaN, which JSON
 * persists as `null`, and any typed value (e.g. 150000% equity) was stored as-is. Such a
 * value is replaced by the default, not clamped: a cleared field has no meaningful nearest
 * value, and pinning 150000% to 30% would silently keep an extreme assumption.
 */
export function sanitizeAssumptionRate(
  value: unknown,
  field: AssumptionRateField,
  fallback: number,
): number {
  const { min, max } = ASSUMPTION_RATE_BOUNDS[field]
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  if (value < min || value > max) return fallback
  return value
}
