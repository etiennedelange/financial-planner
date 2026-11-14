import { NextResponse, type NextRequest } from "next/server"
import { SECURITY_HEADERS, buildCsp } from "@/lib/security/headers"

/**
 * The whole job of proxy.ts now: mint a per-request CSP nonce, forward it to
 * Server Components (layout reads `x-nonce` for next-themes), and stamp the
 * security headers on the response. There is no session handling any more —
 * the app has no accounts.
 */
export function withSecurityHeaders(request: NextRequest): NextResponse {
  const nonce = crypto.randomUUID().replace(/-/g, "")
  const isDevelopment = process.env.NODE_ENV === "development"
  // `upgrade-insecure-requests` forces the browser to retry every request as https,
  // which fails outright on a plain-http origin (e.g. `next start` locally, or a
  // self-hosted deployment without TLS termination), so it is only sent over HTTPS.
  // eval permission is decided by the build mode alone: production over http must
  // not gain 'unsafe-eval'.
  const csp = buildCsp(nonce, {
    allowEval: isDevelopment,
    upgradeInsecureRequests: !isDevelopment && request.nextUrl.protocol === "https:",
  })

  // Set on a Headers copy (request.headers is read-only in Next.js) so x-nonce
  // reaches Server Components, and the same nonce ends up in the CSP response
  // header that Next parses to stamp its own script tags.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
  response.headers.set("Content-Security-Policy", csp)
  return response
}
