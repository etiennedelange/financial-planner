"use client"

import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import type { ProjectionResult } from "@/types"

interface ProjectionsPageProps {
  projection: ProjectionResult | null
}

export function ProjectionsPage({ projection }: ProjectionsPageProps) {
  return (
    <div className="space-y-8">
      <InsightsPanel />
      <CalculationsBreakdown projection={projection} />
    </div>
  )
}
