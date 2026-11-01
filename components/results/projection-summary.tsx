"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectionResult } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { cn } from "@/lib/utils"

interface ProjectionSummaryProps {
  projection: ProjectionResult | null
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
}

export function ProjectionSummary({
  projection,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
}: ProjectionSummaryProps) {
  const { displayMode } = useCalculatorStore()

  if (!projection) {
    return null
  }

  const yearsToRetirement = retirementAge - currentAge
  const yearsToLifeExpectancy = lifeExpectancy - currentAge

  const baseMetrics = [
    {
      label: "Portfolio at Retirement",
      value: formatCurrency(
        projection.portfolioAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100,
      ),
      icon: Wallet,
      description: `At age ${retirementAge}${displayMode === "real" ? " (today's value)" : ""}`,
    },
    {
      label: "Monthly Income",
      value: formatCurrency(
        projection.monthlyIncomeAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100,
      ),
      icon: TrendingUp,
      description: `Gross withdrawal (before tax)${displayMode === "real" ? " (today's value)" : ""}`,
    },
    {
      label: "Portfolio Depletion",
      value: projection.portfolioDepletionAge ? `Age ${projection.portfolioDepletionAge}` : "Never",
      icon: projection.portfolioDepletionAge ? TrendingDown : TrendingUp,
      // A living annuity capped at 17.5% can fail to fund the income without reaching R0
      description: !projection.portfolioDepletionAge
        ? "Funds last lifetime"
        : projection.surplusAmount > 0
          ? "Income falls short (17.5% annuity limit)"
          : "Funds run out",
      isWarning: !!projection.portfolioDepletionAge,
    },
    {
      label: "Final Balance",
      value: formatCurrency(
        projection.surplusAmount,
        displayMode,
        yearsToLifeExpectancy,
        inflationRate / 100,
      ),
      icon: Calendar,
      description: `At life expectancy${displayMode === "real" ? " (today's value)" : ""}`,
    },
  ]

  return (
    <div className="space-y-3 md:space-y-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {baseMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-start justify-between">
                <dl>
                  <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                  <dd
                    className={cn(
                      "text-2xl font-bold font-mono",
                      metric.isWarning ? "text-warning" : "",
                    )}
                  >
                    {metric.value}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{metric.description}</dd>
                </dl>
                <metric.icon
                  className={cn(
                    "h-5 w-5 flex-none",
                    metric.isWarning ? "text-warning" : "text-muted-foreground",
                  )}
                  aria-hidden="true"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
