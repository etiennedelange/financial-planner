"use client"

import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { ProjectionSummary } from "@/components/results/projection-summary"
import { WhatIfPanel } from "@/components/results/what-if-panel"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import type { ProjectionResult } from "@/types"

interface ProjectionsPageProps {
  projection: ProjectionResult | null
}

export function ProjectionsPage({ projection }: ProjectionsPageProps) {
  // Selected, not the whole store: this page stays mounted while hidden, and a bare
  // useCalculatorStore() re-rendered it on every unrelated store write
  const { personalInfo, retirementGoals } = useCalculatorStore(
    useShallow((state) => ({
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
    })),
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="text-lg font-semibold text-foreground">Projections</div>
        <p className="text-sm text-muted-foreground">
          Your retirement outlook based on current inputs
        </p>
      </div>

      <ProjectionSummary
        projection={projection}
        retirementAge={personalInfo.retirementAge}
        currentAge={personalInfo.currentAge}
        lifeExpectancy={personalInfo.lifeExpectancy}
        inflationRate={retirementGoals.inflationRate}
      />

      <WhatIfPanel />

      <InsightsPanel />
      <CalculationsBreakdown projection={projection} />
    </div>
  )
}
