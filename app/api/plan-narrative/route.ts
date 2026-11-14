import { createTextStreamResponse, streamText } from "ai"
import { buildPlanNarrativePrompt } from "@/lib/ai/plan-narrative-prompt"
import { planNarrativeRequestSchema } from "@/lib/ai/plan-narrative-schema"
import {
  AI_NOT_CONFIGURED_MESSAGE,
  AI_SIGN_IN_REQUIRED_MESSAGE,
  createLanguageModel,
  describeAiFailure,
  hostedConfigProblem,
  parseUserCredentials,
  resolveHostedCredentials,
  resolveTier,
} from "@/lib/ai/providers"
import { startNarrativeStream } from "@/lib/ai/narrative-stream"
import { clientRateLimitId } from "@/lib/security/client-ip"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** Guards against a client sending an oversized body before it's even parsed as JSON. */
const MAX_BODY_BYTES = 50_000
const RATE_LIMIT_PER_HOUR = 20
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000
/**
 * Caps cost per call. The prompt asks for 3-4 short paragraphs (~400 tokens);
 * the headroom covers Workers AI's gpt-oss models, which spend part of the
 * budget on reasoning before writing.
 */
const MAX_OUTPUT_TOKENS = 2048

/** Logs the kind of failure only — never the error body, URL or credentials. */
function logFailure(stage: string, error: unknown) {
  const name = error instanceof Error ? error.name : typeof error
  const status = (error as { statusCode?: unknown } | null)?.statusCode
  const suffix = typeof status === "number" ? ` (${status})` : ""
  console.error(`[plan-narrative] ${stage} failed: ${name}${suffix}`)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A user's own key (request headers) takes precedence over the server's.
  const userCredentials = parseUserCredentials(request.headers)
  if (!userCredentials.ok) {
    return NextResponse.json({ error: userCredentials.error }, { status: 400 })
  }

  // Sign-in ships disabled by default (NEXT_PUBLIC_AUTH_ENABLED), so requiring
  // a session for everything made the feature unusable on such deployments.
  // A signed-out visitor may use their own key (they pay). The app's key always
  // needs sign-in: the in-memory rate limiter is per instance, so it is no cost
  // boundary for anonymous callers.
  if (!user && !userCredentials.credentials) {
    return NextResponse.json(
      { error: AI_SIGN_IN_REQUIRED_MESSAGE, code: "sign_in_required" },
      { status: 401 },
    )
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0")
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 })
  }

  const rateLimitKey = user
    ? `plan-narrative:${user.id}`
    : `plan-narrative:ip:${clientRateLimitId(request.headers)}`
  const { allowed } = checkRateLimit(rateLimitKey, RATE_LIMIT_PER_HOUR, RATE_LIMIT_WINDOW_MS)
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
    return NextResponse.json(
      { error: "Invalid request body", issues: parsed.error.issues },
      { status: 400 },
    )
  }

  const credentials = userCredentials.credentials ?? resolveHostedCredentials(process.env)
  if (!credentials) {
    const problem = hostedConfigProblem(process.env)
    if (problem) console.error(`[plan-narrative] ${problem}`)
    return NextResponse.json(
      { error: AI_NOT_CONFIGURED_MESSAGE, code: "ai_not_configured" },
      { status: 503 },
    )
  }

  const { tier, ...payload } = parsed.data
  const { system, prompt } = buildPlanNarrativePrompt(payload)

  const result = streamText({
    model: createLanguageModel(credentials, resolveTier(tier, credentials.source)),
    system,
    prompt,
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: request.signal,
  })

  const started = await startNarrativeStream(result.stream, (error) => logFailure("stream", error))
  if (!started.ok) {
    logFailure("generation", started.error)
    const failure = describeAiFailure(started.error, credentials.source)
    return NextResponse.json({ error: failure.message }, { status: failure.status })
  }

  return createTextStreamResponse({ stream: started.stream })
}
