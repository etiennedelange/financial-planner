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
import type { YearlyProjection } from "@/types"
import { formatCurrency } from "@/lib/utils/formatters"

interface PortfolioGrowthChartProps {
  projections: YearlyProjection[]
  retirementAge: number
}

export function PortfolioGrowthChart({
  projections,
  retirementAge,
}: PortfolioGrowthChartProps) {
  if (projections.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Portfolio Growth Over Time</CardTitle>
          <CardDescription>
            Deterministic projection of portfolio value
          </CardDescription>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">
            Add accounts to see projections
          </p>
        </CardContent>
      </Card>
    )
  }

  const chartConfig = {
    balance: {
      label: "Portfolio Balance",
      color: "hsl(var(--chart-1))",
    },
  } satisfies ChartConfig

  const data = projections.map((p) => ({
    age: p.age,
    balance: p.endingBalance,
    contributions: p.contributions,
    withdrawals: p.withdrawals,
  }))

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>Portfolio Growth Over Time</CardTitle>
        <CardDescription>
          Projected balance from age {projections[0].age} to {projections[projections.length - 1].age}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <AreaChart
            data={data}
            margin={{ top: 20, right: 30, left: 0, bottom: 10 }}
          >
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.8} />
                <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="age"
              tickFormatter={(age) => `${age}`}
              label={{ value: "Age", position: "insideBottom", offset: 0 }}
            />
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
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--chart-1))"
              fillOpacity={1}
              fill="url(#colorBalance)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
