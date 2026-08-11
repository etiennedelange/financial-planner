"use client"

import { useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useCalculator } from "@/lib/context/calculator-context"
import { usePlanNarrative } from "@/lib/hooks/use-plan-narrative"
import { DEFAULT_MODEL_TIER, type ModelTier } from "@/lib/ai/model-tiers"
import { Sparkles } from "lucide-react"

const TIER_LABELS: Record<ModelTier, string> = {
  fast: "Fast",
  balanced: "Balanced",
  best: "Best",
}

const TIER_STORAGE_KEY = "plan-narrative-model-tier"

function isModelTier(value: string): value is ModelTier {
  return value in TIER_LABELS
}

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

  const [tier, setTier] = useState<ModelTier>(DEFAULT_MODEL_TIER)

  useEffect(() => {
    const stored = localStorage.getItem(TIER_STORAGE_KEY)
    if (stored && isModelTier(stored)) {
      // Deferred out of the effect's synchronous body — localStorage can't be
      // read during render (SSR), and applying the stored tier async avoids a
      // hydration mismatch while still hydrating the saved preference.
      const id = requestAnimationFrame(() => setTier(stored))
      return () => cancelAnimationFrame(id)
    }
  }, [])

  const handleTierChange = (value: string) => {
    if (!isModelTier(value)) return
    setTier(value)
    localStorage.setItem(TIER_STORAGE_KEY, value)
  }

  const { text, isStreaming, error, cooldownRemaining, generate, clear } = usePlanNarrative({
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    projection,
    simulationResult,
    tier,
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

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={text ? "outline" : "default"}
          size="sm"
          onClick={generate}
          disabled={isStreaming || cooldownRemaining > 0}
        >
          {buttonLabel}
        </Button>

        {text && (
          <Button variant="ghost" size="sm" onClick={clear} disabled={isStreaming}>
            Clear
          </Button>
        )}

        <Select value={tier} onValueChange={handleTierChange} disabled={isStreaming}>
          <SelectTrigger className="w-28 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(TIER_LABELS) as ModelTier[]).map((value) => (
              <SelectItem key={value} value={value}>
                {TIER_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground">
        Generating uses AI and sends your plan&apos;s numbers to our AI provider. This is an automated
        educational summary, not financial advice — consult a licensed financial advisor before making
        decisions.
      </p>
    </PageCard>
  )
}
