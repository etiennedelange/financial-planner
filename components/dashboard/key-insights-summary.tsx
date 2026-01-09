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
  currentMonthlyIncome: number
  desiredMonthlyIncome: number
  inflationRate: number
}

export function KeyInsightsSummary({
  projection,
  currentAge,
  retirementAge,
  currentMonthlyIncome,
  desiredMonthlyIncome,
  inflationRate,
}: KeyInsightsSummaryProps) {
  if (!projection) {
    return null
  }

  const yearsToRetirement = retirementAge - currentAge
  const monthlyIncome = currentMonthlyIncome || 1 // Avoid division by zero
  const annualIncome = monthlyIncome * 12
  const maxRaContribution = Math.min(annualIncome * 0.275, 350000)
  const monthlyRaContribution = maxRaContribution / 12

  // Calculation for optimal contribution (simplified)
  const gap = desiredMonthlyIncome - projection.monthlyIncomeAtRetirement
  const isOnTrack = gap <= 0

  const insights = [
    {
      title: "On Track Status",
      value: isOnTrack ? "Yes" : "No",
      icon: Target,
      badge: isOnTrack ? "success" : "warning",
      description: isOnTrack
        ? "Your plan meets your income goal"
        : `Gap: ${formatCurrency(Math.abs(gap))}/month`,
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
      value: `${Math.round((projection.monthlyIncomeAtRetirement / desiredMonthlyIncome) * 100)}%`,
      icon: AlertCircle,
      badge: Math.round((projection.monthlyIncomeAtRetirement / desiredMonthlyIncome) * 100) >= 100 ? "success" : "warning",
      description: "Of desired retirement income",
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
