"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import { calculateCostOfDelay } from "@/lib/calculations/cost-of-delay"
import { formatCurrency } from "@/lib/utils/formatters"
import type { PersonalInfo, RetirementGoals, CompoundingMethod } from "@/types"
import { Clock } from "lucide-react"
import { memo, useMemo } from "react"

interface CostOfDelayChartProps {
  currentSavings: number
  monthlyContribution: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  expectedReturn: number // decimal
  fees: number // decimal
  contributionEscalation: number // decimal
  compoundingMethod: CompoundingMethod
}

const chartConfig = {
  cost: { label: "Cost of delay", color: "hsl(var(--warning))" },
} satisfies ChartConfig

export const CostOfDelayChart = memo(function CostOfDelayChart({
  currentSavings,
  monthlyContribution,
  personalInfo,
  retirementGoals,
  expectedReturn,
  fees,
  contributionEscalation,
  compoundingMethod,
}: CostOfDelayChartProps) {
  const result = useMemo(
    () =>
      calculateCostOfDelay({
        currentSavings,
        monthlyContribution,
        personalInfo,
        retirementGoals,
        expectedReturn,
        fees,
        contributionEscalation,
        compoundingMethod,
      }),
    [currentSavings, monthlyContribution, personalInfo, retirementGoals, expectedReturn, fees, contributionEscalation, compoundingMethod]
  )

  const data = useMemo(
    () => [
      { name: "1 year", cost: result.costOfOneYearDelay, pct: result.percentageLostOneYear },
      { name: "2 years", cost: result.costOfTwoYearDelay, pct: result.percentageLostTwoYear },
      { name: "5 years", cost: result.costOfFiveYearDelay, pct: result.percentageLostFiveYear },
    ],
    [result]
  )

  const hasAnyCost = data.some((d) => d.cost > 0)

  if (!hasAnyCost) {
    return (
      <Card className="dashboard-card shadow-none">
        <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
          <SectionLabel>Cost of Delay</SectionLabel>
          <p className="text-sm text-muted-foreground pl-3">
            Nest egg lost by delaying the start of saving
          </p>
        </div>
        <CardContent className="flex h-[180px] md:h-[260px] items-center justify-center gap-2 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Add contributions to see the cost of delay</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="dashboard-card shadow-none" role="figure" aria-label="Cost of delaying retirement savings by one, two, and five years">
      <div className="px-4 pt-4 pb-2 md:px-6 md:pt-6 md:pb-3 space-y-1">
        <SectionLabel>Cost of Delay</SectionLabel>
        <p className="text-sm text-muted-foreground pl-3">
          Nest egg lost by delaying the start of saving
        </p>
      </div>
      <CardContent className="w-full overflow-x-auto px-2 pb-2 pt-0 md:px-6 md:pb-6">
        <ChartContainer config={chartConfig} className="h-[180px] md:h-[260px] w-full">
          <BarChart
            data={data}
            margin={{ top: 16, right: 16, left: 0, bottom: 0 }}
            barGap={16}
          >
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11 }}
              width={72}
              tickFormatter={(value) => formatCurrency(Number(value) || 0, { compact: true })}
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) =>
                    `${formatCurrency(Number(value) || 0)} (${item?.payload?.pct.toFixed(1)}%)`
                  }
                />
              }
            />
            <Bar dataKey="cost" name="Cost of delay" fill="hsl(var(--warning))" radius={[3, 3, 0, 0]} maxBarSize={56} isAnimationActive={false}>
              {data.map((row) => (
                <Cell key={row.name} fill={row.cost > 0 ? "hsl(var(--warning))" : "hsl(var(--muted))"} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
})
