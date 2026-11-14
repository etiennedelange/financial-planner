export type ModelTier = "fast" | "balanced" | "best"

/** Where the model runs. Both the hosted (server-configured) path and a user's own key use one of these. */
export type AiProviderId = "gateway" | "cloudflare"

export const AI_PROVIDER_IDS: readonly AiProviderId[] = ["gateway", "cloudflare"]

export const AI_PROVIDER_LABELS: Record<AiProviderId, string> = {
  gateway: "Vercel AI Gateway",
  cloudflare: "Cloudflare Workers AI",
}

/**
 * Server-authoritative tier → model mapping, per provider. The client only ever
 * sends a tier key, so it can never pick an arbitrary (expensive) model ID.
 *
 * Re-verify these IDs when touching this file — model catalogues move:
 * - Gateway: `curl -s https://ai-gateway.vercel.sh/v1/models` (verified 2026-11-14)
 * - Workers AI: https://developers.cloudflare.com/workers-ai/models/ (verified 2026-11-14;
 *   avoid anything marked "Planned Deprecation")
 */
export const MODEL_TIERS: Record<AiProviderId, Record<ModelTier, string>> = {
  gateway: {
    fast: "anthropic/claude-haiku-5.5",
    balanced: "anthropic/claude-sonnet-5.5",
    best: "anthropic/claude-opus-5.5",
  },
  cloudflare: {
    fast: "@cf/openai/gpt-oss-20b",
    balanced: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    best: "@cf/openai/gpt-oss-120b",
  },
}

export const DEFAULT_MODEL_TIER: ModelTier = "balanced"

export function isAiProviderId(value: unknown): value is AiProviderId {
  return typeof value === "string" && (AI_PROVIDER_IDS as readonly string[]).includes(value)
}
