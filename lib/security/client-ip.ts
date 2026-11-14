type Env = Record<string, string | undefined>

/**
 * Best-effort client IP for rate limiting signed-out callers. Uses the header
 * the hosting platform itself sets, so a client can't pick its own bucket:
 * - Vercel sets `x-real-ip` (and overwrites any client-sent value).
 * - Cloudflare sets `cf-connecting-ip` (likewise overwritten at the edge).
 * Anywhere else falls back to the first `x-forwarded-for` hop, which is only
 * as trustworthy as the proxy in front of the app. Like the in-memory limiter
 * it feeds, this raises the cost of abuse; it is not a hard guarantee.
 */
export function clientIp(headers: Headers, env: Env = process.env): string {
  const pick = (name: string) => headers.get(name)?.split(",")[0]?.trim() || undefined
  if (env.VERCEL) return pick("x-real-ip") ?? pick("x-forwarded-for") ?? "unknown"
  return pick("cf-connecting-ip") ?? pick("x-real-ip") ?? pick("x-forwarded-for") ?? "unknown"
}
