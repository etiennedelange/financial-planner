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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
        <CardHeader>
          <CardTitle>Portfolio Growth Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex h-[300px] items-center justify-center">
          <p className="text-muted-foreground">
            Add accounts to see projections
          </p>
        </CardContent>
      </Card>
    )
  }

  const data = projections.map((p) => ({
    age: p.age,
    balance: p.endingBalance,
    contributions: p.contributions,
    withdrawals: p.withdrawals,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Growth Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="age"
              tickFormatter={(age) => `${age}`}
              label={{ value: "Age", position: "insideBottom", offset: -5 }}
            />
            <YAxis
              tickFormatter={(value) => formatCurrency(value, { compact: true })}
            />
            <Tooltip
              formatter={(value) => [formatCurrency(Number(value) || 0), "Balance"]}
              labelFormatter={(age) => `Age ${age}`}
            />
            <ReferenceLine
              x={retirementAge}
              stroke="#ef4444"
              strokeDasharray="5 5"
              label={{
                value: "Retirement",
                position: "top",
                fill: "#ef4444",
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="#2563eb"
              fillOpacity={1}
              fill="url(#colorBalance)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
