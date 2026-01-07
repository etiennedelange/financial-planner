"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectionResult, SimulationResult } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"

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

  // Calculate success rate config
  const successRate = simulationResult?.successRate ?? 0
  const getSuccessConfig = (rate: number) => {
    if (rate >= 90) return {
      label: "Excellent",
      border: "border-green-500",
      text: "text-green-600 dark:text-green-400"
    }
    if (rate >= 75) return {
      label: "Good",
      border: "border-emerald-500",
      text: "text-emerald-600 dark:text-emerald-400"
    }
    if (rate >= 60) return {
      label: "Fair",
      border: "border-yellow-500",
      text: "text-yellow-600 dark:text-yellow-400"
    }
    if (rate >= 40) return {
      label: "Risky",
      border: "border-orange-500",
      text: "text-orange-600 dark:text-orange-400"
    }
    return {
      label: "Critical",
      border: "border-red-500",
      text: "text-red-600 dark:text-red-400"
    }
  }

  const successConfig = getSuccessConfig(successRate)

  const yearsToRetirement = retirementAge - currentAge
  const yearsToLifeExpectancy = lifeExpectancy - currentAge

  const metrics = [
    {
      label: "Portfolio at Retirement",
      value: formatCurrency(
        projection.portfolioAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      icon: Wallet,
      description: `At age ${retirementAge}${displayMode === 'real' ? " (today's value)" : ''}`,
    },
    {
      label: "Monthly Income",
      value: formatCurrency(
        projection.monthlyIncomeAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      icon: TrendingUp,
      description: `Initial withdrawal${displayMode === 'real' ? " (today's value)" : ''}`,
    },
    {
      label: "Portfolio Depletion",
      value: projection.portfolioDepletionAge
        ? `Age ${projection.portfolioDepletionAge}`
        : "Never",
      icon: projection.portfolioDepletionAge ? TrendingDown : TrendingUp,
      description: projection.portfolioDepletionAge
        ? "Funds run out"
        : "Funds last lifetime",
      isWarning: !!projection.portfolioDepletionAge,
    },
    {
      label: "Final Balance",
      value: formatCurrency(
        projection.surplusAmount,
        displayMode,
        yearsToLifeExpectancy,
        inflationRate / 100
      ),
      icon: Calendar,
      description: `At life expectancy${displayMode === 'real' ? " (today's value)" : ''}`,
    },
    ...(simulationResult ? [{
      label: "Plan Success Rate",
      value: `${successRate.toFixed(0)}%`,
      icon: TrendingUp,
      description: successConfig.label,
      isSuccess: true,
      successBorder: successConfig.border,
      successText: successConfig.text,
    }] : []),
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className={
            metric.isWarning
              ? "border-orange-500"
              : metric.isSuccess
                ? metric.successBorder
                : ""
          }
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p
                  className={`text-2xl font-bold ${
                    metric.isWarning
                      ? "text-orange-500"
                      : metric.isSuccess
                        ? metric.successText
                        : ""
                  }`}
                >
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </div>
              <metric.icon
                className={`h-5 w-5 ${
                  metric.isWarning
                    ? "text-orange-500"
                    : metric.isSuccess
                      ? metric.successText
                      : "text-muted-foreground"
                }`}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
