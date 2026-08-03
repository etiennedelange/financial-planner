import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
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
      return NextResponse.redirect(url)
    }
    if (!needsSecondFactor && path === "/auth/mfa") {
      const url = request.nextUrl.clone()
      url.pathname = "/calculator"
      url.search = ""
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
