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
import { AccountsPage } from "./accounts-page"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SEED_ACCOUNTS } from "@/lib/dev/seed-accounts"
import type { Account } from "@/types"

vi.mock("@/lib/hooks/use-toast", () => ({ toast: vi.fn(), useToast: () => ({ toasts: [] }) }))

const ra: Account = {
  id: "ra-1",
  name: "Allan Gray RA",
  provider: "Allan Gray",
  type: "retirement_annuity",
  currentBalance: 480_000,
  monthlyContribution: 3_000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}
const tfsa: Account = { ...ra, id: "tfsa-1", name: "My TFSA", type: "tfsa" }

describe("AccountsPage rows, dialogs and empty state", () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    window.matchMedia ??= ((query: string) => ({
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

  const mount = async (accounts: Account[]) => {
    useCalculatorStore.setState({ accounts })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<AccountsPage />))
  }

  beforeEach(async () => {
    await mount([ra, tfsa])
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ""
    delete (document as { startViewTransition?: unknown }).startViewTransition
  })

  const store = () => useCalculatorStore.getState()
  const click = (el: Element) => act(async () => (el as HTMLElement).click())
  const buttonByText = (text: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!
  const q = (sel: string) => container.querySelector<HTMLElement>(sel)!
  const remount = async (accounts: Account[]) => {
    act(() => root.unmount())
    container.remove()
    await mount(accounts)
  }

  describe("expanding a row", () => {
    const expander = (name: string) =>
      document.querySelector<HTMLButtonElement>(`button[aria-label$="details for ${name}"]`)!

    it("expands and collapses, keeping the button's name and aria-expanded in step", async () => {
      expect(expander("Allan Gray RA").getAttribute("aria-label")).toBe(
        "Expand details for Allan Gray RA",
      )
      expect(expander("Allan Gray RA").getAttribute("aria-expanded")).toBe("false")
      await click(expander("Allan Gray RA"))
      expect(expander("Allan Gray RA").getAttribute("aria-label")).toBe(
        "Collapse details for Allan Gray RA",
      )
      expect(expander("Allan Gray RA").getAttribute("aria-expanded")).toBe("true")
      await click(expander("Allan Gray RA"))
      expect(expander("Allan Gray RA").getAttribute("aria-expanded")).toBe("false")
    })

    it("only the clicked row expands", async () => {
      await click(expander("Allan Gray RA"))
      expect(expander("My TFSA").getAttribute("aria-expanded")).toBe("false")
    })

    it("uses the View Transitions API when the browser has it, and still toggles", async () => {
      const start = vi.fn((callback: () => void) => {
        callback()
        return {}
      })
      ;(document as unknown as { startViewTransition: typeof start }).startViewTransition = start
      await click(expander("My TFSA"))
      expect(start).toHaveBeenCalledTimes(1)
      expect(expander("My TFSA").getAttribute("aria-expanded")).toBe("true")
    })
  })

  describe("row hover", () => {
    const row = () => q("div.group")
    const hover = (type: "mouseover" | "mouseout") =>
      act(async () => {
        row().dispatchEvent(new MouseEvent(type, { bubbles: true, relatedTarget: document.body }))
      })

    it("tints a collapsed row on hover and clears the tint when the pointer leaves", async () => {
      await hover("mouseover")
      await hover("mouseout")
      expect(row().style.backgroundColor).toBe("transparent")
    })

    it("does not fight the expanded background (hover and leave are no-ops when expanded)", async () => {
      await click(
        document.querySelector<HTMLElement>('button[aria-label^="Expand details for Allan"]')!,
      )
      const before = row().style.backgroundColor
      await hover("mouseover")
      await hover("mouseout")
      expect(row().style.backgroundColor).toBe(before)
    })
  })

  describe("adding, editing and seeding", () => {
    it("Edit account opens the dialog on that account", async () => {
      await click(q('button[aria-label="Edit account"]'))
      expect(document.querySelector("[role=dialog]")).toBeTruthy()
      expect(document.body.textContent).toContain("Edit Account")
      const name = [...document.querySelectorAll<HTMLInputElement>("[role=dialog] input")].find(
        (i) => i.value === "Allan Gray RA",
      )
      expect(name).toBeTruthy()
    })

    it("the Add Account action opens an empty dialog", async () => {
      await click(buttonByText("Add Account"))
      expect(document.querySelector("[role=dialog]")).toBeTruthy()
      const filled = [...document.querySelectorAll<HTMLInputElement>("[role=dialog] input")].some(
        (i) => i.value === "Allan Gray RA",
      )
      expect(filled).toBe(false)
    })

    it("Seed replaces the accounts with the sample set, each with a fresh id", async () => {
      await click(buttonByText("Seed"))
      expect(store().accounts).toHaveLength(SEED_ACCOUNTS.length)
      expect(store().accounts.some((a) => a.id === "ra-1")).toBe(false)
      expect(new Set(store().accounts.map((a) => a.id)).size).toBe(SEED_ACCOUNTS.length)
    })
  })

  describe("empty state", () => {
    beforeEach(async () => {
      await remount([])
    })

    it("explains what to do", () => {
      expect(container.textContent).toContain("No accounts yet")
    })

    it("Seed Accounts fills the page", async () => {
      await click(buttonByText("Seed Accounts"))
      expect(store().accounts).toHaveLength(SEED_ACCOUNTS.length)
      expect(container.textContent).not.toContain("No accounts yet")
    })

    it("Add Your First Account opens the dialog", async () => {
      await click(buttonByText("Add Your First Account"))
      expect(document.querySelector("[role=dialog]")).toBeTruthy()
    })
  })
})
