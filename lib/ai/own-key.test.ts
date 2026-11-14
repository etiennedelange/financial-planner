import { describe, it, expect } from "vite-plus/test"
import {
  DEFAULT_AI_KEY_SETTINGS,
  aiSourceKey,
  buildAiRequestHeaders,
  buildNarrativeRequest,
  maskSecret,
  ownKeyProblem,
  usesOwnKey,
  type AiKeySettings,
} from "./own-key"

const ACCOUNT = "0123456789abcdef0123456789abcdef"

const gatewayOwn: AiKeySettings = {
  ...DEFAULT_AI_KEY_SETTINGS,
  mode: "own",
  provider: "gateway",
  gatewayApiKey: " vck_abc12345 ",
}

const cloudflareOwn: AiKeySettings = {
  ...DEFAULT_AI_KEY_SETTINGS,
  mode: "own",
  provider: "cloudflare",
  cloudflareAccountId: ACCOUNT,
  cloudflareApiToken: "cf-token-123",
}

describe("ownKeyProblem", () => {
  it("accepts complete gateway and Cloudflare settings", () => {
    expect(ownKeyProblem(gatewayOwn)).toBeNull()
    expect(ownKeyProblem(cloudflareOwn)).toBeNull()
  })

  it("flags a missing or malformed key", () => {
    expect(ownKeyProblem({ ...gatewayOwn, gatewayApiKey: "  " })).toBe("missing-key")
    expect(ownKeyProblem({ ...gatewayOwn, gatewayApiKey: "two words" })).toBe("invalid-key")
  })

  it("checks the key belonging to the selected provider only", () => {
    // A gateway key does not make a Cloudflare setup usable.
    expect(
      ownKeyProblem({ ...cloudflareOwn, cloudflareApiToken: "", gatewayApiKey: "vck_abc12345" }),
    ).toBe("missing-key")
  })

  it("flags a missing or malformed Cloudflare account ID", () => {
    expect(ownKeyProblem({ ...cloudflareOwn, cloudflareAccountId: "" })).toBe("missing-account")
    expect(ownKeyProblem({ ...cloudflareOwn, cloudflareAccountId: "abc" })).toBe("invalid-account")
  })
})

describe("usesOwnKey", () => {
  it("is false in hosted mode even with a stored key", () => {
    expect(usesOwnKey({ ...gatewayOwn, mode: "hosted" })).toBe(false)
  })

  it("is true only when own-key mode is complete", () => {
    expect(usesOwnKey(gatewayOwn)).toBe(true)
    expect(usesOwnKey({ ...gatewayOwn, gatewayApiKey: "" })).toBe(false)
  })
})

describe("buildAiRequestHeaders", () => {
  it("sends nothing in hosted mode", () => {
    expect(buildAiRequestHeaders({ ...gatewayOwn, mode: "hosted" })).toEqual({})
  })

  it("sends the trimmed gateway key", () => {
    expect(buildAiRequestHeaders(gatewayOwn)).toEqual({
      "x-ai-provider": "gateway",
      "x-ai-api-key": "vck_abc12345",
    })
  })

  it("sends the Cloudflare token and account ID, never the gateway key", () => {
    expect(buildAiRequestHeaders({ ...cloudflareOwn, gatewayApiKey: "vck_other" })).toEqual({
      "x-ai-provider": "cloudflare",
      "x-ai-api-key": "cf-token-123",
      "x-ai-account-id": ACCOUNT,
    })
  })
})

describe("buildNarrativeRequest", () => {
  const payload = { accounts: [] }

  it("refuses an incomplete own-key setup instead of using the hosted provider", () => {
    const result = buildNarrativeRequest(payload, "best", { ...gatewayOwn, gatewayApiKey: "" })
    expect(result).toEqual({
      ok: false,
      error: "Enter your API key. Update your AI key in Settings.",
    })
  })

  it("hosted requests always send the default tier, whatever was picked", () => {
    const result = buildNarrativeRequest(payload, "best", DEFAULT_AI_KEY_SETTINGS)
    expect(result.ok && JSON.parse(result.body).tier).toBe("balanced")
    expect(result.ok && result.headers).toEqual({})
  })

  it("own-key requests send the picked tier and the key headers", () => {
    const result = buildNarrativeRequest(payload, "best", gatewayOwn)
    expect(result.ok && JSON.parse(result.body)).toEqual({ accounts: [], tier: "best" })
    expect(result.ok && result.headers["x-ai-provider"]).toBe("gateway")
  })

  it("cache keys differ by source and never contain the secret", () => {
    const hosted = buildNarrativeRequest(payload, "balanced", DEFAULT_AI_KEY_SETTINGS)
    const own = buildNarrativeRequest(payload, "balanced", gatewayOwn)
    const cf = buildNarrativeRequest(payload, "balanced", cloudflareOwn)
    if (!hosted.ok || !own.ok || !cf.ok) throw new Error("expected ok")
    expect(new Set([hosted.cacheKey, own.cacheKey, cf.cacheKey]).size).toBe(3)
    expect(own.cacheKey).not.toContain("vck_abc12345")
    expect(cf.cacheKey).not.toContain("cf-token-123")
    expect(own.body).not.toContain("vck_abc12345")
  })
})

describe("aiSourceKey", () => {
  it("names the source without the secret", () => {
    expect(aiSourceKey(DEFAULT_AI_KEY_SETTINGS)).toBe("hosted")
    expect(aiSourceKey(gatewayOwn)).toBe("own:gateway")
    expect(aiSourceKey(cloudflareOwn)).toBe("own:cloudflare")
  })
})

describe("maskSecret", () => {
  it("shows only the last four characters", () => {
    expect(maskSecret("vck_abc12345")).toBe("••••2345")
  })

  it("hides very short values entirely", () => {
    expect(maskSecret("abc")).toBe("••••")
    expect(maskSecret("")).toBe("••••")
  })
})
