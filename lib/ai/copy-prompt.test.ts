import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { buildCopyablePrompt, CHAT_APPS, copyToClipboard } from "./copy-prompt"
import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "./plan-narrative-prompt"

const payload: PlanNarrativePayload = {
  accounts: [
    {
      type: "tfsa",
      currentBalance: 250_000,
      monthlyContribution: 3_000,
      expectedReturn: 11,
      annualFees: 0.8,
    },
  ],
  personalInfo: { currentAge: 38, retirementAge: 65, lifeExpectancy: 90, annualIncome: 750_000 },
  retirementGoals: { desiredMonthlyIncome: 35_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 100_000,
    lumpSumPercentage: 0,
  },
  projection: {
    portfolioAtRetirement: 6_500_000,
    monthlyIncomeAtRetirement: 30_000,
    monthlyNetIncomeAtRetirement: 27_000,
    portfolioDepletionAge: 84,
  },
}

afterEach(() => vi.restoreAllMocks())

describe("buildCopyablePrompt", () => {
  it("contains the exact rules and plan text the in-app modes send", () => {
    const { system, prompt } = buildPlanNarrativePrompt(payload)
    const text = buildCopyablePrompt(payload)
    expect(text).toContain(system)
    expect(text).toContain(prompt)
  })

  it("asks for a plain-English explanation and keeps the no-advice rule", () => {
    const text = buildCopyablePrompt(payload)
    expect(text.startsWith("Please explain my retirement plan in plain English")).toBe(true)
    expect(text).toContain("NEVER use second-person directives")
  })

  it("only contains numbers the prompt uses — not income or inflation the model never needed", () => {
    const text = buildCopyablePrompt(payload)
    expect(text).not.toContain("750000")
    expect(text).not.toMatch(/750\s000/)
  })

  it("is deterministic", () => {
    expect(buildCopyablePrompt(payload)).toBe(buildCopyablePrompt(payload))
  })
})

describe("chat app links", () => {
  it("are plain https links with no query string, so no plan data can end up in a URL", () => {
    expect(CHAT_APPS.length).toBeGreaterThan(0)
    for (const app of CHAT_APPS) {
      const url = new URL(app.href)
      expect(url.protocol).toBe("https:")
      expect(url.search).toBe("")
      expect(url.hash).toBe("")
    }
  })
})

describe("copyToClipboard", () => {
  it("writes the text and reports success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    expect(await copyToClipboard("hello")).toBe(true)
    expect(writeText).toHaveBeenCalledWith("hello")
    vi.unstubAllGlobals()
  })

  it("reports failure (instead of throwing) when the browser refuses", async () => {
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    })
    expect(await copyToClipboard("x")).toBe(false)
    vi.stubGlobal("navigator", {})
    expect(await copyToClipboard("x")).toBe(false)
    vi.unstubAllGlobals()
  })
})
