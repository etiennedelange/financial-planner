"use client"

import { useCallback, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  ProjectionResult,
} from "@/types"
import { buildPlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"
import { usePlanNarrativeStore } from "@/lib/store/plan-narrative-store"
import { selectAiKeySettings, useAiSettingsStore } from "@/lib/store/ai-settings-store"
import type { ModelTier } from "@/lib/ai/model-tiers"
import { buildNarrativeRequest } from "@/lib/ai/own-key"
import {
  GENERIC_NARRATIVE_ERROR,
  readNarrativeError,
  readNarrativeStream,
} from "@/lib/ai/narrative-response"

interface UsePlanNarrativeInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  tier: ModelTier
}

const COOLDOWN_SECONDS = 8

export function usePlanNarrative(input: UsePlanNarrativeInput) {
  // text/cache live in a module-scoped store (not component state) so they
  // survive navigating away from and back to the page that renders the card —
  // only clear()/a fresh generation replaces them, never an unmount.
  const { text, cache, setText, setCache, clear } = usePlanNarrativeStore()
  const aiSettings = useAiSettingsStore(useShallow(selectAiKeySettings))
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCooldown = useCallback(() => {
    setCooldownRemaining(COOLDOWN_SECONDS)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  const generate = useCallback(async () => {
    const payload = buildPlanNarrativePayload(input)
    if (!payload) return

    const request = buildNarrativeRequest(payload, input.tier, aiSettings)
    if (!request.ok) {
      setError(request.error)
      return
    }
    const { body, headers, cacheKey } = request

    if (cache && cache.payloadJson === cacheKey) {
      setText(cache.text)
      setError(null)
      return
    }

    setError(null)
    setIsStreaming(true)
    setText("")

    try {
      const response = await fetch("/api/plan-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body,
      })

      if (!response.ok || !response.body) {
        setError(response.ok ? GENERIC_NARRATIVE_ERROR : await readNarrativeError(response))
        return
      }

      const fullText = await readNarrativeStream(response.body, setText)

      if (fullText.length === 0) {
        setError(GENERIC_NARRATIVE_ERROR)
      } else {
        // Only a stream that finished cleanly is cached and starts the cooldown.
        setCache({ payloadJson: cacheKey, text: fullText })
        startCooldown()
      }
    } catch {
      // Network failure or a stream aborted part-way: drop the partial text
      // rather than leave half a summary on screen looking complete.
      setText("")
      setError(GENERIC_NARRATIVE_ERROR)
    } finally {
      setIsStreaming(false)
    }
  }, [input, aiSettings, cache, setText, setCache, startCooldown])

  return { text, isStreaming, error, cooldownRemaining, generate, clear }
}
