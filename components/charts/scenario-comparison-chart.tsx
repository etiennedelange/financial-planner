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
        <ChartContainer config={chartConfig} className="h-[180px] md:h-[260px] w-full">
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
    </Card>
  )
})
