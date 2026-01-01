"use client"

import { TrendingUp, TrendingDown, Wallet, Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { ProjectionResult } from "@/types"
import { formatCurrency } from "@/lib/utils/formatters"

interface ProjectionSummaryProps {
  projection: ProjectionResult | null
  retirementAge: number
}

export function ProjectionSummary({
  projection,
  retirementAge,
}: ProjectionSummaryProps) {
  if (!projection) {
    return null
  }

  const metrics = [
    {
      label: "Portfolio at Retirement",
      value: formatCurrency(projection.portfolioAtRetirement),
      icon: Wallet,
      description: `At age ${retirementAge}`,
    },
    {
      label: "Monthly Income",
      value: formatCurrency(projection.monthlyIncomeAtRetirement),
      icon: TrendingUp,
      description: "Initial withdrawal",
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
      value: formatCurrency(projection.surplusAmount),
      icon: Calendar,
      description: "At life expectancy",
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
