import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

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
  const next = searchParams.get("next") ?? "/calculator"

  const supabase = await createClient()
  let failed = true

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    failed = Boolean(error)
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/calculator?error=auth`)
  }

  // A recovery link grants a session, which is exactly why it must not drop the
  // user into the app. Without this branch the reset link IS the login.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
