import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * Self-serve account deletion. POPIA gives users a right to erasure, and this is
 * the path that honours it.
 *
 * Row deletion happens by cascade: auth.users -> scenarios -> accounts, and
 * auth.users -> expense_groups -> expenses (migration 20260802000000).
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // If a second factor is enrolled, deletion requires it. Otherwise a stolen
  // password could destroy the account that 2FA exists to protect.
  //
  // Called with no argument, getAuthenticatorAssuranceLevel() reads the session's
  // cached user.factors snapshot rather than re-checking the server (see
  // lib/supabase/proxy.ts). Passing the access token forces the live getUser(jwt)
  // path instead — required here since a stale snapshot could wrongly let a
  // caller who just removed their factor skip the AAL2 gate.
  const { data: { session } } = await supabase.auth.getSession()
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(session?.access_token)
  if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Two-factor verification required" }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Server not configured for deletion" }, { status: 500 })
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.auth.signOut({ scope: "global" })
  return NextResponse.json({ deleted: true })
}
