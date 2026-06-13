"use client"

import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { PageHeader } from "@/components/ui/page-header"
import type { ProjectionResult } from "@/types"

interface ProjectionsPageProps {
  projection: ProjectionResult | null
}

export function ProjectionsPage({ projection }: ProjectionsPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title="Projections" description="In-depth analysis of your retirement outcomes and tax breakdown." />
      <InsightsPanel />
      <CalculationsBreakdown projection={projection} />
    </div>
  )
}
