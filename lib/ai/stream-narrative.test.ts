import { describe, it, expect, beforeEach, afterEach, vi } from "vite-plus/test"
import { __resetVaultForTests, lock, saveEncrypted, saveSessionOnly } from "./key-vault"
import { MAX_OUTPUT_TOKENS, MODEL_TIERS } from "./model-tiers"
import { PROVIDER_IDS } from "./providers/origins"
import { collect, mockFetch, sseResponse } from "./providers/test-helpers"
import { streamNarrative } from "./stream-narrative"
import type { PlanNarrativePayload } from "./plan-narrative-prompt"

const KEY = "sk-live-SECRET-9876543210"

const payload: PlanNarrativePayload = {
  accounts: [
    {
      type: "retirement_annuity",
      currentBalance: 1_500_000,
      monthlyContribution: 12_000,
      expectedReturn: 11,
      annualFees: 1,
    },
  ],
  personalInfo: { currentAge: 40, retirementAge: 65, lifeExpectancy: 90, annualIncome: 900_000 },
  retirementGoals: { desiredMonthlyIncome: 50_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 100_000,
    lumpSumPercentage: 0,
  },
  projection: {
    portfolioAtRetirement: 9_000_000,
    monthlyIncomeAtRetirement: 45_000,
    monthlyNetIncomeAtRetirement: 38_000,
    portfolioDepletionAge: null,
  },
}

const anthropicOk = () =>
  sseResponse([
    JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Summary." },
    }),
    JSON.stringify({ type: "message_stop" }),
  ])

describe("streamNarrative", () => {
  beforeEach(() => {
    localStorage.clear()
    __resetVaultForTests()
  })
  afterEach(() => vi.restoreAllMocks())

  it("fails with no-key (and makes no request) when nothing is saved", async () => {
    const { calls } = mockFetch(anthropicOk)
    const error = await collect(
      streamNarrative({ provider: "anthropic", tier: "balanced", payload }),
    ).catch((e) => e)
    expect(error.code).toBe("no-key")
    expect(calls).toHaveLength(0)
  })

  it("fails with locked when a remembered key has not been unlocked", async () => {
    await saveEncrypted("anthropic", KEY, "a long enough passphrase")
    lock("anthropic")
    const { calls } = mockFetch(anthropicOk)
    const error = await collect(
      streamNarrative({ provider: "anthropic", tier: "balanced", payload }),
    ).catch((e) => e)
    expect(error.code).toBe("locked")
    expect(calls).toHaveLength(0)
  })

  it("streams with the vault's key, the tier's model and a bounded token budget", async () => {
    saveSessionOnly("anthropic", KEY)
    const { calls } = mockFetch(anthropicOk)
    const text = await collect(streamNarrative({ provider: "anthropic", tier: "fast", payload }))
    expect(text).toBe("Summary.")
    expect(calls[0].headers["x-api-key"]).toBe(KEY)
    expect(calls[0].body.model).toBe(MODEL_TIERS.anthropic.fast)
    expect(calls[0].body.max_tokens).toBe(MAX_OUTPUT_TOKENS)
  })

  it("sends only the prompt-relevant numbers — not income or inflation fields the model never used", async () => {
    saveSessionOnly("anthropic", KEY)
    const { calls } = mockFetch(anthropicOk)
    await collect(streamNarrative({ provider: "anthropic", tier: "balanced", payload }))
    const sent = JSON.stringify(calls[0].body)
    expect(sent).toMatch(/R\s9\s000\s000/) // portfolio at retirement (NBSP separators)
    expect(sent).not.toContain("900000") // annualIncome is not part of the prompt
    expect(sent).not.toContain(KEY)
  })

  it.each(PROVIDER_IDS)("routes %s to its own pinned origin", async (provider) => {
    saveSessionOnly(provider, KEY)
    const { calls } = mockFetch(() => sseResponse(["[DONE]"]))
    await collect(streamNarrative({ provider, tier: "balanced", payload })).catch(() => {})
    expect(calls[0].url.origin).toBe(
      {
        anthropic: "https://api.anthropic.com",
        openai: "https://api.openai.com",
        gemini: "https://generativelanguage.googleapis.com",
      }[provider],
    )
  })

  it("never lets a raw error (which could contain the key) escape — only fixed-message ProviderErrors", async () => {
    saveSessionOnly("anthropic", KEY)
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error(`boom with ${KEY}`))
    const error = await collect(
      streamNarrative({ provider: "anthropic", tier: "balanced", payload }),
    ).catch((e) => e)
    expect(error.name).toBe("ProviderError")
    expect(error.message).not.toContain(KEY)
  })

  it("has a model id for every provider and tier", () => {
    for (const provider of PROVIDER_IDS) {
      for (const tier of ["fast", "balanced", "best"] as const) {
        expect(MODEL_TIERS[provider][tier]).toMatch(/^[A-Za-z0-9._-]+$/)
      }
    }
  })
})
