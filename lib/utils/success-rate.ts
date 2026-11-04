import type { PlanVerdictTone } from "./plan-verdict"

export type SuccessRateStyle = {
  text: string
  bg: string
  border: string
  label: string
}

interface SuccessRateBand extends SuccessRateStyle {
  /** Lowest success rate (%) in the band */
  min: number
  tone: Exclude<PlanVerdictTone, "neutral">
  /** The Risk page verdict for this band; worded to agree with `label` */
  headline: string
}

/**
 * The one table of success-rate bands. The metric label ("Fair") and the page verdict
 * ("Your plan may fall short") come from the same row, so they cannot disagree. Until
 * 2026-11-04 they lived in two files and did: 60–75% was "Fair" next to "Your plan is at
 * risk", and 40–60% was "At Risk" next to "Your plan is under pressure".
 */
export const SUCCESS_RATE_BANDS: readonly SuccessRateBand[] = [
  {
    min: 90,
    label: "Excellent",
    tone: "success",
    headline: "Your plan holds",
    text: "text-chart-2",
    bg: "bg-[hsl(var(--chart-2))]",
    border: "border-[hsl(var(--chart-2))]",
  },
  {
    min: 75,
    label: "Good",
    tone: "good",
    headline: "Your plan is likely to hold",
    text: "text-chart-4",
    bg: "bg-[hsl(var(--chart-4))]",
    border: "border-[hsl(var(--chart-4))]",
  },
  {
    min: 60,
    label: "Fair",
    tone: "warning",
    headline: "Your plan may fall short",
    text: "text-warning",
    bg: "bg-[hsl(var(--warning))]",
    border: "border-[hsl(var(--warning))]",
  },
  {
    min: 40,
    label: "At Risk",
    tone: "warning",
    headline: "Your plan is at risk",
    text: "text-warning",
    bg: "bg-[hsl(var(--warning))]",
    border: "border-[hsl(var(--warning))]",
  },
  {
    min: -Infinity,
    label: "Critical",
    tone: "danger",
    headline: "Your plan is unlikely to hold",
    text: "text-destructive",
    bg: "bg-destructive",
    border: "border-destructive",
  },
]

export function getSuccessRateBand(rate: number): SuccessRateBand {
  // A NaN rate fails every `>=` and lands in the last (Critical) band
  return SUCCESS_RATE_BANDS.find((band) => rate >= band.min) ?? SUCCESS_RATE_BANDS.at(-1)!
}

export function getSuccessRateStyle(rate: number): SuccessRateStyle {
  const { text, bg, border, label } = getSuccessRateBand(rate)
  return { text, bg, border, label }
}

/** Success at cautious and central volatility, ordered low to high */
export interface SuccessRange {
  low: number
  high: number
}

/**
 * Order the two results of the success range. Higher volatility normally lowers success,
 * so `low` is usually the cautious figure, but sampling or a withdrawal strategy that
 * adapts to markets can invert a close pair; the range is presented low-to-high either way.
 * With no cautious result yet, the range collapses to the central figure.
 */
export function successRange(central: number, cautious: number | null): SuccessRange {
  if (cautious === null || !Number.isFinite(cautious)) return { low: central, high: central }
  return { low: Math.min(central, cautious), high: Math.max(central, cautious) }
}

/** "70–82%", or "82%" when both ends round to the same whole percent */
export function formatSuccessRange({ low, high }: SuccessRange): string {
  const lo = Math.round(low)
  const hi = Math.round(high)
  return lo === hi ? `${hi}%` : `${lo}–${hi}%`
}
