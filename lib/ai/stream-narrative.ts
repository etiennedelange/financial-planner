import { getKey, getStatus } from "@/lib/ai/key-vault"
import { MAX_OUTPUT_TOKENS, MODEL_TIERS, type ModelTier } from "@/lib/ai/model-tiers"
import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"
import { streamAnthropic } from "@/lib/ai/providers/anthropic"
import { streamGemini } from "@/lib/ai/providers/gemini"
import { streamOpenAI } from "@/lib/ai/providers/openai"
import type { ProviderId } from "@/lib/ai/providers/origins"
import { ProviderError, type StreamRequest } from "@/lib/ai/providers/types"

const STREAMERS: Record<ProviderId, (req: StreamRequest) => AsyncGenerator<string>> = {
  anthropic: streamAnthropic,
  openai: streamOpenAI,
  gemini: streamGemini,
}

interface NarrativeRequest {
  provider: ProviderId
  tier: ModelTier
  payload: PlanNarrativePayload
  signal?: AbortSignal
}

/**
 * Streams a plan narrative straight from the user's chosen provider, using the key
 * from the vault. The key is read here, handed to the provider client for the
 * request's headers, and goes out of scope when the generator finishes — it is not
 * stored, returned or logged. Every failure is a ProviderError with a fixed message.
 */
export async function* streamNarrative(req: NarrativeRequest): AsyncGenerator<string> {
  const apiKey = getKey(req.provider)
  if (!apiKey) {
    throw new ProviderError(getStatus(req.provider) === "locked" ? "locked" : "no-key")
  }
  const { system, prompt } = buildPlanNarrativePrompt(req.payload)
  try {
    yield* STREAMERS[req.provider]({
      apiKey,
      model: MODEL_TIERS[req.provider][req.tier],
      system,
      prompt,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      signal: req.signal,
    })
  } catch (error) {
    // Only ProviderError (fixed messages) is allowed to escape.
    throw error instanceof ProviderError ? error : new ProviderError("unknown")
  }
}
