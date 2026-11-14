import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { DrawdownStrategyForm } from "./drawdown-strategy-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"
import { GROUP_SEPARATOR } from "@/lib/utils/number-field"

function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}

describe("DrawdownStrategyForm numeric fields", () => {
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
      drawdownConfig: {
        ...useCalculatorStore.getState().drawdownConfig,
        strategy: "guardrails",
        minimumWithdrawal: 15_000,
        maximumWithdrawal: 60_000,
        monthlyMedicalAid: 4_000,
        medicalAidDependants: 2,
      },
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<DrawdownStrategyForm />))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const input = (id: string) => container.querySelector<HTMLInputElement>(`#${id}`)!
  const config = () => useCalculatorStore.getState().drawdownConfig

  it("shows rands grouped", () => {
    expect(input("minimumWithdrawal").value).toBe(`15${GROUP_SEPARATOR}000`)
    expect(input("maximumWithdrawal").value).toBe(`60${GROUP_SEPARATOR}000`)
    expect(input("monthlyMedicalAid").value).toBe(`4${GROUP_SEPARATOR}000`)
  })

  it("stores a typed minimum withdrawal as a number", async () => {
    await act(async () => typeInto(input("minimumWithdrawal"), "20000"))
    expect(config().minimumWithdrawal).toBe(20_000)
  })

  it("stores R0 when the minimum is cleared (withdrawals are never NaN)", async () => {
    await act(async () => typeInto(input("minimumWithdrawal"), ""))
    expect(config().minimumWithdrawal).toBe(0)
    expect(Number.isNaN(config().minimumWithdrawal)).toBe(false)
  })

  it("blocks a maximum withdrawal above the R1 trillion cap", async () => {
    const tooBig = String(MAX_MONETARY_AMOUNT * 10)
    await act(async () => typeInto(input("maximumWithdrawal"), tooBig))
    expect(config().maximumWithdrawal).toBe(60_000)
  })

  it("clearing medical aid stores undefined, not 0 or NaN", async () => {
    await act(async () => typeInto(input("monthlyMedicalAid"), ""))
    expect(config().monthlyMedicalAid).toBeUndefined()
  })

  it("stores a typed medical aid amount", async () => {
    await act(async () => typeInto(input("monthlyMedicalAid"), "5500"))
    expect(config().monthlyMedicalAid).toBe(5_500)
  })

  it("clearing dependants stores undefined", async () => {
    await act(async () => typeInto(input("medicalAidDependants"), ""))
    expect(config().medicalAidDependants).toBeUndefined()
  })

  it("keeps 0 dependants as 0, which is different from empty", async () => {
    await act(async () => typeInto(input("medicalAidDependants"), "0"))
    expect(config().medicalAidDependants).toBe(0)
  })

  it("blocks more than 10 dependants", async () => {
    await act(async () => typeInto(input("medicalAidDependants"), "15"))
    expect(config().medicalAidDependants).toBe(2)
  })
})
