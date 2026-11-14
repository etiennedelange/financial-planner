import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { DrawdownStrategyForm } from "./drawdown-strategy-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { DrawdownStrategy } from "@/types"

describe("DrawdownStrategyForm sliders and strategy-dependent sections", () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })

  const config = () => useCalculatorStore.getState().drawdownConfig

  const mount = async (
    strategy: DrawdownStrategy,
    extra: Partial<ReturnType<typeof config>> = {},
    portfolioAtRetirement?: number,
  ) => {
    useCalculatorStore.setState({
      drawdownConfig: {
        ...useCalculatorStore.getState().drawdownConfig,
        strategy,
        initialWithdrawalRate: 4,
        lumpSumPercentage: 0,
        upperGuardrail: 20,
        lowerGuardrail: 20,
        ...extra,
      },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root.render(<DrawdownStrategyForm portfolioAtRetirement={portfolioAtRetirement} />),
    )
  }

  beforeEach(() => {
    container = undefined as unknown as HTMLDivElement
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const slider = (label: string) =>
    container.querySelector<HTMLElement>(`[role=slider][aria-label="${label}"]`)!
  const press = (el: HTMLElement, key: string) =>
    act(async () => {
      el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }))
    })

  describe("which sections each strategy shows", () => {
    it("fixed percentage shows neither min/max withdrawal nor guardrail bands", async () => {
      await mount("fixed_percentage")
      expect(
        container.querySelector("#min-withdrawal, [aria-label='Minimum withdrawal']"),
      ).toBeNull()
      expect(container.textContent).not.toContain("Guardrail Bands")
    })

    it("variable percentage shows min/max withdrawal but no guardrail bands", async () => {
      await mount("variable_percentage")
      expect(container.textContent).not.toContain("Guardrail Bands")
      expect(container.textContent).toContain("Maximum")
    })

    it("guardrails shows min/max withdrawal and both guardrail bands", async () => {
      await mount("guardrails")
      expect(container.textContent).toContain("Guardrail Bands")
      expect(slider("Upper Guardrail")).toBeTruthy()
      expect(slider("Lower Guardrail")).toBeTruthy()
    })
  })

  describe("withdrawal rate slider (2–8% in 0.5 steps)", () => {
    it("shows the rate and commits a keyboard step to the store", async () => {
      await mount("fixed_percentage")
      expect(container.textContent).toContain("4.0%")
      await press(slider("Initial Withdrawal Rate"), "ArrowRight")
      expect(config().initialWithdrawalRate).toBe(4.5)
      expect(container.textContent).toContain("4.5%")
    })

    it("cannot be pushed outside its bounds", async () => {
      await mount("fixed_percentage", { initialWithdrawalRate: 8 })
      await press(slider("Initial Withdrawal Rate"), "ArrowRight")
      expect(config().initialWithdrawalRate).toBe(8)
      await press(slider("Initial Withdrawal Rate"), "Home")
      expect(config().initialWithdrawalRate).toBe(2)
    })

    it("follows the store when the rate is changed elsewhere (synced local state)", async () => {
      await mount("fixed_percentage")
      await act(async () =>
        useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 6 }),
      )
      expect(container.textContent).toContain("6.0%")
    })
  })

  describe("lump sum slider (0–33%)", () => {
    it("commits a step to the store", async () => {
      await mount("fixed_percentage")
      await press(slider("Lump Sum at Retirement"), "ArrowRight")
      expect(config().lumpSumPercentage).toBe(1)
    })

    it("shows what the lump sum is worth once a portfolio value is known", async () => {
      await mount("fixed_percentage", { lumpSumPercentage: 10 }, 5_000_000)
      expect(container.textContent).toMatch(/≈/)
      expect(container.textContent).toMatch(/500\s?000/)
    })

    it("shows no rand estimate without a portfolio value", async () => {
      await mount("fixed_percentage", { lumpSumPercentage: 10 })
      expect(container.textContent).not.toMatch(/≈/)
    })
  })

  describe("guardrail sliders (5–50% in steps of 5)", () => {
    it("the upper band commits a step", async () => {
      await mount("guardrails")
      expect(container.textContent).toContain("20%")
      await press(slider("Upper Guardrail"), "ArrowRight")
      expect(config().upperGuardrail).toBe(25)
    })

    it("the lower band commits a step down", async () => {
      await mount("guardrails")
      await press(slider("Lower Guardrail"), "ArrowLeft")
      expect(config().lowerGuardrail).toBe(15)
    })

    it("the two bands are independent", async () => {
      await mount("guardrails")
      await press(slider("Upper Guardrail"), "ArrowRight")
      expect(config().lowerGuardrail).toBe(20)
    })
  })
})
