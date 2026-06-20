"use client"

import { Button } from "@/components/ui/button"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult, SimulationResult } from "@/types"
import { Calendar, DollarSign, Gauge, Hourglass, Target, TrendingUp, Wallet } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"
import { DashboardMetricCard } from "./dashboard-metric-card"

interface DashboardMetricsGridProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
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
  isSimulating,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
}: DashboardMetricsGridProps) {
  const { displayMode } = useCalculatorStore()

  const yearsToRetirement = retirementAge - currentAge

  // Always build all 7 metrics. Simulation cards show "--" until results arrive.
  // This keeps the grid structure fixed so Monte Carlo finishing never causes CLS.
  const metrics = useMemo(() => {
    const successRate = simulationResult?.successRate ?? null

    const depletionValue = (() => {
      if (!simulationResult) return isSimulating ? "…" : "--"
      const age = simulationResult.medianDepletionAge
      if (successRate === null) return age ? `Age ${age}` : "Never"
      // Thresholds mirror the Excellent/Good/Fair/At Risk tiers used by the
      // Plan Success Rate card below — a near-coin-flip success rate (e.g. 56%)
      // shouldn't be described as "Likely Never".
      if (successRate >= 90) return "Never"
      if (successRate >= 75) return "Likely Never"
      if (successRate >= 60) return "Uncertain"
      return age ? `Age ${age}` : "Never"
    })()

    const depletionDescription = (() => {
      if (!simulationResult) return isSimulating ? "Simulating…" : "Run simulation"
      const sr = successRate ?? 0
      const failureRate = 100 - sr
      const depletionAge = simulationResult.medianDepletionAge
      if (sr >= 50) {
        return depletionAge && failureRate > 10
          ? `${failureRate.toFixed(0)}% risk (median age ${depletionAge})`
          : "Sustains through life expectancy"
      }
      const yearsUntilDepletion = depletionAge ? depletionAge - currentAge : null
      return depletionAge
        ? `${yearsUntilDepletion} years from now (${failureRate.toFixed(0)}% of scenarios)`
        : "Sustains through life expectancy"
    })()

    return [
      {
        icon: Wallet,
        label: "Total Portfolio",
        value: totalCurrentBalance > 0 ? formatCurrency(totalCurrentBalance) : "--",
        description: "Current balance",
        tooltip: "Your total retirement savings across all accounts (RAs, Pension Funds, TFSAs, etc.). This is your starting point.",
      },
      {
        icon: Target,
        label: "Portfolio at Retirement",
        value: projection
          ? formatCurrency(projection.portfolioAtRetirement, displayMode, yearsToRetirement, inflationRate / 100)
          : "--",
        description: projection
          ? `At age ${retirementAge}${displayMode === "real" ? " (today's value)" : ""}`
          : `Target: age ${retirementAge}`,
        tooltip: "Projected portfolio value when you retire. This is your 'nest egg' - the amount you'll have saved by retirement age.",
      },
      {
        icon: TrendingUp,
        label: "Monthly Contributions",
        value: totalMonthlyContributions > 0 ? formatCurrency(totalMonthlyContributions) : "--",
        description: "Total across all accounts",
        tooltip: "Total monthly contributions across all retirement accounts. Increasing contributions significantly improves outcomes due to compound growth.",
      },
      {
        icon: DollarSign,
        label: "Monthly Income",
        value: projection
          ? formatCurrency(projection.monthlyIncomeAtRetirement, displayMode, yearsToRetirement, inflationRate / 100)
          : "--",
        description: projection
          ? `At retirement${displayMode === "real" ? " (today's value)" : ""}`
          : "Requires projection",
        tooltip: "Monthly income your portfolio can support in retirement based on your withdrawal rate.",
      },
      {
        icon: Calendar,
        label: "Years to Retirement",
        value: yearsToRetirement > 0 ? yearsToRetirement : "--",
        description: `Currently age ${currentAge}`,
      },
      {
        icon: Gauge,
        label: "Plan Success Rate",
        value: successRate !== null ? `${successRate.toFixed(0)}%` : isSimulating ? "…" : "--",
        description: successRate !== null
          ? successRate >= 90 ? "Excellent" : successRate >= 75 ? "Good" : successRate >= 60 ? "Fair" : "At Risk"
          : isSimulating ? "Simulating…" : "Run simulation",
        successRate: successRate ?? undefined,
        tooltip: "Probability of successfully meeting your income goal throughout retirement. Based on 1,000 Monte Carlo simulations.",
      },
      {
        icon: Hourglass,
        label: "Portfolio Depletion",
        value: depletionValue,
        description: depletionDescription,
        tooltip: successRate !== null && successRate >= 60
          ? "Reflects how confidently your plan avoids running out of money: 'Never' at 90%+ success, 'Likely Never' at 75%+, 'Uncertain' below that. The description shows the risk among scenarios that fail."
          : "Below a 60% success rate, this shows the median age at which your portfolio runs out across failing scenarios. Increase contributions or adjust retirement age to improve this.",
      },
    ] as const
  }, [projection, simulationResult, isSimulating, displayMode, yearsToRetirement, retirementAge, inflationRate, totalCurrentBalance, totalMonthlyContributions, currentAge])

  const hasNoAccounts = !projection && totalCurrentBalance === 0 && totalMonthlyContributions === 0

  return (
    <div className="space-y-3">
      {hasNoAccounts && (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/20 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Add accounts to see your projections</p>
            <p className="text-xs text-muted-foreground mt-0.5">Configure your retirement accounts to generate personalised projections</p>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-4 shrink-0">
            <Link href="/calculator/accounts">Add accounts →</Link>
          </Button>
        </div>
      )}
      {/* Fixed 7-column grid — never changes structure, only values update */}
      <div className="dashboard-grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
        {metrics.map((metric) => (
          <DashboardMetricCard
            key={metric.label}
            icon={metric.icon}
            label={metric.label}
            value={metric.value}
            description={metric.description}
            successRate={"successRate" in metric ? metric.successRate : undefined}
            tooltip={"tooltip" in metric ? metric.tooltip : undefined}
          />
        ))}
      </div>
    </div>
  )
}
