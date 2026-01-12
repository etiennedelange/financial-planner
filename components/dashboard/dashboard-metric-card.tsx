"use client"

import { LucideIcon } from "lucide-react"

interface DashboardMetricCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  description?: string
  colorScheme: "blue" | "purple" | "green" | "cyan" | "orange" | "red"
}

export function DashboardMetricCard({
  icon: Icon,
  label,
  value,
  description,
  colorScheme,
}: DashboardMetricCardProps) {
  const gradientMap: Record<string, string> = {
    blue: "gradient-blue",
    purple: "gradient-purple",
    green: "gradient-green",
    cyan: "gradient-cyan",
    orange: "gradient-orange",
    red: "gradient-red",
  }

  return (
    <div className={`dashboard-metric-card ${gradientMap[colorScheme]}`}>
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
