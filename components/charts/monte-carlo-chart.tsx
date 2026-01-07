"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import type { SimulationResult } from "@/types"
import { formatCurrency } from "@/lib/utils/formatters"

interface MonteCarloChartProps {
  simulationResult: SimulationResult | null
  currentAge: number
  retirementAge: number
  isRunning?: boolean
}

export function MonteCarloChart({
  simulationResult,
  currentAge,
  retirementAge,
  isRunning = false,
}: MonteCarloChartProps) {
  if (!simulationResult || simulationResult.percentiles.p50.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Monte Carlo Projection</CardTitle>
          <CardDescription>
            Run simulation to see probability ranges
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          {isRunning ? (
            <p className="text-muted-foreground">Running simulation...</p>
          ) : (
            <p className="text-muted-foreground">
              Add accounts and run simulation
            </p>
          )}
        </CardContent>
      </Card>
    )
  }

  const { percentiles } = simulationResult

  const chartConfig = {
    p50: {
      label: "Median (50th)",
      color: "hsl(var(--chart-1))",
    },
    p75: {
      label: "75th Percentile",
      color: "hsl(var(--chart-2))",
    },
    p90: {
      label: "90th Percentile",
      color: "hsl(var(--chart-3))",
    },
    p25: {
      label: "25th Percentile",
      color: "hsl(var(--chart-4))",
    },
    p10: {
      label: "10th Percentile",
      color: "hsl(var(--chart-5))",
    },
  } satisfies ChartConfig

  const data = percentiles.p50.map((_, index) => ({
    age: currentAge + index,
    p10: percentiles.p10[index],
    p25: percentiles.p25[index],
    p50: percentiles.p50[index],
    p75: percentiles.p75[index],
    p90: percentiles.p90[index],
  }))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Monte Carlo Projection</CardTitle>
        <CardDescription>
          Based on {simulationResult.runs.length.toLocaleString()} simulations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorP75" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.6} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" />
            <YAxis
              tickFormatter={(value) => formatCurrency(value, { compact: true })}
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
              stroke="hsl(var(--destructive))"
              strokeDasharray="5 5"
              label={{
                value: `Retirement (${retirementAge})`,
                position: "insideTopLeft",
                fill: "hsl(var(--destructive))",
                fontSize: 12,
                fontWeight: 600,
              }}
            />
            {/* Outer band: 10th-90th percentile */}
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="url(#colorP90)"
              stackId="1"
            />
            {/* Middle band: 25th-75th percentile */}
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill="url(#colorP75)"
              stackId="2"
            />
            {/* Median line */}
            <Area
              type="monotone"
              dataKey="p50"
              stroke="hsl(var(--chart-1))"
              fill="url(#colorP50)"
              strokeWidth={2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
