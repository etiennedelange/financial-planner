/**
 * Shared chart-tooltip helpers. Both the chart components and the tooltip
 * content component must resolve series labels through the same functions so
 * they cannot drift out of step with each other.
 */
import type { ReactNode } from "react"
import { formatCurrency } from "@/lib/utils/currency"

export interface TooltipConfigEntry {
  label?: ReactNode
  icon?: React.ComponentType
}
export type TooltipConfig = Record<string, TooltipConfigEntry>

export interface TooltipItemLike {
  dataKey?: string | number | ((obj: unknown) => unknown)
  name?: string | number
  payload?: Record<string, unknown> | null
  value?: unknown
  type?: string
}

/**
 * Resolve the value that should be handed to a tooltip's `labelFormatter`.
 *
 * The x-axis value (`label`) is the authoritative header: when it is a number
 * (e.g. an age) it must pass through raw — never the series label. String
 * labels resolve to a config entry's label when one exists, otherwise they
 * pass through unchanged. When no x value is present, fall back to the first
 * series' config label.
 */
export function resolveTooltipLabelValue(
  label: string | number | undefined,
  opts: {
    labelKey?: string
    payload?: TooltipItemLike[]
    config: TooltipConfig
  }
): string | number | null {
  const { labelKey, payload, config } = opts
  if (!payload?.length) {
    return null
  }

  if (typeof label === "number") {
    return label
  }

  const [item] = payload
  const key = `${labelKey || item?.dataKey || item?.name || "value"}`
  const itemConfig = getPayloadConfigFromPayload(config, item, key)

  const value =
    !labelKey && typeof label === "string"
      ? (config[label as string]?.label as string | undefined) || label
      : (itemConfig?.label as string | undefined)

  return value ?? null
}

/**
 * Format a Monte Carlo tooltip row: a named percentile label plus a currency
 * value, so the median and its bands are distinguishable at a glance.
 */
export function formatPercentileTooltip(
  value: unknown,
  item: TooltipItemLike | undefined,
  config: TooltipConfig
): string {
  const key = String(item?.dataKey ?? item?.name ?? "value")
  const label = (config[key]?.label as string | undefined) ?? key
  return `${label}: ${formatCurrency(Number(value) || 0)}`
}

/**
 * Format a scenario-comparison tooltip row. The success series is a
 * probability and must render as a percentage; the nest egg is currency.
 * Keyed off `dataKey`, never the display `name`, so a renamed Bar label
 * cannot silently turn a percentage into a currency amount.
 */
export function formatScenarioTooltip(
  value: unknown,
  item: TooltipItemLike | undefined
): string {
  const dataKey = String(item?.dataKey ?? "")
  if (dataKey === "success") {
    return `${Math.round(Number(value) || 0)}%`
  }
  return formatCurrency(Number(value) || 0)
}

/**
 * Resolve a config entry from a tooltip payload item. Moved out of the
 * chart.tsx component so pure logic can be unit-tested in isolation.
 */
export function getPayloadConfigFromPayload(
  config: TooltipConfig,
  payload: TooltipItemLike | null | undefined,
  key: string
): TooltipConfigEntry | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined
  }

  const payloadPayload =
    "payload" in payload &&
    typeof payload.payload === "object" &&
    payload.payload !== null
      ? payload.payload
      : undefined

  let configLabelKey: string = key

  if (
    key in payload &&
    typeof payload[key as keyof TooltipItemLike] === "string"
  ) {
    configLabelKey = payload[key as keyof TooltipItemLike] as string
  } else if (
    payloadPayload &&
    key in payloadPayload &&
    typeof payloadPayload[key] === "string"
  ) {
    configLabelKey = payloadPayload[key] as string
  }

  return configLabelKey in config
    ? config[configLabelKey]
    : config[key]
}
