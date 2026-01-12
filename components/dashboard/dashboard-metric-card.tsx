"use client"

import { LucideIcon } from "lucide-react"

interface DashboardMetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  successRate?: number
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  description,
  successRate,
}: DashboardMetricCardProps) {
  // Determine styling based on success rate
  const getSuccessRateStyles = () => {
    if (successRate !== undefined) {
      // Success rate card - colored based on value
      if (successRate >= 90) {
        return {
          border: "border-green-500",
          text: "text-green-600 dark:text-green-500",
          icon: "text-green-600 dark:text-green-500"
        }
      } else if (successRate >= 75) {
        return {
          border: "border-cyan-500",
          text: "text-cyan-600 dark:text-cyan-500",
          icon: "text-cyan-600 dark:text-cyan-500"
        }
      } else if (successRate >= 60) {
        return {
          border: "border-orange-500",
          text: "text-orange-600 dark:text-orange-500",
          icon: "text-orange-600 dark:text-orange-500"
        }
      } else {
        return {
          border: "border-red-500",
          text: "text-red-600 dark:text-red-500",
          icon: "text-red-600 dark:text-red-500"
        }
      }
    }
    // Default card - simple grey border
    return {
      border: "border-border",
      text: "",
      icon: "text-muted-foreground"
    }
  }

  const styles = getSuccessRateStyles()

  return (
    <div className={`dashboard-metric-card bg-card text-card-foreground border ${styles.border}`}>
      {/* Content */}
      <div className="flex flex-col h-full">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xs font-medium text-muted-foreground">
            {label}
          </h3>
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
