"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
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
import { buildIncomeSustainabilitySeries } from "@/lib/calculations/utils/income-sustainability"
import { formatCurrency } from "@/lib/utils/currency"
import type { ProjectionResult } from "@/types"
import { ArrowDownToLine } from "lucide-react"
import { memo, useMemo } from "react"

interface IncomeSustainabilityChartProps {
  projection: ProjectionResult
  desiredMonthlyIncome: number
  currentAge: number
  retirementAge: number
  inflationRate: number
  displayMode: "nominal" | "real"
}

const chartConfig = {
  income: { label: "Projected income", color: "hsl(var(--chart-1))" },
  target: { label: "Income target", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig

export const IncomeSustainabilityChart = memo(function IncomeSustainabilityChart({
  projection,
  desiredMonthlyIncome,
  currentAge,
  retirementAge,
  inflationRate,
  displayMode,
}: IncomeSustainabilityChartProps) {
  const series = useMemo(
    () =>
      buildIncomeSustainabilitySeries({
        projection,
        desiredMonthlyIncome,
        currentAge,
        retirementAge,
        inflationRate,
        displayMode,
      }),
    [projection, desiredMonthlyIncome, currentAge, retirementAge, inflationRate, displayMode]
  )

  const data = useMemo(
    () =>
      series.points.map((p) => ({
        age: p.age,
        income: p.income,
        target: p.target,
      })),
    [series]
  )

  if (data.length === 0) {
    return (
      <Card className="dashboard-card shadow-none">
        <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
          <SectionLabel>Income Through Retirement</SectionLabel>
          <p className="text-sm text-muted-foreground pl-3">
            Projected monthly income vs. your inflation-adjusted target
          </p>
        </div>
        <CardContent className="flex h-(--chart-height-compact) md:h-(--chart-height-full) items-center justify-center gap-2 text-center">
          <ArrowDownToLine className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">No drawdown years to show yet</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="dashboard-card shadow-none" role="figure" aria-label={`Projected monthly income from age ${retirementAge} compared to your income target`}>
      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
        <SectionLabel>Income Through Retirement</SectionLabel>
        <p className="text-sm text-muted-foreground pl-3">
          {displayMode === "real" ? "Today's value" : "Future value"} · projected monthly income vs. target
          {series.depletionAge !== null && (
            <span className="text-destructive"> · runs out at age {series.depletionAge}</span>
          )}
        </p>
      </div>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-(--chart-height-compact) md:h-(--chart-height-full) w-full">
          <AreaChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="age"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(age) => `${age}`}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={72}
              tickFormatter={(value) => formatCurrency(Number(value) || 0, { compact: true })}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(age) => `Age ${age}`}
                  formatter={(value) => formatCurrency(Number(value) || 0)}
                />
              }
            />
            <ReferenceLine
              x={retirementAge}
              stroke="hsl(var(--muted-foreground))"
              strokeOpacity={0.4}
              strokeDasharray="4 4"
              label={{
                value: `Retire ${retirementAge}`,
                position: "insideTopLeft",
                fill: "hsl(var(--muted-foreground))",
                fontSize: 11,
                fontWeight: 500,
              }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#incomeFill)"
              dot={false}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="target"
              stroke="hsl(var(--chart-4))"
              strokeWidth={2}
              strokeDasharray="5 4"
              fill="none"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
      <ChartDataTable
        columns={[
          { key: "age", label: "Age", align: "right" },
          { key: "income", label: "Projected income /mo", align: "right", format: (v) => formatCurrency(Number(v)) },
          { key: "target", label: "Income target /mo", align: "right", format: (v) => formatCurrency(Number(v)) },
        ]}
        rows={data}
        caption={`Monthly income from age ${retirementAge} vs. your inflation-adjusted target`}
      />
    </Card>
  )
})
