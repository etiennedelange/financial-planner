"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
      <CardHeader>
        <CardTitle>Monte Carlo Projection</CardTitle>
        <CardDescription>
          Based on {simulationResult.runs.length.toLocaleString()} simulations |{" "}
          {simulationResult.successRate.toFixed(0)}% success rate
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorP90" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorP75" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.2} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis dataKey="age" />
            <YAxis
              tickFormatter={(value) => formatCurrency(value, { compact: true })}
            />
            <Tooltip
              formatter={(value, name) => [
                formatCurrency(Number(value) || 0),
                name === "p90"
                  ? "90th Percentile"
                  : name === "p75"
                    ? "75th Percentile"
                    : name === "p50"
                      ? "Median"
                      : name === "p25"
                        ? "25th Percentile"
                        : "10th Percentile",
              ]}
              labelFormatter={(age) => `Age ${age}`}
            />
            <ReferenceLine
              x={retirementAge}
              stroke="#ef4444"
              strokeDasharray="5 5"
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
              stroke="#2563eb"
              fill="url(#colorP50)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-4 flex justify-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-blue-500" />
            <span>Median (50th)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500/40" />
            <span>25th-75th</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500/20" />
            <span>10th-90th</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
