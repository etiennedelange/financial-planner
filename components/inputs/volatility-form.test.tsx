import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { VolatilityForm } from "./volatility-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"

function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
const settle = () => act(async () => await new Promise((r) => setTimeout(r, 0)))

describe("VolatilityForm equity volatility field", () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })
  beforeEach(async () => {
    useCalculatorStore.setState({
      assumptions: { ...useCalculatorStore.getState().assumptions, equityVolatility: 16 },
      accounts: [],
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<VolatilityForm />))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const input = () => container.querySelector<HTMLInputElement>("#equityVolatility")!
  const volatility = () => useCalculatorStore.getState().assumptions.equityVolatility

  it("shows the stored volatility", () => {
    expect(input().value).toBe("16")
  })

  it("stores a typed value, including a decimal", async () => {
    await act(async () => typeInto(input(), "17.5"))
    await settle()
    expect(volatility()).toBe(17.5)
  })

  it("stores 0%", async () => {
    await act(async () => typeInto(input(), "0"))
    await settle()
    expect(volatility()).toBe(0)
  })

  it("never stores a value above 40%, and says why", async () => {
    await act(async () => typeInto(input(), "400"))
    await settle()
    expect(volatility()).toBe(16)
    expect(container.textContent).toContain("Equity volatility must be between 0% and 40%")
  })

  it("never stores NaN when cleared, and says why", async () => {
    await act(async () => typeInto(input(), ""))
    await settle()
    expect(volatility()).toBe(16)
    expect(container.textContent).toContain("Enter equity volatility")
  })
})
