"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { formatCurrency } from "@/lib/utils/currency"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { escalate, percentToRate } from "@/lib/calculations/utils/money-time"
import type { ProjectionResult } from "@/types"
import { AlertCircle, Target, TrendingUp } from "lucide-react"
import Link from "next/link"
import { useMemo } from "react"

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
  const derived = useMemo(() => {
    if (!projection) return null

    const yearsToRetirement = retirementAge - currentAge
    const monthlyIncome = currentMonthlyIncome || 1
    const annualIncome = monthlyIncome * 12
    const maxRaContribution = Math.min(annualIncome * SA_TAX_LIMITS.pensionRaDeductionRate, SA_TAX_LIMITS.pensionRaMaxDeduction)
    const monthlyRaContribution = maxRaContribution / 12

    const desiredIncomeAtRetirement = escalate(
      desiredMonthlyIncome,
      yearsToRetirement,
      percentToRate(inflationRate)
    )

    const hasSuccessRate = monteCarloSuccessRate !== null && monteCarloSuccessRate !== undefined
    const portfolioLastsUntilLifeExpectancy =
      projection.portfolioDepletionAge === null || projection.portfolioDepletionAge >= lifeExpectancy

    const isOnTrack = hasSuccessRate
      ? monteCarloSuccessRate >= 70
      : portfolioLastsUntilLifeExpectancy

    const incomeReplacementRatio = Math.round(
      (projection.monthlyIncomeAtRetirement / desiredIncomeAtRetirement) * 100
    )

    let onTrackDescription: string
    if (hasSuccessRate) {
      onTrackDescription = monteCarloSuccessRate >= 70
        ? `${monteCarloSuccessRate.toFixed(0)}% success rate`
        : `Only ${monteCarloSuccessRate.toFixed(0)}% success rate`
    } else if (portfolioLastsUntilLifeExpectancy) {
      onTrackDescription = "Portfolio lasts until life expectancy"
    } else {
      onTrackDescription = `Portfolio depletes at age ${projection.portfolioDepletionAge}`
    }

    return { monthlyRaContribution, isOnTrack, incomeReplacementRatio, onTrackDescription }
  }, [projection, retirementAge, currentAge, currentMonthlyIncome, inflationRate, desiredMonthlyIncome, monteCarloSuccessRate, lifeExpectancy])

  if (!projection || !derived) {
    return (
      <PageCard label="Key Insights" className="dashboard-card">
        <div className="flex min-h-[168px] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">Configure your accounts and plan to see personalised insights here.</p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calculator/accounts">Add accounts →</Link>
          </Button>
        </div>
      </PageCard>
    )
  }

  const { monthlyRaContribution, isOnTrack, incomeReplacementRatio, onTrackDescription } = derived

  const insights = [
    {
      title: "On Track Status",
      value: isOnTrack ? "Yes" : "No",
      icon: Target,
      badgeVariant: isOnTrack ? "success" : "warning",
      badgeLabel: isOnTrack ? "On Track" : "At Risk",
      description: onTrackDescription,
    },
    {
      title: "Contribution Potential",
      value: formatCurrency(monthlyRaContribution),
      icon: TrendingUp,
      badgeVariant: "info",
      badgeLabel: "Tip",
      description: "Max RA contribution per month",
    },
    {
      title: "Income Replacement",
      value: `${incomeReplacementRatio}%`,
      icon: AlertCircle,
      badgeVariant: isOnTrack && incomeReplacementRatio >= 100 ? "success" : "warning",
      badgeLabel: isOnTrack && incomeReplacementRatio >= 100 ? "On Track" : "Below Target",
      description: "Inflation-adjusted replacement",
    },
  ]

  return (
    <PageCard label="Key Insights" className="dashboard-card" contentClassName="space-y-4">
        {insights.map((insight) => {
          const Icon = insight.icon
          return (
            <div key={insight.title} className="flex items-start gap-3 pb-3 border-b border-border last:pb-0 last:border-0">
              <Icon aria-hidden="true" className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  {insight.badgeLabel && (
                    <Badge variant={insight.badgeVariant === "success" ? "default" : insight.badgeVariant === "warning" ? "destructive" : "outline"}>
                      {insight.badgeLabel}
                    </Badge>
                  )}
                </div>
                <p className="text-lg font-bold font-mono text-foreground">{insight.value}</p>
                <p className="text-xs text-muted-foreground">{insight.description}</p>
              </div>
            </div>
          )
        })}
    </PageCard>
  )
}
