"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, AlertCircle, Target } from "lucide-react"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult } from "@/types"

interface KeyInsightsSummaryProps {
  projection: ProjectionResult | null
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentMonthlyIncome: number
  desiredMonthlyIncome: number
  inflationRate: number
  monteCarloSuccessRate?: number | null
}

export function KeyInsightsSummary({
  projection,
  currentAge,
  retirementAge,
  lifeExpectancy,
  currentMonthlyIncome,
  desiredMonthlyIncome,
  inflationRate,
  monteCarloSuccessRate,
}: KeyInsightsSummaryProps) {
  if (!projection) {
    return (
      <Card className="dashboard-card">
        <CardHeader>
          <CardTitle className="text-lg">Key Insights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0">
              <div className="h-5 w-5 rounded bg-muted flex-shrink-0 mt-1" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-muted" />
                <div className="h-6 w-20 rounded bg-muted" />
                <div className="h-3 w-36 rounded bg-muted" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const yearsToRetirement = retirementAge - currentAge
  const monthlyIncome = currentMonthlyIncome || 1 // Avoid division by zero
  const annualIncome = monthlyIncome * 12
  const maxRaContribution = Math.min(annualIncome * 0.275, 350000)
  const monthlyRaContribution = maxRaContribution / 12

  // Adjust desired income for inflation to compare in future terms
  const inflationMultiplier = Math.pow(1 + inflationRate / 100, yearsToRetirement)
  const desiredIncomeAtRetirement = desiredMonthlyIncome * inflationMultiplier

  // On Track calculation - primary indicator is Monte Carlo success rate
  // A plan is "on track" if:
  // 1. Monte Carlo success rate >= 70% (funds last until life expectancy in most scenarios), OR
  // 2. If no Monte Carlo data, portfolio doesn't deplete before life expectancy
  const hasSuccessRate = monteCarloSuccessRate !== null && monteCarloSuccessRate !== undefined
  const portfolioLastsUntilLifeExpectancy =
    projection.portfolioDepletionAge === null || projection.portfolioDepletionAge >= lifeExpectancy

  const isOnTrack = hasSuccessRate
    ? monteCarloSuccessRate >= 70
    : portfolioLastsUntilLifeExpectancy

  // Calculate income replacement ratio using inflation-adjusted values
  const incomeReplacementRatio = Math.round(
    (projection.monthlyIncomeAtRetirement / desiredIncomeAtRetirement) * 100
  )

  // Determine On Track description
  const getOnTrackDescription = (): string => {
    if (hasSuccessRate) {
      if (monteCarloSuccessRate >= 70) {
        return `${monteCarloSuccessRate.toFixed(0)}% success rate`
      } else {
        return `Only ${monteCarloSuccessRate.toFixed(0)}% success rate`
      }
    }
    if (portfolioLastsUntilLifeExpectancy) {
      return "Portfolio lasts until life expectancy"
    }
    return `Portfolio depletes at age ${projection.portfolioDepletionAge}`
  }

  const insights = [
    {
      title: "On Track Status",
      value: isOnTrack ? "Yes" : "No",
      icon: Target,
      badge: isOnTrack ? "success" : "warning",
      description: getOnTrackDescription(),
    },
    {
      title: "Contribution Potential",
      value: formatCurrency(monthlyRaContribution),
      icon: TrendingUp,
      badge: "info",
      description: "Max RA contribution per month",
    },
    {
      title: "Income Replacement",
      value: `${incomeReplacementRatio}%`,
      icon: AlertCircle,
      badge: isOnTrack && incomeReplacementRatio >= 100 ? "success" : "warning",
      description: "Inflation-adjusted replacement",
    },
  ]

  return (
    <Card className="dashboard-card">
      <CardHeader>
        <CardTitle className="text-lg">Key Insights</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {insights.map((insight) => {
          const Icon = insight.icon
          return (
            <div key={insight.title} className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0">
              <Icon className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  {insight.badge && (
                    <Badge variant={insight.badge === "success" ? "default" : insight.badge === "warning" ? "secondary" : "outline"}>
                      {insight.badge}
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-bold text-foreground">{insight.value}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
