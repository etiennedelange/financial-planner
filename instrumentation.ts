/**
 * AUTH-007: a missing `NEXT_PUBLIC_TURNSTILE_SITE_KEY` makes
 * `components/auth/turnstile.tsx` silently render nothing, which every auth
 * form (sign-in, sign-up, reset, reauthentication) then blocks on forever —
 * a deployment can go live with authentication completely unusable and no
 * error anywhere. Cloudflare's published always-pass test key
 * (`1x00000000000000000000AA`) has the same effect in production: forms
 * "work" but bot protection is off.
 *
 * This runs once at server startup (Next.js instrumentation hook) so a
 * misconfigured production deploy fails immediately and loudly instead of
 * shipping a silently broken or silently unprotected auth surface.
 */
const TURNSTILE_TEST_SITE_KEYS = new Set([
  "1x00000000000000000000AA",
  "2x00000000000000000000AB",
  "3x00000000000000000000FF",
])

export function register() {
  if (process.env.NODE_ENV !== "production") return
  if (process.env.NEXT_RUNTIME !== "nodejs") return

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const secretKey = process.env.TURNSTILE_SECRET_KEY

  if (!siteKey || !secretKey) {
    throw new Error(
      "AUTH-007: NEXT_PUBLIC_TURNSTILE_SITE_KEY and TURNSTILE_SECRET_KEY must both be set in " +
        "production — without them every auth form (sign-in, sign-up, reset, reauthentication) " +
        "silently stops working.",
    )
  }

  if (TURNSTILE_TEST_SITE_KEYS.has(siteKey)) {
    throw new Error(
      "AUTH-007: NEXT_PUBLIC_TURNSTILE_SITE_KEY is set to Cloudflare's published always-pass " +
        "test key. Auth forms would render and submit, but bot protection would be off, in " +
        "production.",
    )
  }
}
