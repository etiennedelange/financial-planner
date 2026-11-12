import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { AssumptionsForm } from "./assumptions-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"

/** Type into a number input the way a user does, so React and RHF see the change */
function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

/** RHF validates asynchronously (zod resolver); let it settle */
const settle = () => act(async () => await new Promise((r) => setTimeout(r, 0)))

describe("AssumptionsForm validation (issue #34)", () => {
  let container: HTMLDivElement
  let root: Root

  // happy-dom's Web Animations stub rejects when Motion cancels an animation; the
  // animations are irrelevant to what is tested here.
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })

  beforeEach(async () => {
    useCalculatorStore.setState({
      assumptions: {
        ...useCalculatorStore.getState().assumptions,
        equityReturn: 11,
        bondReturn: 8,
        cashReturn: 6.5,
        inflationRate: 5.5,
      },
      retirementGoals: { ...useCalculatorStore.getState().retirementGoals, inflationRate: 5.5 },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<AssumptionsForm />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const input = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!

  it("writes a valid inflation rate to both assumptions and retirement goals", async () => {
    await act(async () => typeInto(input("inflationRate"), "6"))
    await settle()
    expect(useCalculatorStore.getState().assumptions.inflationRate).toBe(6)
    expect(useCalculatorStore.getState().retirementGoals.inflationRate).toBe(6)
  })

  it("never stores NaN when a field is cleared, and says why", async () => {
    await act(async () => typeInto(input("inflationRate"), ""))
    await settle()
    expect(useCalculatorStore.getState().assumptions.inflationRate).toBe(5.5)
    expect(useCalculatorStore.getState().retirementGoals.inflationRate).toBe(5.5)
    expect(container.textContent).toContain("Enter an inflation rate")
  })

  it("never stores an out-of-range return, and says why", async () => {
    await act(async () => typeInto(input("equityReturn"), "150000"))
    await settle()
    expect(useCalculatorStore.getState().assumptions.equityReturn).toBe(11)
    expect(container.textContent).toContain("Equity return must be between 0% and 30%")
  })

  it("an invalid field blocks the whole update, so other fields are not half-applied", async () => {
    await act(async () => typeInto(input("bondReturn"), "3000"))
    await settle()
    await act(async () => typeInto(input("inflationRate"), "7"))
    await settle()
    expect(useCalculatorStore.getState().assumptions.bondReturn).toBe(8)
    expect(useCalculatorStore.getState().assumptions.inflationRate).toBe(5.5)

    // Fixing the invalid field lets the pending edits through together
    await act(async () => typeInto(input("bondReturn"), "9"))
    await settle()
    expect(useCalculatorStore.getState().assumptions.bondReturn).toBe(9)
    expect(useCalculatorStore.getState().assumptions.inflationRate).toBe(7)
  })
})
