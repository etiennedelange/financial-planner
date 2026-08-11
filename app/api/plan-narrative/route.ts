import { streamText } from "ai"
import { buildPlanNarrativePrompt } from "@/lib/ai/plan-narrative-prompt"
import { MODEL_TIERS, DEFAULT_MODEL_TIER } from "@/lib/ai/model-tiers"
import { planNarrativeRequestSchema } from "@/lib/ai/plan-narrative-schema"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** Guards against a client sending an oversized body before it's even parsed as JSON. */
const MAX_BODY_BYTES = 50_000
const RATE_LIMIT_PER_HOUR = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  const { allowed } = checkRateLimit(`plan-narrative:${user.id}`, RATE_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS)
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 })
  }

  // content-length is client-supplied and trivially spoofed (or absent under
  // chunked encoding), so the real cap is the actual body read here — never
  // trust the header for the size decision.
  const rawBody = await request.text()
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = planNarrativeRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 })
  }

  const { tier: _tier, ...payload } = parsed.data
  const { system, prompt } = buildPlanNarrativePrompt(payload)

  // Client-supplied tier is ignored: there is no entitlement system yet to
  // decide who may pick the more expensive models, so every authenticated
  // caller gets the same default until one exists.
  const result = streamText({
    model: MODEL_TIERS[DEFAULT_MODEL_TIER],
    system,
    prompt,
  })

  return result.toTextStreamResponse()
}
