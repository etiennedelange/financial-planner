"use client"

import { LucideIcon } from "lucide-react"

interface DashboardMetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  colorIndex: 0 | 1 | 2 | 3 | 4 | 5
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  description,
  colorIndex,
}: DashboardMetricCardProps) {
  const gradientClass = `dashboard-gradient-${colorIndex}`

  return (
    <div className={`dashboard-metric-card ${gradientClass}`}>
      {/* Background blur effect */}
      <div className="absolute inset-0 opacity-10 bg-white" />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header with icon and label */}
        <div className="flex items-start justify-between mb-4">
          <h3 className="dashboard-metric-label">{label}</h3>
          <Icon className="dashboard-metric-icon flex-shrink-0" />
        </div>

        {/* Value */}
        <div className="mb-2">
          <p className="dashboard-metric-value">{value}</p>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs md:text-sm text-white/70 mt-auto">{description}</p>
        )}
      </div>
    </div>
  )
}
