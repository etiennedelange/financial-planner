"use client"

import { PageCard } from "@/components/ui/page-card"
import { Badge } from "@/components/ui/badge"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { PieChart } from "lucide-react"
import type { ScenarioComparisonResult, ScenarioType } from "@/lib/calculations/scenario-comparison"
import { formatCurrency } from "@/lib/utils/currency"

interface InvestmentScenariosCardProps {
  /** From `compareScenarios`, computed once by the page and shared with the chart. */
  result: ScenarioComparisonResult
  displayMode: "nominal" | "real"
  yearsToRetirement: number
  inflationRate: number // decimal, e.g. 0.055
}

/**
 * Conservative / balanced / aggressive comparison. Each scenario is a full Monte Carlo
 * run, so this lives on the Risk page with the rest of the market-volatility analysis
 * (moved from the Projections insights panel on 2026-10-31).
 */
export function InvestmentScenariosCard({
  result,
  displayMode,
  yearsToRetirement,
  inflationRate,
}: InvestmentScenariosCardProps) {
  return (
    <PageCard
      label="Scenario Details"
      leading={<PieChart className="h-4 w-4 text-muted-foreground flex-none" />}
      trailing={
        <InfoTooltip
          content="Compares how different investment strategies (Conservative, Balanced, Aggressive) affect your retirement outcomes. Each scenario runs a full Monte Carlo simulation (1,000 iterations) including both the accumulation phase (while saving) and drawdown phase (during retirement). Higher returns come with higher volatility."
          side="right"
        />
      }
      contentClassName="space-y-4"
    >
      <div className="space-y-4">
        {(["conservative", "balanced", "aggressive"] as ScenarioType[]).map((key) => {
          const scenario = result[key]
          const isRecommended = key === result.recommendedScenario
          return (
            <div
              key={key}
              className={`rounded-lg border p-3 ${
                isRecommended ? "border-primary bg-primary/5" : "border-border"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{scenario.scenario}</span>
                  {isRecommended && (
                    <Badge variant="default" className="text-xs">
                      Recommended
                    </Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {scenario.nominalReturn.toFixed(1)}% return
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nest egg: </span>
                  <span>
                    {formatCurrency(
                      scenario.projectedNestEgg,
                      displayMode,
                      yearsToRetirement,
                      inflationRate,
                    )}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Success: </span>
                  <span
                    className={
                      scenario.successProbability >= 75
                        ? "text-chart-2"
                        : scenario.successProbability >= 50
                          ? "text-warning"
                          : "text-destructive"
                    }
                  >
                    {scenario.successProbability.toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Lasts: </span>
                  <span>{scenario.yearsLasts} years</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Volatility: </span>
                  <span>{scenario.volatility.toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )
        })}
        <p className="text-sm text-muted-foreground">{result.recommendation}</p>
      </div>
    </PageCard>
  )
}
