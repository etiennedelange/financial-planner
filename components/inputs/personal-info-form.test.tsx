import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { PersonalInfoForm } from "./personal-info-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { GROUP_SEPARATOR } from "@/lib/utils/number-field"

/** Type into an input the way a user does, so React and RHF see the change */
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

describe("PersonalInfoForm", () => {
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
      personalInfo: {
        ...useCalculatorStore.getState().personalInfo,
        currentAge: 35,
        retirementAge: 65,
        lifeExpectancy: 90,
        annualIncome: 600_000,
      },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<PersonalInfoForm />))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const input = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!
  const info = () => useCalculatorStore.getState().personalInfo

  it("shows the stored values, with income grouped in thousands", () => {
    expect(input("currentAge").value).toBe("35")
    expect(input("retirementAge").value).toBe("65")
    expect(input("lifeExpectancy").value).toBe("90")
    expect(input("annualIncome").value).toBe(`600${GROUP_SEPARATOR}000`)
  })

  it("writes a typed age to the store as a number", async () => {
    await act(async () => typeInto(input("retirementAge"), "60"))
    await settle()
    expect(info().retirementAge).toBe(60)
  })

  it("stores income as a number while showing it grouped", async () => {
    await act(async () => typeInto(input("annualIncome"), "1250000"))
    await settle()
    expect(info().annualIncome).toBe(1_250_000)
    expect(input("annualIncome").value).toBe(`1${GROUP_SEPARATOR}250${GROUP_SEPARATOR}000`)
  })

  it("stores R0 income rather than treating it as empty", async () => {
    await act(async () => typeInto(input("annualIncome"), "0"))
    await settle()
    expect(info().annualIncome).toBe(0)
  })

  it("physically blocks income above the R1 trillion cap", async () => {
    await act(async () => typeInto(input("annualIncome"), "10000000000000"))
    await settle()
    expect(info().annualIncome).toBe(600_000)
    expect(input("annualIncome").value).toBe(`600${GROUP_SEPARATOR}000`)
  })

  it("never stores a retirement age at or before the current age, and says why", async () => {
    await act(async () => typeInto(input("currentAge"), "50"))
    await settle()
    await act(async () => typeInto(input("retirementAge"), "50"))
    await settle()
    expect(info().retirementAge).toBe(65)
    expect(container.textContent).toContain("Retirement age must be after current age")
  })

  it("never stores NaN when a field is cleared, and says why", async () => {
    await act(async () => typeInto(input("currentAge"), ""))
    await settle()
    expect(info().currentAge).toBe(35)
    expect(container.textContent).toContain("Enter your current age")
  })

  it("follows the store when it changes from outside (scenario switch)", async () => {
    await act(async () =>
      useCalculatorStore.setState({
        personalInfo: { ...info(), currentAge: 50, annualIncome: 1_000_000 },
      }),
    )
    await settle()
    expect(input("currentAge").value).toBe("50")
    expect(input("annualIncome").value).toBe(`1${GROUP_SEPARATOR}000${GROUP_SEPARATOR}000`)
  })

  it("shows the years until and in retirement", () => {
    expect(container.textContent).toContain("years until retirement")
    expect(container.textContent).toContain("years in retirement")
  })

  it("hides the timeline while the ages are out of order", async () => {
    await act(async () => typeInto(input("currentAge"), "50"))
    await settle()
    await act(async () => typeInto(input("retirementAge"), "50"))
    await settle()
    expect(container.textContent).not.toContain("years until retirement")
  })
})
