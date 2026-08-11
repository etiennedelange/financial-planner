import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { normaliseRecoveryCode } from "@/lib/auth/recovery-codes"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { NextResponse } from "next/server"

const MAX_CODE_LENGTH = 64
const RATE_LIMIT_PER_HOUR = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

function tooManyRequests() {
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    { status: 429 },
  )
}

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
  const forwardedFor = request.headers.get("x-forwarded-for")
  const ip = forwardedFor ? forwardedFor.split(",")[0].trim() : "unknown"
  const ipLimit = checkRateLimit(`recover:ip:${ip}`, RATE_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS)
  if (!ipLimit.allowed) {
    return tooManyRequests()
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > 1_000) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  // content-length is client-supplied and trivially spoofed (or absent under
  // chunked encoding), so the real cap is the actual body read here — never
  // trust the header for the size decision.
  const rawBody = await request.text()
  if (rawBody.length > 1_000) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const { code } = body as { code?: unknown }
  if (typeof code !== "string" || code.length === 0 || code.length > MAX_CODE_LENGTH) {
    return NextResponse.json({ error: "A recovery code is required" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const userLimit = checkRateLimit(`recover:user:${user.id}`, RATE_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS)
  if (!userLimit.allowed) {
    return tooManyRequests()
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
