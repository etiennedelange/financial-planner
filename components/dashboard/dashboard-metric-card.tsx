"use client"

import { LucideIcon } from "lucide-react"
import { memo } from "react"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { RollingValue } from "@/components/ui/rolling-value"
import { getSuccessRateStyle } from "@/lib/utils/success-rate"

interface DashboardMetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  successRate?: number
  tooltip?: string | React.ReactNode
  /** Numeric value that rolls between changes instead of snapping. */
  numericValue?: number
  /** Format function for `numericValue`. Required when `numericValue` is set. */
  format?: (value: number) => string
  /** Start value for the first appearance; `0` counts up, default fades in settled. */
  initial?: number
}

export const DashboardMetricCard = memo(function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  description,
  successRate,
  tooltip,
  numericValue,
  format,
  initial,
}: DashboardMetricCardProps) {
  const styles = successRate !== undefined
    ? getSuccessRateStyle(successRate)
    : { border: "border-border", text: "", bg: "", label: "" }
  const iconClass = successRate !== undefined ? styles.text : "text-muted-foreground"

  return (
    <div className={`dashboard-metric-card bg-card text-card-foreground border ${styles.border}`}>
      <div className="flex flex-col h-full">
        {/* Label row: icon + label + tooltip all inline */}
        <div className="flex items-center gap-1 mb-2">
          <Icon aria-hidden="true" className={`w-3.5 h-3.5 shrink-0 ${iconClass}`} />
          <h3 className="text-xs font-medium text-muted-foreground truncate">
            {label}
          </h3>
          {tooltip && (
            <InfoTooltip content={tooltip} side="top" />
          )}
        </div>

        {/* Value */}
        <div className="mb-1">
          <p className={`text-base font-bold font-mono ${styles.text}`}>
            {numericValue !== undefined && format ? (
              <RollingValue value={numericValue} format={format} initial={initial} />
            ) : (
              value
            )}
          </p>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs mt-auto text-muted-foreground">
            {description}
          </p>
        )}
      </div>
    </div>
  )
})
