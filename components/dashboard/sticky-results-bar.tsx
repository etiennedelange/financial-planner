"use client"

import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult, SimulationResult } from "@/types"
import { DollarSign, Gauge, Loader2, Target } from "lucide-react"

interface StickyResultsBarProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
  isVisible: boolean
  retirementAge: number
  currentAge: number
  inflationRate: number
  displayMode: "real" | "nominal"
}

function successRateColor(rate: number) {
  if (rate >= 90) return "text-green-500"
  if (rate >= 75) return "text-cyan-500"
  if (rate >= 60) return "text-orange-500"
  return "text-red-500"
}

export function StickyResultsBar({
  projection,
  simulationResult,
  isSimulating,
  isVisible,
  retirementAge,
  currentAge,
  inflationRate,
  displayMode,
}: StickyResultsBarProps) {
  if (!projection || !isVisible) return null

  const yearsToRetirement = retirementAge - currentAge
  const successRate = simulationResult?.successRate

  const metrics = [
    {
      icon: Target,
      label: "At Retirement",
      value: formatCurrency(
        projection.portfolioAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      colorClass: "",
    },
    {
      icon: DollarSign,
      label: "Monthly Income",
      value: formatCurrency(
        projection.monthlyIncomeAtRetirement,
        displayMode,
        yearsToRetirement,
        inflationRate / 100
      ),
      colorClass: "",
    },
    ...(successRate !== undefined
      ? [
          {
            icon: Gauge,
            label: "Success Rate",
            value: `${successRate.toFixed(0)}%`,
            colorClass: successRateColor(successRate),
          },
        ]
      : []),
  ]

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]">
      <div className="container mx-auto px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-6 flex-wrap">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center gap-1.5">
                <m.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">{m.label}:</span>
                <span className={`text-sm font-semibold tabular-nums ${m.colorClass}`}>{m.value}</span>
              </div>
            ))}
          </div>

          {isSimulating && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="hidden sm:inline">Recalculating…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
