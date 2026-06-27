"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { ProjectionResult, SimulationResult } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { cn } from "@/lib/utils"
import { getSuccessRateStyle } from "@/lib/utils/success-rate"

interface ProjectionSummaryProps {
  projection: ProjectionResult | null
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  simulationResult: SimulationResult | null
  isSimulating?: boolean
}


export function ProjectionSummary({
  projection,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  simulationResult,
  isSimulating = false,
}: ProjectionSummaryProps) {
  const { displayMode } = useCalculatorStore()

  if (!projection) {
    return null
  }

  const successRate = simulationResult?.successRate ?? 0
  const successTier = getSuccessRateStyle(successRate)

  const yearsToRetirement = retirementAge - currentAge
  const yearsToLifeExpectancy = lifeExpectancy - currentAge

  const baseMetrics = [
    {
      label: "Portfolio at Retirement",
      value: formatCurrency(projection.portfolioAtRetirement, displayMode, yearsToRetirement, inflationRate / 100),
      icon: Wallet,
      description: `At age ${retirementAge}${displayMode === "real" ? " (today's value)" : ""}`,
    },
    {
      label: "Monthly Income",
      value: formatCurrency(projection.monthlyIncomeAtRetirement, displayMode, yearsToRetirement, inflationRate / 100),
      icon: TrendingUp,
      description: `Gross withdrawal (before tax)${displayMode === "real" ? " (today's value)" : ""}`,
    },
    {
      label: "Portfolio Depletion",
      value: projection.portfolioDepletionAge ? `Age ${projection.portfolioDepletionAge}` : "Never",
      icon: projection.portfolioDepletionAge ? TrendingDown : TrendingUp,
      description: projection.portfolioDepletionAge ? "Funds run out" : "Funds last lifetime",
      isWarning: !!projection.portfolioDepletionAge,
    },
    {
      label: "Final Balance",
      value: formatCurrency(projection.surplusAmount, displayMode, yearsToLifeExpectancy, inflationRate / 100),
      icon: Calendar,
      description: `At life expectancy${displayMode === "real" ? " (today's value)" : ""}`,
    },
  ]

  return (
    <div className="space-y-3 md:space-y-4">
      {(simulationResult || isSimulating) && (
        <Card>
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-center justify-between gap-4" aria-live="polite">
              {isSimulating ? (
                <>
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded bg-muted animate-pulse" />
                    <div className="h-7 w-16 rounded bg-muted animate-pulse" />
                  </div>
                  <span className="text-xs text-muted-foreground">Recalculating…</span>
                </>
              ) : (
                <>
                  <dl>
                    <dt className="text-sm text-muted-foreground">Plan Success Rate</dt>
                    <dd className="text-2xl font-bold font-mono">{successRate.toFixed(0)}%</dd>
                  </dl>
                  <Badge variant="outline" className={cn("border-current", successTier.text)}>
                    {successTier.label}
                  </Badge>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {baseMetrics.map((metric) => (
          <Card key={metric.label}>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex items-start justify-between">
                <dl>
                  <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                  <dd className={cn("text-2xl font-bold font-mono", metric.isWarning ? "text-warning" : "")}>
                    {metric.value}
                  </dd>
                  <dd className="text-xs text-muted-foreground">{metric.description}</dd>
                </dl>
                <metric.icon
                  className={cn("h-5 w-5 flex-none", metric.isWarning ? "text-warning" : "text-muted-foreground")}
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
