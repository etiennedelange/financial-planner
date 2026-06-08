"use client"

import { PlanPage } from "@/components/pages/plan-page"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"

export default function PlanRoute() {
  const { projection } = useCalculator()
  const { personalInfo, assumptions, displayMode } = useCalculatorStore(
    useShallow((s) => ({
      personalInfo: s.personalInfo,
      assumptions: s.assumptions,
      displayMode: s.displayMode,
    }))
  )

  return (
    <PlanPage
      projection={projection}
      yearsToRetirement={personalInfo.retirementAge - personalInfo.currentAge}
      displayMode={displayMode}
      inflationRate={assumptions.inflationRate / 100}
    />
  )
}
