"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SuccessGaugeProps {
  successRate: number // 0-100
}

export function SuccessGauge({ successRate }: SuccessGaugeProps) {
  const getColor = (rate: number) => {
    // Using darker text colors for better contrast/readability
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
  // Angle in radians: 0% = π (left), 50% = π/2 (top), 100% = 0 (right)
  const angleRadians = Math.PI * (1 - successRate / 100)

  // Calculate the point on the arc (center at 50%, 100%)
  const pointX = 50 + 50 * Math.cos(angleRadians)
  const pointY = 100 - 100 * Math.sin(angleRadians)

  // For rates > 50%, we need to extend the polygon to cover the right side
  const clipPath =
    successRate <= 50
      ? `polygon(50% 100%, 0% 100%, 0% 0%, ${pointX}% ${pointY}%, 50% 100%)`
      : `polygon(50% 100%, 0% 100%, 0% 0%, 100% 0%, 100% 100%, ${pointX}% ${pointY}%, 50% 100%)`

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-center text-base">Success Rate</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        {/* Semi-circle gauge */}
        <div className="relative h-24 w-48">
          {/* Background arc */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute bottom-0 left-0 right-0 h-24 rounded-t-full border-8 border-muted" />
          </div>
          {/* Filled arc - using clip-path for the fill effect */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath }}
          >
            <div
              className={`absolute bottom-0 left-0 right-0 h-24 rounded-t-full border-8 ${colors.bg}`}
            />
          </div>
          {/* Center text */}
          <div className="absolute inset-0 flex items-end justify-center pb-2">
            <span className={`text-3xl font-bold ${colors.text}`}>
              {successRate.toFixed(0)}%
            </span>
          </div>
        </div>
        <p className={`mt-2 font-medium ${colors.text}`}>
          {getMessage(successRate)}
        </p>
        <p className="mt-1 text-center text-xs text-muted-foreground">
          Probability of funds lasting through retirement
        </p>
      </CardContent>
    </Card>
  )
}
