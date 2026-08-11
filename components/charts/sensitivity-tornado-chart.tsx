"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
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
import { buildSensitivityTornado } from "@/lib/calculations/utils/sensitivity-tornado"
import { formatCurrency } from "@/lib/utils/currency"
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, MarketAssumptions } from "@/types"
import { SlidersHorizontal } from "lucide-react"
import { memo, useMemo } from "react"

interface SensitivityTornadoChartProps {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  assumptions: MarketAssumptions
}

const chartConfig = {
  delta: { label: "Nest egg change", color: "hsl(var(--chart-1))" },
} satisfies ChartConfig

export const SensitivityTornadoChart = memo(function SensitivityTornadoChart({
  accounts,
  personalInfo,
  retirementGoals,
  drawdownConfig,
  assumptions,
}: SensitivityTornadoChartProps) {
  const bars = useMemo(
    () =>
      buildSensitivityTornado({
        accounts,
        personalInfo,
        retirementGoals,
        drawdownConfig,
        assumptions,
      }),
    [accounts, personalInfo, retirementGoals, drawdownConfig, assumptions]
  )

  // Flatten into one row per direction, signed value renders left/right of the baseline.
  const data = useMemo(() => {
    const rows: { key: string; label: string; side: string; delta: number }[] = []
    for (const bar of bars) {
      rows.push({ key: bar.key, label: `${bar.label} ${bar.highLabel}`, side: "high", delta: bar.highDelta })
      rows.push({ key: bar.key, label: `${bar.label} ${bar.lowLabel}`, side: "low", delta: bar.lowDelta })
    }
    return rows
  }, [bars])

  if (data.length === 0) {
    return (
      <Card className="dashboard-card shadow-none">
        <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
          <SectionLabel>Sensitivity to Assumptions</SectionLabel>
          <p className="text-sm text-muted-foreground pl-3">
            How each lever moves your projected nest egg
          </p>
        </div>
        <CardContent className="flex h-[180px] md:h-[260px] items-center justify-center gap-2 text-center">
          <SlidersHorizontal className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Add accounts to see sensitivity</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="dashboard-card shadow-none" role="figure" aria-label="Sensitivity tornado chart showing how contributions, return, and retirement age affect the nest egg">
      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
        <SectionLabel>Sensitivity to Assumptions</SectionLabel>
        <p className="text-sm text-muted-foreground pl-3">
          Change in projected nest egg from pulling each lever
        </p>
      </div>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-[180px] md:h-[260px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 16, bottom: 0 }}
            barCategoryGap="25%"
          >
            <CartesianGrid horizontal={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              tickFormatter={(value) => formatCurrency(Number(value) || 0, { compact: true })}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) =>
                    `${formatCurrency(Number(value) || 0)}${item?.payload?.side === "low" ? " ↓" : " ↑"}`
                  }
                />
              }
            />
            <ReferenceLine x={0} stroke="hsl(var(--muted-foreground))" strokeOpacity={0.5} />
            <Bar dataKey="delta" radius={[0, 3, 3, 0]} maxBarSize={12} isAnimationActive={false}>
              {data.map((row) => (
                <Cell
                  key={`${row.key}-${row.side}`}
                  fill={
                    row.delta >= 0
                      ? "hsl(var(--chart-2))"
                      : "hsl(var(--destructive))"
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
})
