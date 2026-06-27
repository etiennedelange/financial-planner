"use client"

import { PageCard } from "@/components/ui/page-card"
import { getSuccessRateStyle } from "@/lib/utils/success-rate"

interface SuccessGaugeProps {
  successRate: number // 0-100
}

export function SuccessGauge({ successRate }: SuccessGaugeProps) {
  const style = getSuccessRateStyle(successRate)
  const clampedRate = Math.min(100, Math.max(0, successRate))

  return (
    <PageCard label="Success Rate" contentClassName="flex flex-col items-center gap-3">
        {/* Large percentage display */}
        <div className="flex items-baseline gap-1">
          <span className={`text-5xl font-bold ${style.text}`}>
            {successRate.toFixed(0)}
          </span>
          <span className={`text-2xl font-semibold ${style.text}`}>%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${style.bg}`}
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
        <p className={`font-semibold ${style.text}`}>
          {style.label}
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Probability of funds lasting through retirement
        </p>
    </PageCard>
  )
}
