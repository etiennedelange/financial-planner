import { createGateway } from "ai"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"
import {
  DEFAULT_MODEL_TIER,
  MODEL_TIERS,
  isAiProviderId,
  type AiProviderId,
  type ModelTier,
} from "./model-tiers"
import { AI_HEADERS, isValidApiToken, isValidCloudflareAccountId } from "./own-key"

/**
 * Credentials for one model call. `source` records who pays: "hosted" is the
 * server's own configuration, "user" is a key the person pasted into Settings.
 */
export type AiCredentials =
  | { source: "hosted" | "user"; provider: "gateway"; apiKey?: string }
  | { source: "hosted" | "user"; provider: "cloudflare"; accountId: string; apiToken: string }

type Env = Record<string, string | undefined>

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * The server's own provider, from environment variables, or null when the
 * deployment has none (users must then bring a key).
 *
 * `AI_PROVIDER` (gateway | cloudflare | none) picks explicitly. Without it the
 * first configured provider wins: an AI Gateway key, then Workers AI
 * credentials, then Vercel's OIDC token (set automatically on Vercel, which the
 * gateway provider reads on its own).
 *
 * Workers AI uses CLOUDFLARE_AI_* names, not wrangler's CLOUDFLARE_API_TOKEN, so
 * a deploy token in the environment is never picked up as the app's AI key.
 */
export function resolveHostedCredentials(env: Env): AiCredentials | null {
  const gatewayKey = nonEmpty(env.AI_GATEWAY_API_KEY)
  const cfAccountId = nonEmpty(env.CLOUDFLARE_AI_ACCOUNT_ID)
  const cfToken = nonEmpty(env.CLOUDFLARE_AI_API_TOKEN)
  const cloudflare: AiCredentials | null =
    cfAccountId && cfToken && isValidCloudflareAccountId(cfAccountId)
      ? { source: "hosted", provider: "cloudflare", accountId: cfAccountId, apiToken: cfToken }
      : null
  const gateway: AiCredentials | null =
    gatewayKey || nonEmpty(env.VERCEL_OIDC_TOKEN)
      ? { source: "hosted", provider: "gateway", apiKey: gatewayKey }
      : null

  const explicit = nonEmpty(env.AI_PROVIDER)?.toLowerCase()
  if (explicit === "none") return null
  if (explicit === "gateway") return gateway
  if (explicit === "cloudflare") return cloudflare

  if (gatewayKey) return gateway
  return cloudflare ?? gateway
}

export type UserCredentialsResult =
  | { ok: true; credentials: AiCredentials | null }
  | { ok: false; error: string }

/**
 * A user's own key, read from request headers. No provider header means "use
 * the hosted provider" (`credentials: null`); a provider header with missing or
 * malformed values is an error, so a half-filled form never silently falls
 * back to the server's bill.
 */
export function parseUserCredentials(headers: Headers): UserCredentialsResult {
  const provider = headers.get(AI_HEADERS.provider)
  if (provider === null || provider === "") return { ok: true, credentials: null }
  if (!isAiProviderId(provider)) return { ok: false, error: "Unknown AI provider." }

  const apiKey = headers.get(AI_HEADERS.apiKey)?.trim() ?? ""
  if (!isValidApiToken(apiKey)) {
    return { ok: false, error: "Your API key is missing or not in a valid format." }
  }

  if (provider === "gateway") {
    return { ok: true, credentials: { source: "user", provider, apiKey } }
  }

  const accountId = headers.get(AI_HEADERS.accountId)?.trim() ?? ""
  if (!isValidCloudflareAccountId(accountId)) {
    return { ok: false, error: "Your Cloudflare account ID should be 32 hexadecimal characters." }
  }
  return { ok: true, credentials: { source: "user", provider, accountId, apiToken: apiKey } }
}

/**
 * Hosted callers always get the default tier: there is no entitlement system
 * yet to decide who may run the dearer models on the app's bill. A user paying
 * with their own key may pick any tier.
 */
export function resolveTier(requested: ModelTier | undefined, source: AiCredentials["source"]) {
  return source === "user" ? (requested ?? DEFAULT_MODEL_TIER) : DEFAULT_MODEL_TIER
}

export function cloudflareBaseUrl(accountId: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1`
}

export function modelIdFor(provider: AiProviderId, tier: ModelTier): string {
  return MODEL_TIERS[provider][tier]
}

export function createLanguageModel(credentials: AiCredentials, tier: ModelTier): LanguageModel {
  const modelId = modelIdFor(credentials.provider, tier)
  if (credentials.provider === "gateway") {
    // apiKey undefined → the provider falls back to AI_GATEWAY_API_KEY / Vercel OIDC.
    return createGateway({ apiKey: credentials.apiKey })(modelId)
  }
  return createOpenAICompatible({
    name: "workers-ai",
    baseURL: cloudflareBaseUrl(credentials.accountId),
    apiKey: credentials.apiToken,
  }).chatModel(modelId)
}

export const AI_NOT_CONFIGURED_MESSAGE =
  "AI summaries aren't set up on this server. Add your own API key in Settings to use them."

export const AI_SIGN_IN_REQUIRED_MESSAGE =
  "Sign in to use AI summaries, or add your own API key in Settings."

/**
 * Whether signed-out visitors may spend the app's own AI credit. Off unless
 * AI_HOSTED_GUEST_ACCESS=true: a public deployment without sign-in would
 * otherwise let anyone run up the operator's bill, limited only by the
 * best-effort per-IP rate limit.
 */
export function hostedGuestAccessAllowed(env: Record<string, string | undefined>): boolean {
  return env.AI_HOSTED_GUEST_ACCESS?.trim().toLowerCase() === "true"
}

export interface AiFailure {
  status: number
  message: string
}

function statusCodeOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  const status = (error as { statusCode?: unknown }).statusCode
  return typeof status === "number" ? status : undefined
}

/**
 * Maps a provider error to a response for the browser. Messages name the
 * cause without echoing provider error bodies, which can include account
 * details. A rejected hosted key is the operator's problem, not the user's, so
 * it is reported as unavailable rather than "your key".
 */
export function describeAiFailure(error: unknown, source: AiCredentials["source"]): AiFailure {
  const status = statusCodeOf(error)
  const own = source === "user"
  if (status === 401 || status === 403) {
    return own
      ? { status: 401, message: "The AI provider rejected your API key. Check it in Settings." }
      : { status: 503, message: "The AI service isn't available right now. Please try later." }
  }
  if (status === 402) {
    return own
      ? { status: 402, message: "Your AI provider account is out of credit." }
      : { status: 503, message: "The AI service isn't available right now. Please try later." }
  }
  if (status === 429) {
    return { status: 429, message: "The AI provider is rate-limiting requests. Try again shortly." }
  }
  if (status === 404) {
    return { status: 502, message: "The AI model isn't available from this provider." }
  }
  return { status: 502, message: "Couldn't generate a summary right now. Please try again." }
}
