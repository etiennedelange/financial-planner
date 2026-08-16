"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import { ChartDataTable } from "@/components/ui/chart-data-table"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { compareScenarios } from "@/lib/calculations/scenario-comparison"
import { formatCurrency } from "@/lib/utils/currency"
import { formatScenarioTooltip } from "@/lib/utils/chart-tooltip"
import { deflate } from "@/lib/calculations/utils/money-time"
import type { PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod } from "@/types"
import { PieChart } from "lucide-react"
import { memo, useMemo } from "react"

interface ScenarioComparisonChartProps {
  currentSavings: number
  monthlyContribution: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  contributionEscalation: number
  fees: number
  compoundingMethod: CompoundingMethod
  displayMode: "nominal" | "real"
}

const chartConfig = {
  nestEgg: { label: "Nest egg", color: "hsl(var(--chart-1))" },
  success: { label: "Success", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

export const ScenarioComparisonChart = memo(function ScenarioComparisonChart({
  currentSavings,
  monthlyContribution,
  personalInfo,
  retirementGoals,
  drawdownConfig,
  contributionEscalation,
  fees,
  compoundingMethod,
  displayMode,
}: ScenarioComparisonChartProps) {
  const result = useMemo(
    () =>
      compareScenarios({
        currentSavings,
        monthlyContribution,
        personalInfo,
        retirementGoals,
        drawdownConfig,
        contributionEscalation,
        fees,
        compoundingMethod,
      }),
    [currentSavings, monthlyContribution, personalInfo, retirementGoals, drawdownConfig, contributionEscalation, fees, compoundingMethod]
  )

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflationRate = retirementGoals.inflationRate / 100

  const data = useMemo(
    () =>
      (["conservative", "balanced", "aggressive"] as const).map((key) => {
        const scenario = result[key]
        return {
          name: scenario.scenario,
          nestEgg: displayMode === "real"
            ? deflate(scenario.projectedNestEgg, yearsToRetirement, inflationRate)
            : scenario.projectedNestEgg,
          success: scenario.successProbability,
        }
      }),
    [result, displayMode, yearsToRetirement, inflationRate]
  )

  const hasAnyInput = currentSavings > 0 || monthlyContribution > 0

  if (!hasAnyInput) {
    return (
      <Card className="dashboard-card shadow-none">
        <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
          <SectionLabel>Investment Scenarios</SectionLabel>
          <p className="text-sm text-muted-foreground pl-3">
            Nest egg and success rate by strategy
          </p>
        </div>
        <CardContent className="flex h-(--chart-height-compact) md:h-(--chart-height-full) flex-col items-center justify-center gap-2 text-center">
          <PieChart className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm font-medium text-muted-foreground">No data yet</p>
          <p className="text-xs text-muted-foreground/70">
            Add an account or contributions to compare scenarios
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="dashboard-card shadow-none" role="figure" aria-label="Nest egg and success probability across conservative, balanced, and aggressive investment scenarios">
      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
        <SectionLabel>Investment Scenarios</SectionLabel>
        <p className="text-sm text-muted-foreground pl-3">
          {displayMode === "real" ? "Today's value" : "Future value"} · nest egg and success rate by strategy
          {result.recommendedScenario && (
            <span className="text-primary"> · {result[result.recommendedScenario].scenario} recommended</span>
          )}
        </p>
      </div>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-(--chart-height-compact) md:h-(--chart-height-full) w-full">
          <BarChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
            barGap={8}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              yAxisId="nestEgg"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={72}
              tickFormatter={(value) => formatCurrency(Number(value) || 0, { compact: true })}
            />
            <YAxis
              yAxisId="success"
              orientation="right"
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={36}
              tickFormatter={(value) => `${value}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, _name, item) => formatScenarioTooltip(value, item)}
                />
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar
              yAxisId="nestEgg"
              dataKey="nestEgg"
              name="Nest egg"
              fill="hsl(var(--chart-1))"
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            >
              {data.map((row) => (
                <Cell
                  key={row.name}
                  fill={
                    row.name === result.recommendedScenario
                      ? "hsl(var(--chart-1))"
                      : "hsl(var(--muted))"
                  }
                />
              ))}
            </Bar>
            <Bar
              yAxisId="success"
              dataKey="success"
              name="Success rate"
              fill="hsl(var(--chart-4))"
              radius={[3, 3, 0, 0]}
              maxBarSize={48}
              isAnimationActive={false}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
      <ChartDataTable
        columns={[
          { key: "name", label: "Scenario", align: "left" },
          { key: "nestEgg", label: "Nest egg", align: "right", format: (v) => formatCurrency(Number(v)) },
          { key: "success", label: "Success rate", align: "right", format: (v) => `${Number(v).toFixed(1)}%` },
        ]}
        rows={data}
        caption={`Nest egg and success probability by investment strategy (${displayMode === "real" ? "today's value" : "future value"})`}
      />
    </Card>
  )
})
