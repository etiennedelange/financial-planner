export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}

/**
 * Per-request CSP. The nonce must be generated per request and threaded into
 * Next's script tags — a static nonce is no better than 'unsafe-inline'.
 *
 * style-src keeps 'unsafe-inline': Next.js and Tailwind both emit inline styles,
 * and there is no nonce hook for them. Inline styles are a materially smaller
 * risk than inline scripts.
 */
export function buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string {
  // CSP path matching in a source expression is a directory prefix only when
  // the path ends in "/" — without it, "/supabase" matches just that exact
  // path, not "/supabase/auth/v1/user". This was masked whenever the app and
  // Supabase proxy shared an origin (connect-src 'self' covered everything
  // regardless of path); it only bites once they're on different ports/hosts.
  const connectSupabaseUrl = supabaseUrl && !supabaseUrl.endsWith("/") ? `${supabaseUrl}/` : supabaseUrl

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://challenges.cloudflare.com",
    // React Fast Refresh compiles with eval in development only.
    isDev ? "'unsafe-eval'" : "",
  ].filter(Boolean).join(" ")

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    // data: covers the TOTP enrolment QR code, which is an inline SVG data URI.
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${connectSupabaseUrl} https://vitals.vercel-insights.com`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    // Forcing an http:// → https:// upgrade breaks local dev, which serves
    // plain HTTP — background Next.js route prefetches fail outright
    // (ERR_SSL_PROTOCOL_ERROR) instead of just staying on http.
    isDev ? "" : `upgrade-insecure-requests`,
  ].filter(Boolean).join("; ")
}
