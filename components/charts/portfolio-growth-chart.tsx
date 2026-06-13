"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp } from "lucide-react"
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
      <Card className="dashboard-card">
        <CardHeader className="pb-4">
          <CardTitle>Portfolio Growth Over Time</CardTitle>
          <CardDescription>Deterministic projection of portfolio value</CardDescription>
        </CardHeader>
        <CardContent className="relative flex h-[260px] items-center justify-center overflow-hidden">
          {/* Ghost growth curve: accumulates to retirement, gentle withdrawal after */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 360 260"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="pgc-ghost" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.07} />
                <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Area fill */}
            <path
              d="M 0 248 C 80 244 165 200 210 148 C 248 106 288 118 360 175 L 360 260 L 0 260 Z"
              fill="url(#pgc-ghost)"
            />
            {/* Curve: slow growth → steep → peaks at retirement → slight decline */}
            <path
              d="M 0 248 C 80 244 165 200 210 148 C 248 106 288 118 360 175"
              fill="none"
              stroke="hsl(var(--chart-1))"
              strokeWidth="1.5"
              strokeOpacity={0.22}
            />
            {/* Retirement reference */}
            <line
              x1="210" y1="12" x2="210" y2="252"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1"
              strokeOpacity={0.12}
              strokeDasharray="3 4"
            />
          </svg>
          <div className="relative flex flex-col items-center gap-2 text-center">
            <TrendingUp className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Add accounts to see your projections</p>
          </div>
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
    <Card className="dashboard-card" role="figure" aria-label={`Portfolio balance projection from age ${projections[0].age} to ${projections[projections.length - 1].age}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-balance">Portfolio Growth Over Time</CardTitle>
        <CardDescription>
          Projected balance from age {projections[0].age} to {projections[projections.length - 1].age}
        </CardDescription>
      </CardHeader>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-[260px] w-full">
          <AreaChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
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
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorBalance)"
              dot={false}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
