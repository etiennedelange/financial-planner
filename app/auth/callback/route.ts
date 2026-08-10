import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"
import { safeNext } from "@/lib/auth/safe-redirect"

/**
 * Handles every email-link return path: signup confirmation, email change,
 * magic link and password recovery.
 *
 * Supabase sends one of two shapes depending on the email template:
 *   - PKCE:   ?code=<uuid>
 *   - OTP:    ?token_hash=<hash>&type=<recovery|signup|email_change|...>
 * Both are handled — which one arrives is a template setting, not a code path
 * the app controls.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNext(searchParams.get("next"), origin)

  const supabase = await createClient()
  let failed = true
  let isRecovery = false

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
    // `exchangeCodeForSession`'s type doesn't declare `redirectType`, but the
    // runtime response does include it (verified against the installed
    // @supabase/auth-js source) — a known gap between this package's public
    // types and its actual, documented behavior.
    isRecovery = (data as { redirectType?: string } | null)?.redirectType === "recovery"
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    failed = Boolean(error)
    isRecovery = type === "recovery"
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/calculator?error=auth`)
  }

  // A recovery link grants a session, which is exactly why it must not drop the
  // user into the app. Without this branch the reset link IS the login.
  //
  // isRecovery must come from Supabase's own signal, not the URL's `type` param:
  // on the `code` path, `type` is metadata this app itself appended via
  // redirectTo, so it's fully client-editable and proves nothing — a request
  // could hit this route with a valid `code` but no `type=recovery` and would
  // otherwise fall through to `next`. `redirectType` is tagged server-side on
  // the stored PKCE code-verifier when resetPasswordForEmail() starts the flow,
  // and returned by exchangeCodeForSession() — tamper-resistant. The OTP path
  // doesn't have this problem: `type` there is a required, verified input to
  // verifyOtp itself, so a stripped/wrong type just fails verification rather
  // than silently taking the wrong branch.
  if (isRecovery) {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
