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
    <div className="p-6 max-w-3xl space-y-10">
      <section className="space-y-4">
        <h2 className="text-base font-semibold">Personal Information</h2>
        <PersonalInfoForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Retirement Goals</h2>
        <RetirementGoalsForm />
      </section>

      <section className="space-y-4">
        <h2 className="text-base font-semibold">Investment Assumptions</h2>
        <AssumptionsForm
          portfolioAtRetirement={projection?.portfolioAtRetirement}
          yearsToRetirement={yearsToRetirement}
          displayMode={displayMode}
          inflationRate={inflationRate}
        />
      </section>
    </div>
  )
}
