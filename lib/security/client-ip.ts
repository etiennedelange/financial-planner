type Env = Record<string, string | undefined>

/** Rate-limit bucket for every caller whose address can't be trusted. */
export const SHARED_CLIENT_BUCKET = "shared"

// Header names are ASCII tokens; anything else in the env var is a typo.
const HEADER_NAME_PATTERN = /^[a-z0-9-]+$/

/** True inside the Cloudflare Workers runtime (workerd), e.g. an OpenNext deployment. */
export function isCloudflareWorkersRuntime(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers"
}

/**
 * The request header that carries the client address *on this deployment*,
 * or null when no header can be trusted.
 *
 * A header is only trustworthy where the platform in front of the app
 * overwrites any client-sent value. Trusting one elsewhere lets a caller send
 * a new value per request and dodge the per-IP limit, so:
 * - `TRUSTED_CLIENT_IP_HEADER` (operator-set, e.g. `cf-connecting-ip` behind a
 *   Cloudflare proxy, or `x-forwarded-for` behind a proxy that rewrites it) wins;
 * - on Vercel (`VERCEL` env) it is `x-real-ip`;
 * - in the Cloudflare Workers runtime it is `cf-connecting-ip`;
 * - otherwise none.
 */
export function trustedClientIpHeader(
  env: Env = process.env,
  onCloudflareWorkers: boolean = isCloudflareWorkersRuntime(),
): string | null {
  const configured = env.TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase()
  if (configured) return HEADER_NAME_PATTERN.test(configured) ? configured : null
  if (env.VERCEL) return "x-real-ip"
  if (onCloudflareWorkers) return "cf-connecting-ip"
  return null
}

/**
 * Rate-limit identity for a signed-out caller: their address from the trusted
 * header, or one shared bucket when there is no trusted header (or it is
 * missing from the request). Sharing fails closed — callers can't spread
 * requests across invented addresses — at the cost of guests on such a
 * deployment sharing one quota until the operator sets
 * TRUSTED_CLIENT_IP_HEADER. Like the in-memory limiter it feeds, this raises
 * the cost of abuse; it is not a hard guarantee.
 */
export function clientRateLimitId(
  headers: Headers,
  env: Env = process.env,
  onCloudflareWorkers: boolean = isCloudflareWorkersRuntime(),
): string {
  const header = trustedClientIpHeader(env, onCloudflareWorkers)
  if (!header) return SHARED_CLIENT_BUCKET
  return headers.get(header)?.split(",")[0]?.trim() || SHARED_CLIENT_BUCKET
}
