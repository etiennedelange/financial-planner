import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { SECURITY_HEADERS, buildCsp } from "@/lib/security/headers"

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, "")
  // Also true whenever the request itself isn't HTTPS (e.g. `next start`
  // locally, or a self-hosted deployment without TLS termination in front) —
  // `upgrade-insecure-requests` in the CSP forces the browser to retry every
  // request as https, which fails outright there instead of just staying http.
  const isDev = process.env.NODE_ENV === "development" || request.nextUrl.protocol !== "https:"

  // Set on a Headers copy (not `request.headers` directly, which Next.js
  // treats as read-only) so both `NextResponse.next({ request })` calls below
  // forward x-nonce to Server Components — and so the same nonce value ends
  // up in the CSP response header Next parses to stamp its own script tags.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)

  function applySecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    response.headers.set(
      "Content-Security-Policy",
      buildCsp(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", isDev),
    )
    return response
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return applySecurityHeaders(supabaseResponse)
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        )
        // Forward cache-control headers (Cache-Control, Expires, Pragma) so
        // CDNs don't cache auth responses and leak sessions to other users.
        Object.entries(headers).forEach(([key, value]) =>
          supabaseResponse.headers.set(key, value)
        )
      },
    },
  })

  // getUser() verifies the token server-side on every request.
  // Do NOT replace with getSession() — it trusts the cookie unverified.
  const { data: { user } } = await supabase.auth.getUser()

  // UX only. The real enforcement is public.mfa_satisfied() in RLS — a client that
  // ignores this redirect and calls PostgREST directly still gets zero rows.
  if (user) {
    // Called with no argument, getAuthenticatorAssuranceLevel() computes nextLevel
    // from the session's own cached user.factors (the snapshot cookie-stored at
    // sign-in/last refresh) — it does NOT re-check the server, so it never notices
    // a factor an admin action removed since then (verified against the installed
    // @supabase/auth-js source and confirmed live: account recovery deletes the
    // factor via the Admin API, and this form of the call kept reporting aal2 as
    // available afterward). Passing the access token forces its other code path,
    // which calls getUser(jwt) — a live request — instead.
    const { data: { session } } = await supabase.auth.getSession()
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session?.access_token)
    const needsSecondFactor = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2"
    const path = request.nextUrl.pathname
    // /api/auth/recover is the aal1 recovery-code redemption route — it must stay
    // reachable while the user is still gated, or the gate below would redirect the
    // fetch() call itself to /auth/mfa instead of letting the route handler run.
    const isMfaExempt = path.startsWith("/auth/") || path === "/api/auth/recover"

    if (needsSecondFactor && !isMfaExempt) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/mfa"
      url.search = ""
      return applySecurityHeaders(NextResponse.redirect(url))
    }
    if (!needsSecondFactor && path === "/auth/mfa") {
      const url = request.nextUrl.clone()
      url.pathname = "/calculator"
      url.search = ""
      return applySecurityHeaders(NextResponse.redirect(url))
    }
  }

  return applySecurityHeaders(supabaseResponse)
}
