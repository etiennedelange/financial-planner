import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test"
import { MODEL_TIERS } from "@/lib/ai/model-tiers"

const getUser = vi.fn()
const streamText = vi.fn()

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}))

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()
  return { ...actual, streamText: (...args: unknown[]) => streamText(...args) }
})

import { POST } from "./route"

const ACCOUNT = "0123456789abcdef0123456789abcdef"
const AI_ENV = [
  "AI_PROVIDER",
  "AI_GATEWAY_API_KEY",
  "VERCEL_OIDC_TOKEN",
  "CLOUDFLARE_AI_ACCOUNT_ID",
  "CLOUDFLARE_AI_API_TOKEN",
  "AI_HOSTED_GUEST_ACCESS",
  "VERCEL",
] as const

function validBody(extra: Record<string, unknown> = {}) {
  return {
    accounts: [
      {
        type: "tfsa",
        currentBalance: 10000,
        monthlyContribution: 500,
        expectedReturn: 10,
        annualFees: 1,
      },
    ],
    personalInfo: { currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualIncome: 500000 },
    retirementGoals: { desiredMonthlyIncome: 20000, inflationRate: 5.5, legacyAmount: 0 },
    drawdownConfig: {
      strategy: "fixed_percentage",
      initialWithdrawalRate: 4,
      minimumWithdrawal: 0,
      maximumWithdrawal: 100000,
      lumpSumPercentage: 0,
    },
    projection: {
      portfolioAtRetirement: 1000000,
      monthlyIncomeAtRetirement: 4000,
      monthlyNetIncomeAtRetirement: 3800,
      portfolioDepletionAge: null,
    },
    ...extra,
  }
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/plan-narrative", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

async function* textParts(...chunks: string[]) {
  yield { type: "start" }
  for (const text of chunks) yield { type: "text-delta", id: "t", text }
  yield { type: "finish" }
}

async function* errorParts(error: unknown) {
  yield { type: "start" }
  yield { type: "error", error }
}

/** The `model` object streamText was last called with. */
function lastModel() {
  return streamText.mock.calls.at(-1)?.[0].model as { modelId: string; provider: string }
}

let userCounter = 0
const savedEnv: Partial<Record<string, string | undefined>> = {}

beforeEach(() => {
  vi.clearAllMocks()
  // A fresh user per test keeps the in-memory rate limiter from carrying over.
  userCounter += 1
  getUser.mockResolvedValue({ data: { user: { id: `user-${userCounter}` } } })
  streamText.mockImplementation(() => ({ stream: textParts("Your plan ", "looks steady.") }))
  for (const name of AI_ENV) {
    savedEnv[name] = process.env[name]
    delete process.env[name]
  }
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  for (const name of AI_ENV) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
  vi.restoreAllMocks()
})

describe("POST /api/plan-narrative", () => {
  describe("signed-out visitors", () => {
    beforeEach(() => {
      getUser.mockResolvedValue({ data: { user: null } })
      process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    })

    it("may not spend the app's key by default, and are told how to proceed", async () => {
      const response = await POST(request(validBody()))
      expect(response.status).toBe(401)
      const body = await response.json()
      expect(body.code).toBe("sign_in_required")
      expect(body.error).toMatch(/Sign in.*own API key/)
      expect(streamText).not.toHaveBeenCalled()
    })

    it("may use their own key (regression: sign-in is off by default, so this was always 401)", async () => {
      const response = await POST(
        request(validBody({ tier: "best" }), {
          "x-ai-provider": "gateway",
          "x-ai-api-key": "vck_guest_key_1",
          "x-forwarded-for": "203.0.113.7",
        }),
      )
      expect(response.status).toBe(200)
      expect(lastModel().modelId).toBe(MODEL_TIERS.gateway.best)
    })

    it("may use the app's key when the operator sets AI_HOSTED_GUEST_ACCESS=true", async () => {
      process.env.AI_HOSTED_GUEST_ACCESS = "true"
      const response = await POST(request(validBody({ tier: "best" })))
      expect(response.status).toBe(200)
      // Still the default tier: guests never pick the dearer hosted models.
      expect(lastModel().modelId).toBe(MODEL_TIERS.gateway.balanced)
    })

    it("are rate-limited per IP, separately from each other", async () => {
      process.env.AI_HOSTED_GUEST_ACCESS = "true"
      const from = (ip: string) => request(validBody(), { "x-forwarded-for": ip })
      for (let i = 0; i < 20; i++) expect((await POST(from("198.51.100.1"))).status).toBe(200)
      expect((await POST(from("198.51.100.1"))).status).toBe(429)
      expect((await POST(from("198.51.100.2"))).status).toBe(200)
    })

    it("get a 400, not a sign-in prompt, for a malformed own key", async () => {
      const response = await POST(
        request(validBody(), { "x-ai-provider": "gateway", "x-ai-api-key": "bad" }),
      )
      expect(response.status).toBe(400)
    })
  })

  it("returns 503 with a pointer to Settings when no provider is configured and no key is sent", async () => {
    const response = await POST(request(validBody()))
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.code).toBe("ai_not_configured")
    expect(body.error).toMatch(/Settings/)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("streams the hosted gateway model at the default tier, ignoring a requested tier", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    const response = await POST(request(validBody({ tier: "best" })))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe("Your plan looks steady.")
    expect(lastModel().modelId).toBe(MODEL_TIERS.gateway.balanced)
  })

  it("streams the hosted Workers AI model when Cloudflare is configured", async () => {
    process.env.CLOUDFLARE_AI_ACCOUNT_ID = ACCOUNT
    process.env.CLOUDFLARE_AI_API_TOKEN = "cf-hosted-token"
    const response = await POST(request(validBody()))
    expect(response.status).toBe(200)
    expect(lastModel().modelId).toBe(MODEL_TIERS.cloudflare.balanced)
    expect(lastModel().provider).toContain("workers-ai")
  })

  it("uses the user's own key over the hosted provider, at the tier they picked", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    const response = await POST(
      request(validBody({ tier: "fast" }), {
        "x-ai-provider": "cloudflare",
        "x-ai-api-key": "cf-user-token",
        "x-ai-account-id": ACCOUNT,
      }),
    )
    expect(response.status).toBe(200)
    expect(lastModel().modelId).toBe(MODEL_TIERS.cloudflare.fast)
  })

  it("works with an own key even when the server has no provider at all", async () => {
    const response = await POST(
      request(validBody({ tier: "best" }), {
        "x-ai-provider": "gateway",
        "x-ai-api-key": "vck_user_key_1",
      }),
    )
    expect(response.status).toBe(200)
    expect(lastModel().modelId).toBe(MODEL_TIERS.gateway.best)
  })

  it("rejects a malformed own key with 400 instead of falling back to the hosted provider", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    const response = await POST(
      request(validBody(), { "x-ai-provider": "cloudflare", "x-ai-api-key": "cf-user-token" }),
    )
    expect(response.status).toBe(400)
    expect((await response.json()).error).toMatch(/account ID/)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("turns a rejected own key into a 401 with a clear message", async () => {
    streamText.mockImplementation(() => ({
      stream: errorParts(Object.assign(new Error("Unauthorized"), { statusCode: 401 })),
    }))
    const response = await POST(
      request(validBody(), { "x-ai-provider": "gateway", "x-ai-api-key": "vck_wrong_key" }),
    )
    expect(response.status).toBe(401)
    expect((await response.json()).error).toMatch(/rejected your API key/)
  })

  it("never logs the user's key or the provider's error body", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    streamText.mockImplementation(() => ({
      stream: errorParts(
        Object.assign(new Error("bad key vck_secret_value"), {
          statusCode: 401,
          responseBody: "secret",
        }),
      ),
    }))
    await POST(
      request(validBody(), { "x-ai-provider": "gateway", "x-ai-api-key": "vck_secret_value" }),
    )
    const logged = errorSpy.mock.calls.flat().join(" ")
    expect(logged).toContain("401")
    expect(logged).not.toContain("vck_secret_value")
    expect(logged).not.toContain("secret")
  })

  it("returns 502 when the model produces no text", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    streamText.mockImplementation(() => ({ stream: textParts() }))
    const response = await POST(request(validBody()))
    expect(response.status).toBe(502)
  })

  it("caps output tokens and forwards the request's abort signal", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    const req = request(validBody())
    await POST(req)
    const options = streamText.mock.calls[0][0]
    expect(options.maxOutputTokens).toBeGreaterThan(0)
    expect(options.abortSignal).toBe(req.signal)
  })

  it("rejects an invalid body before resolving credentials", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    const response = await POST(request({ nope: true }))
    expect(response.status).toBe(400)
    expect(streamText).not.toHaveBeenCalled()
  })

  it("rejects an oversized body", async () => {
    const big = new Request("http://localhost/api/plan-narrative", {
      method: "POST",
      body: "x".repeat(50_001),
    })
    const response = await POST(big)
    expect(response.status).toBe(413)
  })

  it("rejects malformed JSON", async () => {
    const bad = new Request("http://localhost/api/plan-narrative", { method: "POST", body: "{" })
    const response = await POST(bad)
    expect(response.status).toBe(400)
  })

  it("rate-limits a user after 20 requests in an hour", async () => {
    process.env.AI_GATEWAY_API_KEY = "gw-hosted-key"
    for (let i = 0; i < 20; i++) {
      expect((await POST(request(validBody()))).status).toBe(200)
    }
    expect((await POST(request(validBody()))).status).toBe(429)
  })
})
