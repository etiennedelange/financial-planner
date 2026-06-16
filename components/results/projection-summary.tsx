"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectionResult, SimulationResult } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { cn } from "@/lib/utils"

interface ProjectionSummaryProps {
  projection: ProjectionResult | null
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  simulationResult: SimulationResult | null
}

export function ProjectionSummary({
  projection,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  simulationResult,
}: ProjectionSummaryProps) {
  const { displayMode } = useCalculatorStore()

  if (!projection) {
    return null
  }

  const successRate = simulationResult?.successRate ?? 0
  const getSuccessConfig = (rate: number) => {
    if (rate >= 90) return { label: "Excellent", border: "border-chart-2", text: "text-chart-2", bg: "bg-chart-2/5" }
    if (rate >= 75) return { label: "Good", border: "border-primary", text: "text-primary", bg: "bg-primary/5" }
    if (rate >= 60) return { label: "Fair", border: "border-warning", text: "text-warning", bg: "bg-warning/5" }
    if (rate >= 40) return { label: "Risky", border: "border-warning/60", text: "text-warning", bg: "bg-warning/5" }
    return { label: "Critical", border: "border-destructive", text: "text-destructive", bg: "bg-destructive/5" }
  }

  const successConfig = getSuccessConfig(successRate)

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

  const metrics: Array<{
    label: string
    value: string
    icon: typeof TrendingUp
    description: string
    isWarning?: boolean
    isSuccess?: boolean
    isHero?: boolean
    successBorder?: string
    successText?: string
    successBg?: string
  }> = [
    ...(simulationResult
      ? [
          {
            label: "Plan Success Rate",
            value: `${successRate.toFixed(0)}%`,
            icon: TrendingUp,
            description: successConfig.label,
            isSuccess: true,
            isHero: true,
            successBorder: successConfig.border,
            successText: successConfig.text,
            successBg: successConfig.bg,
          },
        ]
      : []),
    ...baseMetrics,
  ]

  return (
    <div
      className={cn(
        "grid gap-3 md:gap-4",
        simulationResult ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 lg:grid-cols-4"
      )}
    >
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className={cn(
            metric.isWarning ? "border-warning" : "",
            metric.isSuccess ? `${metric.successBorder} ${metric.successBg}` : ""
          )}
        >
          <CardContent className="pt-4 md:pt-6">
            <div className="flex items-start justify-between">
              <dl>
                <dt className="text-sm text-muted-foreground">{metric.label}</dt>
                <dd
                  className={cn(
                    metric.isHero ? "text-3xl" : "text-2xl",
                    "font-bold font-mono",
                    metric.isWarning ? "text-warning" : "",
                    metric.isSuccess ? metric.successText : ""
                  )}
                >
                  {metric.value}
                </dd>
                <dd className="text-xs text-muted-foreground">{metric.description}</dd>
              </dl>
              <metric.icon
                className={cn(
                  "h-5 w-5 flex-none",
                  metric.isWarning ? "text-warning" : "",
                  metric.isSuccess ? metric.successText : "text-muted-foreground"
                )}
                aria-hidden="true"
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
