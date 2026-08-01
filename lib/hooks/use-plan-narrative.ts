"use client"

import { useCallback, useRef, useState } from "react"
import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, ProjectionResult, SimulationResult } from "@/types"
import { buildPlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

interface UsePlanNarrativeInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
}

const COOLDOWN_SECONDS = 8

export function usePlanNarrative(input: UsePlanNarrativeInput) {
  const [text, setText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  const cacheRef = useRef<{ payloadJson: string; text: string } | null>(null)
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

    const payloadJson = JSON.stringify(payload)

    if (cacheRef.current && cacheRef.current.payloadJson === payloadJson) {
      setText(cacheRef.current.text)
      setError(null)
      return
    }

    setError(null)
    setIsStreaming(true)
    setText("")

    try {
      const response = await fetch("/api/plan-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadJson,
      })

      if (!response.ok || !response.body) {
        throw new Error("Request failed")
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        fullText += decoder.decode(value, { stream: true })
        setText(fullText)
      }

      cacheRef.current = { payloadJson, text: fullText }
      startCooldown()
    } catch {
      setError("Couldn't generate a summary right now. Please try again.")
    } finally {
      setIsStreaming(false)
    }
  }, [input, startCooldown])

  return { text, isStreaming, error, cooldownRemaining, generate }
}
