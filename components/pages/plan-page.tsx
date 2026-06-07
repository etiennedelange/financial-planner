"use client"

import { AssumptionsForm } from "@/components/inputs/assumptions-form"
import { PersonalInfoForm } from "@/components/inputs/personal-info-form"
import { RetirementGoalsForm } from "@/components/inputs/retirement-goals-form"
import type { ProjectionResult } from "@/types"

interface PlanPageProps {
  projection: ProjectionResult | null
  yearsToRetirement: number
  displayMode: "nominal" | "real"
  inflationRate: number
}

export function PlanPage({ projection, yearsToRetirement, displayMode, inflationRate }: PlanPageProps) {
  return (
    <div className="space-y-6">
      <PersonalInfoForm />
      <RetirementGoalsForm />
      <AssumptionsForm
        portfolioAtRetirement={projection?.portfolioAtRetirement}
        yearsToRetirement={yearsToRetirement}
        displayMode={displayMode}
        inflationRate={inflationRate}
      />
    </div>
  )
}
