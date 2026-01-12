"use client"

import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult, SimulationResult } from "@/types"
import { Calendar, DollarSign, Gauge, Hourglass, Target, TrendingUp, Wallet } from "lucide-react"
import { DashboardMetricCard } from "./dashboard-metric-card"

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

  const successRate = simulationResult?.successRate ?? 0

  const metrics: Array<{
    icon: typeof Wallet
    label: string
    value: string | number
    description: string
    successRate?: number
  }> = [
    {
      icon: Wallet,
      label: "Total Portfolio",
      value: formatCurrency(totalCurrentBalance),
      description: "Current balance",
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
    },
    {
      icon: TrendingUp,
      label: "Monthly Contributions",
      value: formatCurrency(totalMonthlyContributions),
      description: "Total across all accounts",
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
    },
    {
      icon: Calendar,
      label: "Years to Retirement",
      value: yearsToRetirement,
      description: `Currently age ${currentAge}`,
    },
  ]

  // Add success rate metric if simulation available
  if (simulationResult) {
    metrics.push({
      icon: Gauge,
      label: "Plan Success Rate",
      value: `${successRate.toFixed(0)}%`,
      description: successRate >= 90 ? "Excellent" : successRate >= 75 ? "Good" : successRate >= 60 ? "Fair" : "At Risk",
      successRate: successRate,
    })

    // Add portfolio depletion metric
    const depletionAge = simulationResult.medianDepletionAge
    const depletionValue = depletionAge ? `Age ${depletionAge}` : "Never"
    const yearsUntilDepletion = depletionAge ? depletionAge - currentAge : null
    const depletionDescription = depletionAge
      ? `${yearsUntilDepletion} years from now`
      : "Portfolio sustains through life expectancy"

    metrics.push({
      icon: Hourglass,
      label: "Portfolio Depletion",
      value: depletionValue,
      description: depletionDescription,
    })
  }

  return (
    <div className="dashboard-grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6">
      {metrics.map((metric) => (
        <DashboardMetricCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={metric.value}
          description={metric.description}
          successRate={metric.successRate}
        />
      ))}
    </div>
  )
}
