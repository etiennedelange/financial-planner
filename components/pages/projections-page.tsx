"use client"

import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { ProjectionSummary } from "@/components/results/projection-summary"
import { WhatIfPanel } from "@/components/results/what-if-panel"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult, SimulationResult } from "@/types"

interface ProjectionsPageProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating?: boolean
}

export function ProjectionsPage({ projection, simulationResult, isSimulating }: ProjectionsPageProps) {
  const { personalInfo, retirementGoals } = useCalculatorStore()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Projections</h1>
        <p className="text-sm text-muted-foreground">Your retirement outlook based on current inputs</p>
      </div>

      <ProjectionSummary
        projection={projection}
        retirementAge={personalInfo.retirementAge}
        currentAge={personalInfo.currentAge}
        lifeExpectancy={personalInfo.lifeExpectancy}
        inflationRate={retirementGoals.inflationRate}
        simulationResult={simulationResult}
        isSimulating={isSimulating}
      />

      <WhatIfPanel />

      <InsightsPanel />
      <CalculationsBreakdown projection={projection} />
    </div>
  )
}
