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
    tooltip?: string | React.ReactNode
  }> = [
    {
      icon: Wallet,
      label: "Total Portfolio",
      value: formatCurrency(totalCurrentBalance),
      description: "Current balance",
      tooltip: "Your total retirement savings across all accounts (RAs, Pension Funds, TFSAs, etc.). This is your starting point.",
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
      tooltip: "Projected portfolio value when you retire. This is your 'nest egg' - the amount you'll have saved by retirement age. This projection assumes returns match expectations and you maintain your contribution schedule.",
    },
    {
      icon: TrendingUp,
      label: "Monthly Contributions",
      value: formatCurrency(totalMonthlyContributions),
      description: "Total across all accounts",
      tooltip: "Total monthly contributions across all retirement accounts. Increasing contributions (or adding escalation) significantly improves your retirement outcomes due to compound growth.",
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
      tooltip: "Monthly income your portfolio can support in retirement based on your withdrawal rate. Compare this to your desired monthly income goal to see if you're on track.",
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
      tooltip: "Probability of successfully meeting your income goal throughout retirement. Based on 1,000 Monte Carlo simulations with random market returns. Higher success rates mean your plan is more resilient to market volatility and poor return sequences.",
    })

    // Add portfolio depletion metric
    // Only show depletion age as primary metric when majority of runs fail
    // When most runs succeed, "Never" is more accurate for expected outcome
    const depletionAge = simulationResult.medianDepletionAge
    const failureRate = 100 - successRate

    let depletionValue: string
    let depletionDescription: string

    if (successRate >= 50) {
      // Majority succeed - show "Never" as the expected outcome
      depletionValue = "Never"
      if (depletionAge && failureRate > 10) {
        // But mention the risk if failure rate is notable
        depletionDescription = `${failureRate.toFixed(0)}% risk of depletion (median age ${depletionAge})`
      } else {
        depletionDescription = "Portfolio sustains through life expectancy"
      }
    } else {
      // Majority fail - show depletion age as primary
      depletionValue = depletionAge ? `Age ${depletionAge}` : "Never"
      const yearsUntilDepletion = depletionAge ? depletionAge - currentAge : null
      depletionDescription = depletionAge
        ? `${yearsUntilDepletion} years from now (${failureRate.toFixed(0)}% of scenarios)`
        : "Portfolio sustains through life expectancy"
    }

    metrics.push({
      icon: Hourglass,
      label: "Portfolio Depletion",
      value: depletionValue,
      description: depletionDescription,
      tooltip: successRate >= 50
        ? "When the majority of simulations succeed, 'Never' represents the expected outcome. The description shows the risk percentage and median depletion age among scenarios that fail."
        : "When the majority of simulations fail, this shows the median age at which your portfolio runs out across failing scenarios. Increase contributions, reduce withdrawal rate, or adjust retirement age to improve this.",
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
          tooltip={metric.tooltip}
        />
      ))}
    </div>
  )
}
