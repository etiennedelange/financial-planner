"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/formatters"
import type { SimulationResult } from "@/types"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

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
      label: "Median",
      color: "hsl(var(--chart-1))",
    },
    p75: {
      label: "Likely range",
      color: "hsl(var(--chart-1))",
    },
    p90: {
      label: "Possible range",
      color: "hsl(var(--chart-1))",
    },
    p25: {
      label: "25th pct",
      color: "hsl(var(--chart-1))",
    },
    p10: {
      label: "10th pct",
      color: "hsl(var(--chart-1))",
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
    <Card className="dashboard-card">
      <CardHeader className="pb-4">
        <CardTitle>Monte Carlo Projection</CardTitle>
        <CardDescription>
          Based on {simulationResult.runs.length.toLocaleString()} simulations
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="mcBand90" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.08} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="mcBand75" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="mcBand50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.22} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.06} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="age"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={68}
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
            {/* Outer band: 10th–90th percentile */}
            <Area
              type="monotone"
              dataKey="p90"
              stroke="none"
              fill="url(#mcBand90)"
              stackId="1"
              dot={false}
            />
            {/* Inner band: 25th–75th percentile */}
            <Area
              type="monotone"
              dataKey="p75"
              stroke="none"
              fill="url(#mcBand75)"
              stackId="2"
              dot={false}
            />
            {/* Median line */}
            <Area
              type="monotone"
              dataKey="p50"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fill="url(#mcBand50)"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
