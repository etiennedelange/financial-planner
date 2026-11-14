import { DEFAULT_MODEL_TIER, type AiProviderId, type ModelTier } from "./model-tiers"

/**
 * Shared by browser and server: how a user's own AI key travels with a request
 * and what a well-formed key looks like. No SDK imports, so the client bundle
 * stays free of provider code.
 */

/** Request headers carrying a user's own key. Never logged, never stored server-side. */
export const AI_HEADERS = {
  provider: "x-ai-provider",
  apiKey: "x-ai-api-key",
  accountId: "x-ai-account-id",
} as const

// Printable ASCII with no spaces: rejects pasted newlines and keeps the value
// safe to forward as an Authorization header.
const TOKEN_PATTERN = /^[\x21-\x7e]{8,512}$/
// Cloudflare account IDs are 32 hex characters. Strict, because the value is
// interpolated into the request URL path.
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i

export function isValidApiToken(value: string): boolean {
  return TOKEN_PATTERN.test(value)
}

export function isValidCloudflareAccountId(value: string): boolean {
  return ACCOUNT_ID_PATTERN.test(value)
}

export type AiKeyMode = "hosted" | "own"

export interface AiKeySettings {
  mode: AiKeyMode
  provider: AiProviderId
  gatewayApiKey: string
  cloudflareAccountId: string
  cloudflareApiToken: string
}

export const DEFAULT_AI_KEY_SETTINGS: AiKeySettings = {
  mode: "hosted",
  provider: "gateway",
  gatewayApiKey: "",
  cloudflareAccountId: "",
  cloudflareApiToken: "",
}

export type OwnKeyProblem = "missing-key" | "invalid-key" | "missing-account" | "invalid-account"

/** What is wrong with the own-key fields for the selected provider, or null when usable. */
export function ownKeyProblem(settings: AiKeySettings): OwnKeyProblem | null {
  const key = (
    settings.provider === "gateway" ? settings.gatewayApiKey : settings.cloudflareApiToken
  ).trim()
  if (!key) return "missing-key"
  if (!isValidApiToken(key)) return "invalid-key"
  if (settings.provider === "cloudflare") {
    const accountId = settings.cloudflareAccountId.trim()
    if (!accountId) return "missing-account"
    if (!isValidCloudflareAccountId(accountId)) return "invalid-account"
  }
  return null
}

export const OWN_KEY_PROBLEM_MESSAGES: Record<OwnKeyProblem, string> = {
  "missing-key": "Enter your API key.",
  "invalid-key": "That doesn't look like an API key (no spaces, at least 8 characters).",
  "missing-account": "Enter your Cloudflare account ID.",
  "invalid-account": "A Cloudflare account ID is 32 letters and digits (0-9, a-f).",
}

/** True when requests will carry the user's own key. */
export function usesOwnKey(settings: AiKeySettings): boolean {
  return settings.mode === "own" && ownKeyProblem(settings) === null
}

/**
 * Headers for a narrative request. Empty in hosted mode. In own-key mode the
 * fields must be valid — the caller checks `ownKeyProblem` first, so a
 * half-filled form never silently falls back to the hosted provider.
 */
export function buildAiRequestHeaders(settings: AiKeySettings): Record<string, string> {
  if (settings.mode !== "own") return {}
  if (settings.provider === "gateway") {
    return {
      [AI_HEADERS.provider]: "gateway",
      [AI_HEADERS.apiKey]: settings.gatewayApiKey.trim(),
    }
  }
  return {
    [AI_HEADERS.provider]: "cloudflare",
    [AI_HEADERS.apiKey]: settings.cloudflareApiToken.trim(),
    [AI_HEADERS.accountId]: settings.cloudflareAccountId.trim(),
  }
}

/**
 * Identifies where a narrative came from, for the client-side cache, without
 * the secret itself: switching provider or key mode must not replay text that
 * another provider wrote.
 */
export function aiSourceKey(settings: AiKeySettings): string {
  return settings.mode === "own" ? `own:${settings.provider}` : "hosted"
}

export type NarrativeRequest =
  | { ok: true; body: string; headers: Record<string, string>; cacheKey: string }
  | { ok: false; error: string }

/**
 * Everything the browser sends for one narrative, decided in one place:
 * - own-key mode with unusable fields is an error, never a quiet fallback to
 *   the hosted provider (that would spend the app's credit, not the user's);
 * - the tier is only a real choice on the user's own key — hosted requests
 *   always send the default, matching what the server will run;
 * - the cache key names the source but never contains the secret.
 */
export function buildNarrativeRequest(
  payload: object,
  tier: ModelTier,
  settings: AiKeySettings,
): NarrativeRequest {
  if (settings.mode === "own") {
    const problem = ownKeyProblem(settings)
    if (problem) {
      return {
        ok: false,
        error: `${OWN_KEY_PROBLEM_MESSAGES[problem]} Update your AI key in Settings.`,
      }
    }
  }
  const effectiveTier = settings.mode === "own" ? tier : DEFAULT_MODEL_TIER
  const body = JSON.stringify({ ...payload, tier: effectiveTier })
  return {
    ok: true,
    body,
    headers: buildAiRequestHeaders(settings),
    cacheKey: `${aiSourceKey(settings)}|${body}`,
  }
}

/** Shows the last four characters only, e.g. "••••3f9a". */
export function maskSecret(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 4) return "••••"
  return `••••${trimmed.slice(-4)}`
}
