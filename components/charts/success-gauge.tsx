"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SuccessGaugeProps {
  successRate: number // 0-100
}

export function SuccessGauge({ successRate }: SuccessGaugeProps) {
  const getColor = (rate: number) => {
    if (rate >= 90) return { bg: "bg-green-500", text: "text-green-500" }
    if (rate >= 75) return { bg: "bg-lime-500", text: "text-lime-500" }
    if (rate >= 50) return { bg: "bg-yellow-500", text: "text-yellow-500" }
    if (rate >= 25) return { bg: "bg-orange-500", text: "text-orange-500" }
    return { bg: "bg-red-500", text: "text-red-500" }
  }

  const getMessage = (rate: number) => {
    if (rate >= 90) return "Excellent"
    if (rate >= 75) return "Good"
    if (rate >= 50) return "Moderate"
    if (rate >= 25) return "At Risk"
    return "Critical"
  }

  const colors = getColor(successRate)
  const angle = (successRate / 100) * 180 - 90 // -90 to 90 degrees

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
            style={{
              clipPath: `polygon(50% 100%, 0% 100%, 0% 0%, ${50 + 50 * Math.cos((angle * Math.PI) / 180)}% ${100 - 100 * Math.sin((angle * Math.PI) / 180)}%, 50% 100%)`,
            }}
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
