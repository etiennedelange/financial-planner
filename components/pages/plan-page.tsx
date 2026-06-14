"use client"

import { AssumptionsForm } from "@/components/inputs/assumptions-form"
import { DrawdownStrategyForm } from "@/components/inputs/drawdown-strategy-form"
import { PersonalInfoForm } from "@/components/inputs/personal-info-form"
import { RetirementGoalsForm } from "@/components/inputs/retirement-goals-form"
import { PageHeader } from "@/components/ui/page-header"
import type { ProjectionResult } from "@/types"

interface PlanPageProps {
  projection: ProjectionResult | null
  displayMode: "nominal" | "real"
}

export function PlanPage({ projection, displayMode }: PlanPageProps) {
  return (
    <div className="space-y-6">
      <PageHeader title="Plan" description="Your retirement timeline, goals, and market assumptions." />
      <PersonalInfoForm />
      <RetirementGoalsForm />
      <AssumptionsForm />
      <DrawdownStrategyForm
        portfolioAtRetirement={projection?.portfolioAtRetirement}
        displayMode={displayMode}
      />
    </div>
  )
}
