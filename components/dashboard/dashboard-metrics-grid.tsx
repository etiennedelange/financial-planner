"use client"

import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult } from "@/types"
import { Calendar, DollarSign, Hourglass, Target, TrendingUp, Wallet } from "lucide-react"
import { useMemo } from "react"
import { DashboardMetricCard } from "./dashboard-metric-card"

interface DashboardMetricsGridProps {
  projection: ProjectionResult | null
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  totalCurrentBalance: number
  totalMonthlyContributions: number
}

export function DashboardMetricsGrid({
  projection,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
}: DashboardMetricsGridProps) {
  const { displayMode } = useCalculatorStore()

  const yearsToRetirement = retirementAge - currentAge

  // Deterministic metrics only. Monte Carlo results live on the Risk page.
  const metrics = useMemo(() => {
    // The first age the projection cannot pay the full income (null = never)
    // The first age the projection pays less than the income goal (null = never)
    const shortfallAge = projection?.incomeGoalShortfallAge ?? null

    return [
      {
        icon: Wallet,
        label: "Total Portfolio",
        value: totalCurrentBalance > 0 ? formatCurrency(totalCurrentBalance) : "--",
        description: "Current balance",
        tooltip:
          "Your total retirement savings across all accounts (RAs, Pension Funds, TFSAs, etc.). This is your starting point.",
      },
      {
        icon: Target,
        label: "Portfolio at Retirement",
        value: projection
          ? formatCurrency(
              projection.portfolioAtRetirement,
              displayMode,
              yearsToRetirement,
              inflationRate / 100,
            )
          : "--",
        description: projection
          ? `At age ${retirementAge}${displayMode === "real" ? " (today's value)" : ""}`
          : `Target: age ${retirementAge}`,
        tooltip:
          "Projected portfolio value when you retire. This is your 'nest egg' - the amount you'll have saved by retirement age.",
      },
      {
        icon: TrendingUp,
        label: "Monthly Contributions",
        value: totalMonthlyContributions > 0 ? formatCurrency(totalMonthlyContributions) : "--",
        description: "Total across all accounts",
        tooltip:
          "Total monthly contributions across all retirement accounts. Increasing contributions significantly improves outcomes due to compound growth.",
      },
      {
        icon: DollarSign,
        label: "Monthly Income",
        value: projection
          ? formatCurrency(
              projection.monthlyIncomeAtRetirement,
              displayMode,
              yearsToRetirement,
              inflationRate / 100,
            )
          : "--",
        description: projection
          ? `At retirement${displayMode === "real" ? " (today's value)" : ""}`
          : "Requires projection",
        tooltip:
          "Monthly income your portfolio can support in retirement based on your withdrawal rate.",
      },
      {
        icon: Calendar,
        label: "Years to Retirement",
        value: yearsToRetirement > 0 ? yearsToRetirement : "--",
        description: `Currently age ${currentAge}`,
      },
      {
        icon: Hourglass,
        label: "Goal Income Until",
        value: projection ? `Age ${shortfallAge ?? lifeExpectancy}` : "--",
        description: projection
          ? shortfallAge
            ? `Falls below your goal ${lifeExpectancy - shortfallAge} years before age ${lifeExpectancy}`
            : "Steady returns only · market ups and downs can bring this forward (see Risk)"
          : "Requires projection",
        tooltip:
          "With steady returns every year. For how market ups and downs could change this, see the Risk page.",
      },
    ] as const
  }, [
    projection,
    displayMode,
    yearsToRetirement,
    retirementAge,
    inflationRate,
    totalCurrentBalance,
    totalMonthlyContributions,
    currentAge,
    lifeExpectancy,
  ])

  return (
    <div className="space-y-3">
      {/* Fixed grid — never changes structure, only values update */}
      <div className="dashboard-grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            tooltip={"tooltip" in metric ? metric.tooltip : undefined}
          />
        ))}
      </div>
    </div>
  )
}
