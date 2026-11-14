"use client"

import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { CopyPromptPanel } from "@/components/ai/copy-prompt-panel"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useCalculator } from "@/lib/context/calculator-context"
import { buildPlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"
import { Sparkles } from "lucide-react"

/**
 * "Explain my plan": the app makes no AI calls. It builds a ready-made prompt and the user
 * pastes it into the chat app they already use (a subscription works). Nothing is sent from here.
 */
export function PlanNarrativeCard() {
  const { accounts, personalInfo, retirementGoals, drawdownConfig } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      drawdownConfig: state.drawdownConfig,
    })),
  )
  const { projection } = useCalculator()

  if (accounts.length === 0 || !projection) return null

  const payload = buildPlanNarrativePayload({
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    projection,
  })
  if (!payload) return null

  return (
    <PageCard
      label="Explain My Plan"
      leading={<Sparkles className="h-4 w-4 text-primary" />}
      contentClassName="space-y-3"
    >
      <CopyPromptPanel payload={payload} />
    </PageCard>
  )
}
