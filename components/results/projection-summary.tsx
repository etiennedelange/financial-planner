"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectionResult } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"

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
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card
          key={metric.label}
          className={metric.isWarning ? "border-orange-500" : ""}
        >
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p
                  className={`text-2xl font-bold ${metric.isWarning ? "text-orange-500" : ""}`}
                >
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground">
                  {metric.description}
                </p>
              </div>
              <metric.icon
                className={`h-5 w-5 ${metric.isWarning ? "text-orange-500" : "text-muted-foreground"}`}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
