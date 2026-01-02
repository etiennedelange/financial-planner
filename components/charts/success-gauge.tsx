"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SuccessGaugeProps {
  successRate: number // 0-100
}

export function SuccessGauge({ successRate }: SuccessGaugeProps) {
  const getColor = (rate: number) => {
    if (rate >= 90) return { bg: "bg-green-500", text: "text-green-700 dark:text-green-400" }
    if (rate >= 75) return { bg: "bg-lime-500", text: "text-lime-700 dark:text-lime-400" }
    if (rate >= 50) return { bg: "bg-yellow-500", text: "text-yellow-700 dark:text-yellow-400" }
    if (rate >= 25) return { bg: "bg-orange-500", text: "text-orange-700 dark:text-orange-400" }
    return { bg: "bg-red-500", text: "text-red-700 dark:text-red-400" }
  }

  const getMessage = (rate: number) => {
    if (rate >= 90) return "Excellent"
    if (rate >= 75) return "Good"
    if (rate >= 50) return "Moderate"
    if (rate >= 25) return "At Risk"
    return "Critical"
  }

  const colors = getColor(successRate)
  const clampedRate = Math.min(100, Math.max(0, successRate))

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-base">Success Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        {/* Large percentage display */}
        <div className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold ${colors.text}`}>
            {successRate.toFixed(0)}
          </span>
          <span className={`text-2xl font-semibold ${colors.text}`}>%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
              style={{ width: `${clampedRate}%` }}
            />
          </div>
          {/* Scale markers */}
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>0%</span>
            <span>50%</span>
            <span>100%</span>
          </div>
        </div>

        {/* Status message */}
        <p className={`font-semibold ${colors.text}`}>
          {getMessage(successRate)}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Probability of funds lasting through retirement
        </p>
      </CardContent>
    </Card>
  )
}
