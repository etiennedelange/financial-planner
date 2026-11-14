import type { ProviderId } from "@/lib/ai/providers/origins"

export type ModelTier = "fast" | "balanced" | "best"

export const DEFAULT_MODEL_TIER: ModelTier = "balanced"

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  openai: "OpenAI",
  gemini: "Google (Gemini)",
}

// Model ids per provider and tier, sent straight to the provider's own API.
// These are the ONLY place model names live. Provider model catalogues change, so
// re-check them against each provider's docs when touching this file — an id the
// provider no longer serves surfaces to the user as a "bad request" error.
export const MODEL_TIERS: Record<ProviderId, Record<ModelTier, string>> = {
  anthropic: {
    fast: "claude-haiku-5-5",
    balanced: "claude-sonnet-5-5",
    best: "claude-opus-5-5",
  },
  openai: {
    fast: "gpt-4.1-mini",
    balanced: "gpt-4.1",
    best: "gpt-4.1",
  },
  gemini: {
    fast: "gemini-2.5-flash",
    balanced: "gemini-2.5-flash",
    best: "gemini-2.5-pro",
  },
}

/** A 3–4 paragraph summary is a few hundred tokens; this bounds the cost of any one request. */
export const MAX_OUTPUT_TOKENS = 700
