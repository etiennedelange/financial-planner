"use client"

import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useCalculator } from "@/lib/context/calculator-context"
import { usePlanNarrative } from "@/lib/hooks/use-plan-narrative"
import { Sparkles } from "lucide-react"

export function PlanNarrativeCard() {
  const { accounts, personalInfo, retirementGoals, drawdownConfig } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      drawdownConfig: state.drawdownConfig,
    }))
  )
  const { projection, simulationResult } = useCalculator()

  const { text, isStreaming, error, cooldownRemaining, generate } = usePlanNarrative({
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    projection,
    simulationResult,
  })

  if (accounts.length === 0 || !projection) return null

  const buttonLabel = isStreaming
    ? "Generating…"
    : cooldownRemaining > 0
      ? `Try again in ${cooldownRemaining}s`
      : text
        ? "Regenerate"
        : "Explain my plan"

  return (
    <PageCard
      label="Explain My Plan"
      leading={<Sparkles className="h-4 w-4 text-primary" />}
      contentClassName="space-y-3"
    >
      {text && <p className="text-sm leading-relaxed whitespace-pre-wrap">{text}</p>}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button
        variant={text ? "outline" : "default"}
        size="sm"
        onClick={generate}
        disabled={isStreaming || cooldownRemaining > 0}
      >
        {buttonLabel}
      </Button>

      <p className="text-xs text-muted-foreground">
        Generating uses AI and sends your plan&apos;s numbers to our AI provider. This is an automated
        educational summary, not financial advice — consult a licensed financial advisor before making
        decisions.
      </p>
    </PageCard>
  )
}
