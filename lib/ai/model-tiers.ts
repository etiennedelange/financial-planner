export type ModelTier = "fast" | "balanced" | "best"

export const MODEL_TIERS: Record<ModelTier, string> = {
  fast: "anthropic/claude-haiku-4.5",
  balanced: "anthropic/claude-sonnet-5",
  best: "anthropic/claude-opus-5",
}

export const DEFAULT_MODEL_TIER: ModelTier = "balanced"
