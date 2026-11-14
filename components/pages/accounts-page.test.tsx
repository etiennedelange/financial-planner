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
import { toast } from "@/lib/hooks/use-toast"
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

describe("AccountsPage delete", () => {
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
  beforeEach(async () => {
    vi.mocked(toast).mockClear()
    useCalculatorStore.setState({ accounts: [ra, tfsa], identity: { kind: "guest" } })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<AccountsPage />))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ""
  })

  const deleteButtons = () => [
    ...container.querySelectorAll<HTMLButtonElement>('button[aria-label="Delete account"]'),
  ]
  const ids = () => useCalculatorStore.getState().accounts.map((a) => a.id)

  it("deletes immediately on one click, with no confirmation dialog in the way", async () => {
    expect(deleteButtons()).toHaveLength(2)
    await act(async () => deleteButtons()[0].click())
    expect(ids()).toHaveLength(1)
    expect(document.querySelector('[role="alertdialog"]')).toBeNull()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  })

  it("tells the user what was deleted and keeps Undo up long enough to use", async () => {
    await act(async () => deleteButtons()[0].click())
    expect(toast).toHaveBeenCalledTimes(1)
    const call = vi.mocked(toast).mock.calls[0][0]
    expect(call.title).toBe("Account deleted")
    expect(call.description).toContain("Allan Gray RA")
    expect(call.action?.label).toBe("Undo")
    expect(call.duration).toBeGreaterThanOrEqual(8000)
  })

  it("Undo restores the same account, unchanged", async () => {
    await act(async () => deleteButtons()[0].click())
    expect(ids()).not.toContain("ra-1")
    const undo = vi.mocked(toast).mock.calls[0][0].action!.onClick
    await act(async () => undo())
    const restored = useCalculatorStore.getState().accounts.find((a) => a.id === "ra-1")
    expect(restored).toEqual(ra)
  })

  it("deleting one account leaves the others alone", async () => {
    await act(async () => deleteButtons()[0].click())
    expect(ids().length).toBe(1)
    expect(ids()).toContain("tfsa-1")
  })
})
