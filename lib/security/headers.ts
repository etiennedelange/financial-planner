import { PROVIDER_ORIGINS } from "@/lib/ai/providers/origins"

export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}

/** Every origin `fetch` may reach (the test pins the exact set). */
const CONNECT_SRC = [
  "'self'",
  ...Object.values(PROVIDER_ORIGINS),
  "https://vitals.vercel-insights.com",
] as const

/**
 * Per-request CSP. The nonce must be generated per request and threaded into
 * Next's script tags — a static nonce is no better than 'unsafe-inline'.
 *
 * style-src keeps 'unsafe-inline': Next.js and Tailwind both emit inline styles,
 * and there is no nonce hook for them. Inline styles are a materially smaller
 * risk than inline scripts.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // React Fast Refresh compiles with eval in development only.
    isDev ? "'unsafe-eval'" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    // The exfiltration guard for the user's LLM API key: the page may only talk to
    // itself, Vercel's vitals beacon and the three provider APIs the user can pick
    // (bring-your-own-key calls go straight from the browser). No wildcards.
    `connect-src ${CONNECT_SRC.join(" ")}`,
    // Without this, workers fall back to script-src, where 'strict-dynamic' makes browsers
    // ignore 'self' and a worker cannot carry a nonce: the Monte Carlo worker could be
    // refused. blob: covers bundlers that start workers from a blob URL.
    `worker-src 'self' blob:`,
    `frame-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    // Forcing an http:// → https:// upgrade breaks local dev, which serves
    // plain HTTP — background Next.js route prefetches fail outright
    // (ERR_SSL_PROTOCOL_ERROR) instead of just staying on http.
    isDev ? "" : `upgrade-insecure-requests`,
  ]
    .filter(Boolean)
    .join("; ")
}
