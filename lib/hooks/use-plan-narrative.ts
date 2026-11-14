"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  ProjectionResult,
} from "@/types"
import { buildPlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"
import { usePlanNarrativeStore } from "@/lib/store/plan-narrative-store"
import type { ModelTier } from "@/lib/ai/model-tiers"
import type { ProviderId } from "@/lib/ai/providers/origins"
import { ProviderError } from "@/lib/ai/providers/types"
import { streamNarrative } from "@/lib/ai/stream-narrative"

interface UsePlanNarrativeInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  tier: ModelTier
  provider: ProviderId
}

const COOLDOWN_SECONDS = 8

export function usePlanNarrative(input: UsePlanNarrativeInput) {
  // text/cache live in a module-scoped store (not component state) so they
  // survive navigating away from and back to the page that renders the card —
  // only clear()/a fresh generation replaces them, never an unmount.
  const { text, cache, setText, setCache, clear } = usePlanNarrativeStore()
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Navigating away mid-stream must stop the request (and the spend).
  useEffect(() => () => abortRef.current?.abort(), [])
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

    // The provider and tier are part of the cache key: switching either must not
    // replay a narrative produced by a different model.
    const payloadJson = JSON.stringify({ ...payload, tier: input.tier, provider: input.provider })

    if (cache && cache.payloadJson === payloadJson) {
      setText(cache.text)
      setError(null)
      setErrorCode(null)
      return
    }

    setError(null)
    setErrorCode(null)
    setIsStreaming(true)
    setText("")

    const controller = new AbortController()
    abortRef.current = controller

    try {
      let fullText = ""
      const stream = streamNarrative({
        provider: input.provider,
        tier: input.tier,
        payload,
        signal: controller.signal,
      })
      for await (const chunk of stream) {
        fullText += chunk
        setText(fullText)
      }

      if (fullText.length === 0) {
        setError("Couldn't generate a summary right now. Please try again.")
      } else {
        setCache({ payloadJson, text: fullText })
        startCooldown()
      }
    } catch (err) {
      // ProviderError messages are fixed strings that can never contain the key.
      const providerError = err instanceof ProviderError ? err : new ProviderError("unknown")
      if (providerError.code !== "aborted") {
        setError(providerError.message)
        setErrorCode(providerError.code)
      }
    } finally {
      setIsStreaming(false)
      abortRef.current = null
    }
  }, [input, cache, setText, setCache, startCooldown])

  const cancel = useCallback(() => abortRef.current?.abort(), [])

  return {
    text,
    isStreaming,
    error,
    errorCode,
    cooldownRemaining,
    generate,
    cancel,
    clear,
  }
}
