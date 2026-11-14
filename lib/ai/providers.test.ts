import { describe, it, expect } from "vite-plus/test"
import {
  cloudflareBaseUrl,
  createLanguageModel,
  describeAiFailure,
  hostedGuestAccessAllowed,
  modelIdFor,
  parseUserCredentials,
  resolveHostedCredentials,
  resolveTier,
} from "./providers"
import { MODEL_TIERS } from "./model-tiers"

const ACCOUNT = "0123456789abcdef0123456789abcdef"

function headers(entries: Record<string, string>) {
  return new Headers(entries)
}

describe("resolveHostedCredentials", () => {
  it("returns null when nothing is configured", () => {
    expect(resolveHostedCredentials({})).toBeNull()
  })

  it("uses the AI Gateway key when set", () => {
    expect(resolveHostedCredentials({ AI_GATEWAY_API_KEY: "gw-key-123" })).toEqual({
      source: "hosted",
      provider: "gateway",
      apiKey: "gw-key-123",
    })
  })

  it("uses Workers AI when only Cloudflare credentials are set", () => {
    expect(
      resolveHostedCredentials({
        CLOUDFLARE_AI_ACCOUNT_ID: ACCOUNT,
        CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
      }),
    ).toEqual({
      source: "hosted",
      provider: "cloudflare",
      accountId: ACCOUNT,
      apiToken: "cf-token-123",
    })
  })

  it("does not pick up wrangler's deploy token as the AI token", () => {
    expect(
      resolveHostedCredentials({ CLOUDFLARE_ACCOUNT_ID: ACCOUNT, CLOUDFLARE_API_TOKEN: "deploy" }),
    ).toBeNull()
  })

  it("ignores a malformed Cloudflare account ID rather than building a bad URL", () => {
    expect(
      resolveHostedCredentials({
        CLOUDFLARE_AI_ACCOUNT_ID: "../../evil",
        CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
      }),
    ).toBeNull()
  })

  it("prefers the gateway key over Cloudflare when both are set and AI_PROVIDER is unset", () => {
    const creds = resolveHostedCredentials({
      AI_GATEWAY_API_KEY: "gw-key-123",
      CLOUDFLARE_AI_ACCOUNT_ID: ACCOUNT,
      CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
    })
    expect(creds?.provider).toBe("gateway")
  })

  it("prefers Cloudflare credentials over Vercel's implicit OIDC token", () => {
    const creds = resolveHostedCredentials({
      VERCEL_OIDC_TOKEN: "oidc",
      CLOUDFLARE_AI_ACCOUNT_ID: ACCOUNT,
      CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
    })
    expect(creds?.provider).toBe("cloudflare")
  })

  it("falls back to Vercel OIDC with no explicit key (the provider reads the token itself)", () => {
    expect(resolveHostedCredentials({ VERCEL_OIDC_TOKEN: "oidc" })).toEqual({
      source: "hosted",
      provider: "gateway",
      apiKey: undefined,
    })
  })

  it("honours AI_PROVIDER=cloudflare even when a gateway key exists", () => {
    const creds = resolveHostedCredentials({
      AI_PROVIDER: "Cloudflare",
      AI_GATEWAY_API_KEY: "gw-key-123",
      CLOUDFLARE_AI_ACCOUNT_ID: ACCOUNT,
      CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
    })
    expect(creds?.provider).toBe("cloudflare")
  })

  it("returns null for an explicit provider whose credentials are missing", () => {
    expect(
      resolveHostedCredentials({ AI_PROVIDER: "cloudflare", AI_GATEWAY_API_KEY: "gw-key-123" }),
    ).toBeNull()
    expect(
      resolveHostedCredentials({
        AI_PROVIDER: "gateway",
        CLOUDFLARE_AI_ACCOUNT_ID: ACCOUNT,
        CLOUDFLARE_AI_API_TOKEN: "cf-token-123",
      }),
    ).toBeNull()
  })

  it("AI_PROVIDER=none disables the hosted provider", () => {
    expect(
      resolveHostedCredentials({ AI_PROVIDER: "none", AI_GATEWAY_API_KEY: "gw-key-123" }),
    ).toBeNull()
  })

  it("treats whitespace-only values as unset", () => {
    expect(resolveHostedCredentials({ AI_GATEWAY_API_KEY: "   " })).toBeNull()
  })
})

describe("parseUserCredentials", () => {
  it("no provider header means use the hosted provider", () => {
    expect(parseUserCredentials(headers({}))).toEqual({ ok: true, credentials: null })
  })

  it("accepts a gateway key", () => {
    expect(
      parseUserCredentials(headers({ "x-ai-provider": "gateway", "x-ai-api-key": "vck_abc12345" })),
    ).toEqual({
      ok: true,
      credentials: { source: "user", provider: "gateway", apiKey: "vck_abc12345" },
    })
  })

  it("accepts Cloudflare credentials", () => {
    expect(
      parseUserCredentials(
        headers({
          "x-ai-provider": "cloudflare",
          "x-ai-api-key": "cf-token-123",
          "x-ai-account-id": ACCOUNT.toUpperCase(),
        }),
      ),
    ).toEqual({
      ok: true,
      credentials: {
        source: "user",
        provider: "cloudflare",
        accountId: ACCOUNT.toUpperCase(),
        apiToken: "cf-token-123",
      },
    })
  })

  it("rejects an unknown provider", () => {
    const result = parseUserCredentials(
      headers({ "x-ai-provider": "openai", "x-ai-api-key": "k".repeat(10) }),
    )
    expect(result.ok).toBe(false)
  })

  it("rejects a provider header with no key instead of falling back to the hosted bill", () => {
    const result = parseUserCredentials(headers({ "x-ai-provider": "gateway" }))
    expect(result).toEqual({
      ok: false,
      error: "Your API key is missing or not in a valid format.",
    })
  })

  it("rejects keys that are too short, too long or contain spaces", () => {
    for (const key of ["short", "k".repeat(513), "has a space"]) {
      const result = parseUserCredentials(
        headers({ "x-ai-provider": "gateway", "x-ai-api-key": key }),
      )
      expect(result.ok).toBe(false)
    }
  })

  it("rejects a Cloudflare account ID that is not 32 hex characters", () => {
    for (const id of ["", "abc", `${ACCOUNT.slice(0, 31)}g`, `${ACCOUNT}/../x`]) {
      const result = parseUserCredentials(
        headers({
          "x-ai-provider": "cloudflare",
          "x-ai-api-key": "cf-token-123",
          "x-ai-account-id": id,
        }),
      )
      expect(result.ok).toBe(false)
    }
  })
})

describe("hostedGuestAccessAllowed", () => {
  it("is off unless explicitly set to true", () => {
    expect(hostedGuestAccessAllowed({})).toBe(false)
    expect(hostedGuestAccessAllowed({ AI_HOSTED_GUEST_ACCESS: "1" })).toBe(false)
    expect(hostedGuestAccessAllowed({ AI_HOSTED_GUEST_ACCESS: "false" })).toBe(false)
    expect(hostedGuestAccessAllowed({ AI_HOSTED_GUEST_ACCESS: " TRUE " })).toBe(true)
  })
})

describe("resolveTier", () => {
  it("hosted callers always get the default tier", () => {
    expect(resolveTier("best", "hosted")).toBe("balanced")
    expect(resolveTier("fast", "hosted")).toBe("balanced")
    expect(resolveTier(undefined, "hosted")).toBe("balanced")
  })

  it("own-key callers get the tier they asked for", () => {
    expect(resolveTier("best", "user")).toBe("best")
    expect(resolveTier("fast", "user")).toBe("fast")
    expect(resolveTier(undefined, "user")).toBe("balanced")
  })
})

describe("model mapping", () => {
  it("maps every tier to a model for every provider", () => {
    for (const provider of ["gateway", "cloudflare"] as const) {
      for (const tier of ["fast", "balanced", "best"] as const) {
        expect(modelIdFor(provider, tier)).toBe(MODEL_TIERS[provider][tier])
        expect(modelIdFor(provider, tier).length).toBeGreaterThan(0)
      }
    }
  })

  it("uses gateway-style IDs for the gateway and @cf IDs for Workers AI", () => {
    for (const id of Object.values(MODEL_TIERS.gateway)) expect(id).toMatch(/^anthropic\//)
    for (const id of Object.values(MODEL_TIERS.cloudflare)) expect(id).toMatch(/^@cf\//)
  })

  it("builds the Workers AI OpenAI-compatible base URL", () => {
    expect(cloudflareBaseUrl(ACCOUNT)).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/ai/v1`,
    )
  })

  it("creates a gateway model with the tier's ID", () => {
    const model = createLanguageModel(
      { source: "user", provider: "gateway", apiKey: "vck_abc12345" },
      "fast",
    )
    expect(typeof model).not.toBe("string")
    expect((model as { modelId: string }).modelId).toBe(MODEL_TIERS.gateway.fast)
  })

  it("creates a Workers AI model with the tier's ID", () => {
    const model = createLanguageModel(
      { source: "user", provider: "cloudflare", accountId: ACCOUNT, apiToken: "cf-token-123" },
      "best",
    ) as { modelId: string; provider: string }
    expect(model.modelId).toBe(MODEL_TIERS.cloudflare.best)
    expect(model.provider).toContain("workers-ai")
  })
})

describe("describeAiFailure", () => {
  const withStatus = (statusCode: number) => Object.assign(new Error("x"), { statusCode })

  it("tells an own-key user their key was rejected", () => {
    expect(describeAiFailure(withStatus(401), "user")).toEqual({
      status: 401,
      message: "The AI provider rejected your API key. Check it in Settings.",
    })
    expect(describeAiFailure(withStatus(403), "user").status).toBe(401)
  })

  it("does not blame the user for the server's rejected key", () => {
    const failure = describeAiFailure(withStatus(401), "hosted")
    expect(failure.status).toBe(503)
    expect(failure.message).not.toMatch(/your/i)
  })

  it("reports exhausted credit", () => {
    expect(describeAiFailure(withStatus(402), "user").status).toBe(402)
    expect(describeAiFailure(withStatus(402), "hosted").status).toBe(503)
  })

  it("reports rate limiting and unknown models", () => {
    expect(describeAiFailure(withStatus(429), "user").status).toBe(429)
    expect(describeAiFailure(withStatus(404), "hosted").status).toBe(502)
  })

  it("falls back to a generic 502 for anything else", () => {
    expect(describeAiFailure(new Error("boom"), "user").status).toBe(502)
    expect(describeAiFailure("weird", "hosted").status).toBe(502)
    expect(describeAiFailure(null, "hosted").status).toBe(502)
    expect(describeAiFailure(withStatus(500), "user").status).toBe(502)
  })
})
