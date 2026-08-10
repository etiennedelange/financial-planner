/**
 * Best-effort in-memory fixed-window rate limiter.
 *
 * Not durable across restarts or shared across serverless instances — for a
 * real multi-instance deployment this needs a shared store (e.g. Upstash
 * Redis). It still meaningfully raises the cost of abuse from a single warm
 * instance/IP in the meantime, which is what AUTH-003/AUTH-005 need today.
 */
const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return { allowed: true, remaining: limit - 1, resetAt }
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt }
  }

  existing.count += 1
  return { allowed: true, remaining: limit - existing.count, resetAt: existing.resetAt }
}
