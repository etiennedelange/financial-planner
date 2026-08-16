/**
 * Resolve the canonical site URL for metadata, sitemap and robots.
 *
 * Vercel injects `VERCEL_PROJECT_PRODUCTION_URL` WITHOUT a scheme (e.g.
 * "my-app.vercel.app"), which `new URL()` rejects with ERR_INVALID_URL —
 * this crashed the production build in app/layout.tsx until normalized
 * here. Prefer an explicit NEXT_PUBLIC_SITE_URL, fall back to the Vercel
 * project URL, then a localhost default, and always return an absolute URL.
 */
export function resolveSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    "http://localhost:3000"

  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
}
