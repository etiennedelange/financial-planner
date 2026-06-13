"use client"

import { LucideIcon } from "lucide-react"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface DashboardMetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  successRate?: number
  tooltip?: string | React.ReactNode
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  description,
  successRate,
  tooltip,
}: DashboardMetricCardProps) {
  // Determine styling based on success rate
  const getSuccessRateStyles = () => {
    if (successRate !== undefined) {
      if (successRate >= 90) {
        return {
          border: "border-[hsl(var(--chart-2))]",
          text: "text-[hsl(var(--chart-2))]",
          icon: "text-[hsl(var(--chart-2))]",
        }
      } else if (successRate >= 75) {
        return {
          border: "border-[hsl(var(--chart-4))]",
          text: "text-[hsl(var(--chart-4))]",
          icon: "text-[hsl(var(--chart-4))]",
        }
      } else if (successRate >= 60) {
        return {
          border: "border-[hsl(var(--chart-3))]",
          text: "text-[hsl(var(--chart-3))]",
          icon: "text-[hsl(var(--chart-3))]",
        }
      } else {
        return {
          border: "border-destructive",
          text: "text-destructive",
          icon: "text-destructive",
        }
      }
    }
    return {
      border: "border-border",
      text: "",
      icon: "text-muted-foreground",
    }
  }

  const styles = getSuccessRateStyles()

  return (
    <div className={`dashboard-metric-card bg-card text-card-foreground border ${styles.border}`}>
      {/* Content */}
      <div className="flex flex-col h-full">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-medium text-muted-foreground">
              {label}
            </h3>
            {tooltip && (
              <InfoTooltip content={tooltip} side="top" />
            )}
          </div>
          <Icon className={`w-5 h-5 md:w-6 md:h-6 flex-shrink-0 ${styles.icon}`} />
        </div>

        {/* Value */}
        <div className="mb-1">
          <p className={`text-lg md:text-xl font-bold ${styles.text}`}>
            {value}
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
}
