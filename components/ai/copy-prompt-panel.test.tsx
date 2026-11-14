import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { CopyPromptPanel } from "./copy-prompt-panel"
import { buildCopyablePrompt } from "@/lib/ai/copy-prompt"
import type { PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

const payload: PlanNarrativePayload = {
  accounts: [
    {
      type: "tfsa",
      currentBalance: 100_000,
      monthlyContribution: 2_000,
      expectedReturn: 10,
      annualFees: 1,
    },
  ],
  personalInfo: { currentAge: 40, retirementAge: 65, lifeExpectancy: 90, annualIncome: 500_000 },
  retirementGoals: { desiredMonthlyIncome: 25_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 60_000,
    lumpSumPercentage: 0,
  },
  projection: {
    portfolioAtRetirement: 3_000_000,
    monthlyIncomeAtRetirement: 15_000,
    monthlyNetIncomeAtRetirement: 14_000,
    portfolioDepletionAge: null,
  },
}

describe("CopyPromptPanel", () => {
  let host: HTMLElement
  let root: Root
  let writeText: ReturnType<typeof vi.fn>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.useFakeTimers()
    writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { clipboard: { writeText } })
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<CopyPromptPanel payload={payload} />))
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const copyButton = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.includes("op"))!

  it("previews exactly the text it will copy", () => {
    const area = host.querySelector("textarea")!
    expect(area.value).toBe(buildCopyablePrompt(payload))
    expect(area.readOnly).toBe(true)
  })

  it("copies that exact prompt, confirms, then resets", async () => {
    await act(async () => copyButton().click())
    expect(writeText).toHaveBeenCalledWith(buildCopyablePrompt(payload))
    expect(host.textContent).toContain("Copied")
    expect(host.querySelector("[role=status]")!.textContent).toContain("copied to your clipboard")
    await act(async () => void vi.advanceTimersByTime(3100))
    expect(host.textContent).toContain("Copy prompt")
  })

  it("explains what to do (and opens the preview) when the browser refuses to copy", async () => {
    writeText.mockRejectedValue(new Error("denied"))
    await act(async () => copyButton().click())
    expect(host.querySelector("[role=status]")!.textContent).toContain("wouldn't let us copy")
    expect(host.querySelector("details")!.open).toBe(true)
  })

  it("links to the chat apps safely, with no plan data in any URL", () => {
    const links = [...host.querySelectorAll("a")]
    expect(links.map((a) => a.textContent)).toEqual(["Claude", "ChatGPT", "Gemini"])
    for (const a of links) {
      expect(a.getAttribute("target")).toBe("_blank")
      expect(a.getAttribute("rel")).toContain("noopener")
      expect(a.getAttribute("rel")).toContain("noreferrer")
      expect(new URL(a.href).search).toBe("")
    }
  })

  it("says plainly that the prompt contains financial figures and goes wherever it is pasted", () => {
    expect(host.textContent).toContain("balances, contributions, ages and goals")
    expect(host.textContent).toContain("not financial advice")
  })
})
