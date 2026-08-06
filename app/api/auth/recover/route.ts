import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { normaliseRecoveryCode } from "@/lib/auth/recovery-codes"
import { NextResponse } from "next/server"

/**
 * Redeeming a recovery code proves account ownership but cannot produce a
 * real aal2 session — AAL lives in Supabase's own signed JWT, set only by a
 * genuine TOTP challenge/verify, which a Postgres RPC can't touch. So a
 * successful redemption instead removes the lost factor via the Admin API
 * (service-role, bypasses the caller's own AAL entirely). Once no verified
 * factor exists, mfa_satisfied() is naturally true again and RLS unblocks
 * the account without ever forging an AAL claim. The user re-enrols a fresh
 * authenticator from Settings once back in.
 */
export async function POST(request: Request) {
  const { code } = await request.json()
  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json({ error: "A recovery code is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: redeemed, error: redeemError } = await supabase.rpc("redeem_recovery_code", {
    code: normaliseRecoveryCode(code),
  })
  if (redeemError) {
    return NextResponse.json({ error: redeemError.message }, { status: 500 })
  }
  if (!redeemed) {
    return NextResponse.json(
      { error: "That recovery code is not valid, or has already been used." },
      { status: 401 },
    )
  }

  const { data: factors, error: listError } = await supabase.auth.mfa.listFactors()
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Server not configured for account recovery" }, { status: 500 })
  }
  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  for (const factor of factors.totp) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId: user.id,
    })
    if (deleteError) {
      return NextResponse.json(
        { error: "Could not remove your old authenticator. Please try again." },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ recovered: true })
}
