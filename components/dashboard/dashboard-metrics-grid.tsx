"use client"

import { Wallet, Target, TrendingUp, DollarSign, Calendar, Gauge } from "lucide-react"
import { DashboardMetricCard } from "./dashboard-metric-card"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult, SimulationResult } from "@/types"

interface DashboardMetricsGridProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  totalCurrentBalance: number
  totalMonthlyContributions: number
}

export function DashboardMetricsGrid({
  projection,
  simulationResult,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
}: DashboardMetricsGridProps) {
  const { displayMode } = useCalculatorStore()

  if (!projection) {
    return null
  }

  const yearsToRetirement = retirementAge - currentAge
  const yearsToLifeExpectancy = lifeExpectancy - currentAge

  // Determine success rate color index (0-5)
  const successRate = simulationResult?.successRate ?? 0
  let successColorIndex: 0 | 1 | 2 | 3 | 4 | 5 = 2 // Default to green (index 2)
  if (successRate >= 90) {
    successColorIndex = 2 // Green
  } else if (successRate >= 75) {
    successColorIndex = 3 // Cyan
  } else if (successRate >= 60) {
    successColorIndex = 4 // Orange
  } else {
    successColorIndex = 5 // Red
  }

  const metrics: Array<{
    icon: typeof Wallet
    label: string
    value: string | number
    description: string
    colorIndex: 0 | 1 | 2 | 3 | 4 | 5
  }> = [
    {
      icon: Wallet,
      label: "Total Portfolio",
      value: formatCurrency(totalCurrentBalance),
      description: "Current balance",
      colorIndex: 0,
    },
    {
      icon: Target,
      label: "Portfolio at Retirement",
      value: formatCurrency(
        projection.portfolioAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      description: `At age ${retirementAge}${displayMode === "real" ? " (today's value)" : ""}`,
      colorIndex: 1,
    },
    {
      icon: TrendingUp,
      label: "Monthly Contributions",
      value: formatCurrency(totalMonthlyContributions),
      description: "Total across all accounts",
      colorIndex: 2,
    },
    {
      icon: DollarSign,
      label: "Monthly Income",
      value: formatCurrency(
        projection.monthlyIncomeAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      description: `At retirement${displayMode === "real" ? " (today's value)" : ""}`,
      colorIndex: 3,
    },
    {
      icon: Calendar,
      label: "Years to Retirement",
      value: yearsToRetirement,
      description: `Currently age ${currentAge}`,
      colorIndex: 4,
    },
  ]

  // Add success rate metric if simulation available
  if (simulationResult) {
    metrics.push({
      icon: Gauge,
      label: "Plan Success Rate",
      value: `${successRate.toFixed(0)}%`,
      description: successRate >= 90 ? "Excellent" : successRate >= 75 ? "Good" : successRate >= 60 ? "Fair" : "At Risk",
      colorIndex: successColorIndex,
    })
  }

  return (
    <div className="dashboard-grid grid-cols-2 md:grid-cols-3">
      {metrics.map((metric) => (
        <DashboardMetricCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
          description={metric.description}
          colorIndex={metric.colorIndex}
        />
      ))}
    </div>
  )
}
