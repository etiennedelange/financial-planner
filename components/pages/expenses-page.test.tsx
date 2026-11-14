import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { MotionGlobalConfig } from "motion/react"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vite-plus/test"
import { ExpensesPage } from "./expenses-page"
import { useExpensesStore } from "@/lib/store/expenses-store"
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
const key = (el: HTMLElement, k: string) =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }))

describe("ExpensesPage inline amount editors", () => {
  let container: HTMLDivElement
  let root: Root

  beforeAll(() => {
    MotionGlobalConfig.skipAnimations = true
  })
  afterAll(() => {
    MotionGlobalConfig.skipAnimations = false
  })
  beforeEach(async () => {
    useExpensesStore.setState({
      identity: { kind: "guest" },
      groups: [{ id: "g1", name: "Home", color: "#f87171", sortOrder: 0 }],
      expenses: [
        { id: "e1", groupId: "g1", name: "Rent", amount: 12_000, inRetirement: true, sortOrder: 0 },
      ],
      monthlyIncome: 56_500,
    })
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => root.render(<ExpensesPage />))
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const q = <T extends HTMLElement>(sel: string) => container.querySelector<T>(sel)!
  const byLabel = <T extends HTMLElement>(label: string) => q<T>(`[aria-label="${label}"]`)
  const click = (el: HTMLElement) => act(async () => el.click())
  const store = () => useExpensesStore.getState()

  describe("Monthly income", () => {
    const open = async () => {
      await click(byLabel("Edit monthly income"))
      return byLabel<HTMLInputElement>("Monthly income")
    }

    it("opens focused, formatted with the R inside the field", async () => {
      const input = await open()
      expect(input.value).toBe(`56${GROUP_SEPARATOR}500`)
      expect(document.activeElement).toBe(input)
    })

    it("saves a typed income as a number when Enter is pressed", async () => {
      const input = await open()
      await act(async () => typeInto(input, "62000"))
      await act(async () => key(input, "Enter"))
      expect(store().monthlyIncome).toBe(62_000)
    })

    it("saves with the check button too", async () => {
      const input = await open()
      await act(async () => typeInto(input, "70000"))
      await click(byLabel("Save income"))
      expect(store().monthlyIncome).toBe(70_000)
    })

    it("does not change income on Escape", async () => {
      const input = await open()
      await act(async () => typeInto(input, "99999"))
      await act(async () => key(input, "Escape"))
      expect(store().monthlyIncome).toBe(56_500)
    })

    it("rejects R0 and an empty field, keeping the old income", async () => {
      let input = await open()
      await act(async () => typeInto(input, "0"))
      await act(async () => key(input, "Enter"))
      expect(store().monthlyIncome).toBe(56_500)

      input = await open()
      await act(async () => typeInto(input, ""))
      await act(async () => key(input, "Enter"))
      expect(store().monthlyIncome).toBe(56_500)
    })

    it("physically blocks an income above the R1 trillion cap", async () => {
      const input = await open()
      await act(async () => typeInto(input, String(MAX_MONETARY_AMOUNT * 10)))
      expect(input.value).toBe(`56${GROUP_SEPARATOR}500`)
    })
  })

  describe("Add expense", () => {
    const openAdd = async () => {
      const add = [...container.querySelectorAll("button")].find((b) =>
        b.textContent?.includes("Add expense"),
      )!
      await click(add)
    }

    it("saves the name and amount as a number", async () => {
      await openAdd()
      await act(async () => typeInto(byLabel<HTMLInputElement>("New expense name"), "Water"))
      await act(async () => typeInto(byLabel<HTMLInputElement>("New expense amount"), "850.5"))
      await click(q('button[aria-label="Save expense"]'))
      const added = store().expenses.find((e) => e.name === "Water")
      expect(added?.amount).toBe(850.5)
    })

    it("saves an empty amount as R0, never NaN", async () => {
      await openAdd()
      await act(async () => typeInto(byLabel<HTMLInputElement>("New expense name"), "Gift"))
      await click(q('button[aria-label="Save expense"]'))
      const added = store().expenses.find((e) => e.name === "Gift")
      expect(added?.amount).toBe(0)
    })

    it("saves on Enter from the amount field", async () => {
      await openAdd()
      await act(async () => typeInto(byLabel<HTMLInputElement>("New expense name"), "Levies"))
      const amount = byLabel<HTMLInputElement>("New expense amount")
      await act(async () => typeInto(amount, "1500"))
      await act(async () => key(amount, "Enter"))
      expect(store().expenses.find((e) => e.name === "Levies")?.amount).toBe(1_500)
    })
  })

  describe("Edit expense", () => {
    const openEdit = async () => {
      await click(byLabel("Edit Rent"))
      return byLabel<HTMLInputElement>("Expense amount")
    }

    it("starts from the current amount, grouped", async () => {
      const input = await openEdit()
      expect(input.value).toBe(`12${GROUP_SEPARATOR}000`)
    })

    it("saves a new amount as a number", async () => {
      const input = await openEdit()
      await act(async () => typeInto(input, "13250"))
      await act(async () => key(input, "Enter"))
      expect(store().expenses.find((e) => e.id === "e1")?.amount).toBe(13_250)
    })

    it("keeps the old amount when the field is cleared", async () => {
      const input = await openEdit()
      await act(async () => typeInto(input, ""))
      await act(async () => key(input, "Enter"))
      expect(store().expenses.find((e) => e.id === "e1")?.amount).toBe(12_000)
    })

    it("allows R0 as a real amount", async () => {
      const input = await openEdit()
      await act(async () => typeInto(input, "0"))
      await act(async () => key(input, "Enter"))
      expect(store().expenses.find((e) => e.id === "e1")?.amount).toBe(0)
    })
  })
})
