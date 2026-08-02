"use client"

import { PlanPage } from "@/components/pages/plan-page"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"

export default function PlanRoute() {
  const { projection } = useCalculator()
  const { displayMode } = useCalculatorStore(
    useShallow((s) => ({
      displayMode: s.displayMode,
    }))
  )

  return (
    <PlanPage
      projection={projection}
      displayMode={displayMode}
    />
  )
}
