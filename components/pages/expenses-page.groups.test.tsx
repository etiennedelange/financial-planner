import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { ExpensesPage } from "./expenses-page"
import { useExpensesStore } from "@/lib/store/expenses-store"
import { pressKey, setInputValue } from "@/lib/test-utils/dom"

const GROUPS = [
  { id: "g1", name: "Home", color: "#f87171", sortOrder: 0 },
  { id: "g2", name: "Food", color: "#4ade80", sortOrder: 1 },
]
const EXPENSES = [
  { id: "e1", groupId: "g1", name: "Rent", amount: 12_000, inRetirement: true, sortOrder: 0 },
  { id: "e2", groupId: "g1", name: "Water", amount: 800, inRetirement: false, sortOrder: 1 },
  { id: "e3", groupId: "g2", name: "Groceries", amount: 5_000, inRetirement: true, sortOrder: 0 },
]

describe("ExpensesPage groups, deletes and empty state", () => {
  let container: HTMLDivElement
  let root: Root

  // The icon buttons animate through @animateicons, which calls the Web Animations API
  // directly. happy-dom's stub rejects when that animation is cancelled, leaking an
  // unhandled rejection per click, so the animation is replaced with an inert one here.
  const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, "animate")
  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
    Element.prototype.animate = (() => ({
      cancel: () => {},
      finish: () => {},
      play: () => {},
      pause: () => {},
      reverse: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      playState: "finished",
      onfinish: null,
      oncancel: null,
    })) as unknown as Element["animate"]
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
    if (animateDescriptor) Object.defineProperty(Element.prototype, "animate", animateDescriptor)
  })

  const seed = (groups = GROUPS, expenses = EXPENSES) =>
    useExpensesStore.setState({ groups, expenses, monthlyIncome: 56_500 })

  const mount = async () => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<ExpensesPage />))
  }

  beforeEach(async () => {
    seed()
    await mount()
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    document.body.innerHTML = ""
  })

  const store = () => useExpensesStore.getState()
  const q = <T extends HTMLElement>(sel: string) => container.querySelector<T>(sel)!
  const byLabel = <T extends HTMLElement>(label: string) => q<T>(`[aria-label="${label}"]`)
  const click = (el: HTMLElement) => act(async () => el.click())
  const buttonByText = (text: string, scope: ParentNode = document) =>
    [...scope.querySelectorAll("button")].find((b) => b.textContent?.trim() === text)!
  const rerenderEmpty = async () => {
    act(() => root.unmount())
    container.remove()
    seed([], [])
    await mount()
  }

  describe("retirement toggle and collapsing", () => {
    it("excludes an expense from the retirement budget with one click, and includes it again", async () => {
      await click(q('[aria-label="In retirement — click to exclude"]'))
      expect(store().expenses.find((e) => e.id === "e1")?.inRetirement).toBe(false)
      const include = container.querySelectorAll(
        '[aria-label="Not in retirement — click to include"]',
      )
      expect(include).toHaveLength(2) // Rent (just excluded) and Water
      await click(include[1] as HTMLElement)
      expect(store().expenses.find((e) => e.id === "e2")?.inRetirement).toBe(true)
    })

    it("collapses a group to hide its rows, and expands it again", async () => {
      const toggle = () =>
        [...container.querySelectorAll<HTMLButtonElement>("button[aria-expanded]")].find((b) =>
          b.textContent?.includes("Home"),
        )!
      expect(toggle().getAttribute("aria-expanded")).toBe("true")
      expect(container.textContent).toContain("Rent")
      await click(toggle())
      expect(toggle().getAttribute("aria-expanded")).toBe("false")
      expect(container.textContent).not.toContain("Rent")
      await click(toggle())
      expect(container.textContent).toContain("Rent")
    })
  })

  describe("editing and deleting an expense", () => {
    it("renames an expense from the edit row", async () => {
      await click(byLabel("Edit Rent"))
      await act(async () => setInputValue(byLabel<HTMLInputElement>("Expense name"), "Bond"))
      await click(byLabel("Save expense"))
      expect(store().expenses.find((e) => e.id === "e1")?.name).toBe("Bond")
    })

    it("cancelling an edit changes nothing", async () => {
      await click(byLabel("Edit Rent"))
      await act(async () => setInputValue(byLabel<HTMLInputElement>("Expense name"), "Nope"))
      await click(byLabel("Cancel edit"))
      expect(store().expenses.find((e) => e.id === "e1")?.name).toBe("Rent")
    })

    it("deletes only after confirming in the dialog", async () => {
      await click(byLabel("Edit Rent"))
      await click(byLabel("Delete expense"))
      expect(document.body.textContent).toContain("This expense will be permanently removed")
      expect(store().expenses).toHaveLength(3) // not yet
      await click(buttonByText("Delete"))
      expect(store().expenses.map((e) => e.id)).toEqual(["e2", "e3"])
    })

    it("Cancel in the delete dialog keeps the expense", async () => {
      await click(byLabel("Edit Rent"))
      await click(byLabel("Delete expense"))
      await click(buttonByText("Cancel"))
      expect(store().expenses).toHaveLength(3)
    })
  })

  describe("deleting a group", () => {
    it("tells you how many expenses go with it, and deletes group + expenses on confirm", async () => {
      await click(byLabel("Delete group Home"))
      expect(document.body.textContent).toContain("all 2 expenses inside it")
      await click(buttonByText("Delete group"))
      expect(store().groups.map((g) => g.id)).toEqual(["g2"])
      expect(store().expenses.map((e) => e.id)).toEqual(["e3"])
    })

    it("uses the singular for a one-expense group", async () => {
      await click(byLabel("Delete group Food"))
      expect(document.body.textContent).toContain("all 1 expense inside it")
    })

    it("Cancel keeps the group", async () => {
      await click(byLabel("Delete group Home"))
      await click(buttonByText("Cancel"))
      expect(store().groups).toHaveLength(2)
    })
  })

  describe("Clear all", () => {
    it("shows the counts, and only clears after confirming", async () => {
      await click(buttonByText("Clear all", container))
      expect(document.body.textContent).toContain("Clear all expenses?")
      expect(document.body.textContent).toContain("all 2 groups and 3 expenses")
      expect(store().groups).toHaveLength(2)
      const confirm = [...document.querySelectorAll("[role=alertdialog] button")].find(
        (b) => b.textContent?.trim() === "Clear all",
      ) as HTMLElement
      await click(confirm)
      expect(store().groups).toEqual([])
      expect(store().expenses).toEqual([])
      expect(container.textContent).toContain("No expense groups yet")
    })

    it("Cancel keeps everything", async () => {
      await click(buttonByText("Clear all", container))
      await click(buttonByText("Cancel"))
      expect(store().groups).toHaveLength(2)
    })

    it("is not offered when there is nothing to clear", async () => {
      await rerenderEmpty()
      expect(buttonByText("Clear all", container)).toBeUndefined()
    })
  })

  describe("New Group", () => {
    const open = async () => click(buttonByText("New Group", container))
    const nameInput = () => byLabel<HTMLInputElement>("New group name")

    it("opens a focused row, disables the button while open, and saves name + chosen colour", async () => {
      await open()
      expect(document.activeElement).toBe(nameInput())
      expect(buttonByText("New Group", container).disabled).toBe(true)
      const swatches = [
        ...container.querySelectorAll<HTMLButtonElement>('[aria-label^="Select color"]'),
      ]
      expect(swatches.length).toBeGreaterThan(1)
      const pressed = swatches.filter((s) => s.getAttribute("aria-pressed") === "true")
      expect(pressed.map((s) => s.getAttribute("aria-label"))).toEqual(["Select color #818cf8"]) // default
      await act(async () => setInputValue(nameInput(), "  Transport  "))
      const other = swatches.find((s) => s.getAttribute("aria-pressed") === "false")!
      await click(other)
      expect(other.getAttribute("aria-pressed")).toBe("true")
      await click(byLabel("Save group"))
      const added = store().groups.find((g) => g.name === "Transport")
      expect(added).toBeTruthy() // trimmed
      expect(other.getAttribute("aria-label")).toBe(`Select color ${added!.color}`)
      expect(container.querySelector('[aria-label="New group name"]')).toBeNull() // row closed
    })

    it("saves on Enter", async () => {
      await open()
      await act(async () => setInputValue(nameInput(), "Fun"))
      await act(async () => pressKey(nameInput(), "Enter"))
      expect(store().groups.some((g) => g.name === "Fun")).toBe(true)
    })

    it("Escape and Cancel close the row without adding anything", async () => {
      await open()
      await act(async () => setInputValue(nameInput(), "Ghost"))
      await act(async () => pressKey(nameInput(), "Escape"))
      expect(nameInput()).toBeNull()
      await open()
      await click(byLabel("Cancel"))
      expect(nameInput()).toBeNull()
      expect(store().groups).toHaveLength(2)
    })

    it("a blank name is treated as cancel, not an empty group", async () => {
      await open()
      await act(async () => setInputValue(nameInput(), "   "))
      await click(byLabel("Save group"))
      expect(store().groups).toHaveLength(2)
      expect(nameInput()).toBeNull()
    })
  })

  describe("empty state", () => {
    beforeEach(async () => {
      await rerenderEmpty()
    })

    it("explains what to do", () => {
      expect(container.textContent).toContain("No expense groups yet")
      expect(container.textContent).toContain("Group your expenses")
    })

    it("Load sample data fills the page with a budget", async () => {
      await click(buttonByText("Load sample data", container))
      expect(store().groups.length).toBeGreaterThan(0)
      expect(store().expenses.length).toBeGreaterThan(0)
      expect(container.textContent).not.toContain("No expense groups yet")
    })

    it("Create first group opens the new-group row", async () => {
      await click(buttonByText("Create first group", container))
      expect(byLabel("New group name")).toBeTruthy()
    })
  })

  describe("spend breakdown", () => {
    it("orders groups by what they cost, biggest first, and omits groups with nothing in them", async () => {
      act(() => root.unmount())
      container.remove()
      // Food is listed first but costs less than Home; Empty has no expenses.
      seed(
        [
          { id: "g2", name: "Food", color: "#4ade80", sortOrder: 0 },
          { id: "g1", name: "Home", color: "#f87171", sortOrder: 1 },
          { id: "g3", name: "Empty", color: "#60a5fa", sortOrder: 2 },
        ],
        EXPENSES,
      )
      await mount()
      const bars = [...container.querySelectorAll("[aria-label$=' spend']")].map((el) =>
        el.getAttribute("aria-label"),
      )
      expect(bars).toEqual(["Home spend", "Food spend"])
    })
  })
})
