import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test"
import { AccountFormDialog } from "./account-form-dialog"
import type { Account } from "@/types"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { GROUP_SEPARATOR } from "@/lib/utils/number-field"

function typeInto(input: HTMLInputElement, value: string) {
  // The native setter bypasses React's value tracker (a plain `input.value =` would hide
  // the change from onChange); it is invoked with an explicit `this` on the next line.
  // oxlint-disable-next-line typescript/unbound-method
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
  setter.call(input, value)
  input.dispatchEvent(new Event("input", { bubbles: true }))
}
const settle = () => act(async () => await new Promise((r) => setTimeout(r, 10)))

const tfsa: Account = {
  id: "a1",
  name: "My TFSA",
  provider: "Allan Gray",
  type: "tfsa",
  currentBalance: 250_000,
  monthlyContribution: 2_500,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
  tfsaContributionsToDate: 180_000,
  investmentType: "balanced",
}

describe("AccountFormDialog numeric fields", () => {
  let container: HTMLDivElement
  let root: Root
  const onSave = vi.fn()

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    // Desktop layout: the dialog, not the mobile drawer
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as typeof window.matchMedia
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })
  beforeEach(async () => {
    onSave.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root.render(
        <AccountFormDialog open onOpenChange={() => {}} account={tfsa} onSave={onSave} />,
      ),
    )
    await settle()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ""
  })

  // Radix renders the dialog in a portal on document.body
  const input = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)!
  const submit = async () => {
    const form = document.querySelector("form")!
    await act(async () => form.requestSubmit())
    await settle()
  }

  it("shows the account's numbers formatted, with units inside the fields", () => {
    expect(input("af-balance").value).toBe(`250${GROUP_SEPARATOR}000`)
    expect(input("af-monthly").value).toBe(`2${GROUP_SEPARATOR}500`)
    expect(input("af-return").value).toBe("10")
    expect(input("af-fees").value).toBe("1")
    expect(input("af-escalation").value).toBe("5")
    expect(input("af-tfsa").value).toBe(`180${GROUP_SEPARATOR}000`)
  })

  it("saves edited values as numbers, not formatted text", async () => {
    await act(async () => typeInto(input("af-balance"), "300000"))
    await act(async () => typeInto(input("af-return"), "11.5"))
    await act(async () => typeInto(input("af-fees"), "0.75"))
    await submit()
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0]
    expect(saved.currentBalance).toBe(300_000)
    expect(saved.expectedReturn).toBe(11.5)
    expect(saved.annualFees).toBe(0.75)
    expect(saved.monthlyContribution).toBe(2_500)
    expect(saved.tfsaContributionsToDate).toBe(180_000)
  })

  it("accepts R0 balance and 0% escalation", async () => {
    await act(async () => typeInto(input("af-balance"), "0"))
    await act(async () => typeInto(input("af-escalation"), "0"))
    await submit()
    const saved = onSave.mock.calls[0][0]
    expect(saved.currentBalance).toBe(0)
    expect(saved.contributionEscalation).toBe(0)
  })

  it("does not save a cleared balance, and says why", async () => {
    await act(async () => typeInto(input("af-balance"), ""))
    await submit()
    expect(onSave).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("Enter a balance")
  })

  it("does not save an out-of-range return, and says why", async () => {
    await act(async () => typeInto(input("af-return"), "45"))
    await submit()
    expect(onSave).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain("Expected return must be between 0% and 30%")
  })

  it("blocks TFSA contributions above the lifetime limit as they are typed", async () => {
    const tooMuch = String(SA_TAX_LIMITS.tfsaLifetimeLimit + 1)
    await act(async () => typeInto(input("af-tfsa"), tooMuch))
    expect(input("af-tfsa").value).toBe(`180${GROUP_SEPARATOR}000`)
  })

  it("accepts TFSA contributions exactly at the lifetime limit", async () => {
    await act(async () => typeInto(input("af-tfsa"), String(SA_TAX_LIMITS.tfsaLifetimeLimit)))
    await submit()
    expect(onSave.mock.calls[0][0].tfsaContributionsToDate).toBe(SA_TAX_LIMITS.tfsaLifetimeLimit)
  })
})

describe("AccountFormDialog add wizard", () => {
  let container: HTMLDivElement
  let root: Root
  const onSave = vi.fn()

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    })) as typeof window.matchMedia
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })
  beforeEach(async () => {
    onSave.mockReset()
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () =>
      root.render(
        <AccountFormDialog open onOpenChange={() => {}} account={null} onSave={onSave} />,
      ),
    )
    await settle()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ""
  })

  const input = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)
  const buttonNamed = (re: RegExp) =>
    [...document.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      re.test(b.textContent ?? ""),
    )

  const fillStep1 = async () => {
    await act(async () => typeInto(input("af-name")!, "Wizard TFSA"))
    await act(async () => typeInto(input("af-provider")!, "Allan Gray"))
    await act(async () => typeInto(input("af-balance")!, "1000"))
    await act(async () => typeInto(input("af-monthly")!, "100"))
  }

  it("starts on step 1 with Continue, not Add Account", () => {
    expect(buttonNamed(/continue/i)).toBeTruthy()
    expect(buttonNamed(/^add account$/i)).toBeFalsy()
    expect(input("af-return")).toBeNull()
  })

  it("Continue moves to step 2 and does NOT save the account", async () => {
    await fillStep1()
    await act(async () => buttonNamed(/continue/i)!.click())
    await settle()
    expect(onSave).not.toHaveBeenCalled()
    expect(input("af-return")).not.toBeNull()
    expect(buttonNamed(/^add account$/i)).toBeTruthy()
  })

  it("Continue and Add Account are different DOM elements, so one click cannot do both", async () => {
    // If React reused the Continue button and flipped its type to submit, the click that
    // advanced the wizard would also submit the form in a real browser (the async handler's
    // re-render lands before the browser's default action). happy-dom cannot reproduce that
    // ordering, so this asserts the cause: the element must be replaced, not mutated.
    await fillStep1()
    const continueButton = buttonNamed(/continue/i)!
    await act(async () => continueButton.click())
    await settle()
    const addButton = buttonNamed(/^add account$/i)!
    expect(addButton).not.toBe(continueButton)
    expect(continueButton.isConnected).toBe(false)
  })

  it("saves only after step 2, with the step 2 values", async () => {
    await fillStep1()
    await act(async () => buttonNamed(/continue/i)!.click())
    await settle()
    await act(async () => typeInto(input("af-return")!, "12"))
    await act(async () => buttonNamed(/^add account$/i)!.click())
    await settle()
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({
      name: "Wizard TFSA",
      currentBalance: 1000,
      monthlyContribution: 100,
      expectedReturn: 12,
    })
  })
})
