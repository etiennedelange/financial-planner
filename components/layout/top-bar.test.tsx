import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { TopBar } from "./top-bar"
import { useCalculatorStore } from "@/lib/store/calculator-store"

vi.mock("next/navigation", () => ({
  usePathname: () => "/calculator/plan",
  useRouter: () => ({ push: () => {}, replace: () => {}, refresh: () => {} }),
}))
vi.mock("@/components/layout/account-menu", () => ({ AccountMenu: () => null }))
vi.mock("@/components/scenarios/scenario-switcher", () => ({ ScenarioSwitcher: () => null }))
vi.mock("@/components/theme-toggle", () => ({ ThemeToggle: () => null }))

describe("TopBar display-mode button", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })
  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  const render = async (mode: "nominal" | "real") => {
    useCalculatorStore.setState({ displayMode: mode })
    await act(async () => root.render(<TopBar user={null} />))
  }
  const trigger = () =>
    [...container.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
      /display mode/i.test(b.getAttribute("aria-label") ?? ""),
    )

  it("has an accessible name even though its text is hidden on phones", async () => {
    // The visible text is `hidden md:inline`, so below md the button would otherwise be
    // an unnamed icon (a WCAG 4.1.2 failure that also broke the phone e2e journey).
    await render("nominal")
    expect(trigger()).toBeTruthy()
    expect(trigger()!.getAttribute("aria-label")).toBe("Future Value, change display mode")
  })

  it("starts its name with the visible words, so the label is in the name", async () => {
    await render("nominal")
    const visible = trigger()!.textContent?.trim()
    expect(visible).toBe("Future Value")
    expect(trigger()!.getAttribute("aria-label")!.startsWith(visible!)).toBe(true)
  })

  it("follows the display mode", async () => {
    await render("real")
    expect(trigger()!.getAttribute("aria-label")).toBe("Today's Value, change display mode")
    expect(trigger()!.textContent?.trim()).toBe("Today's Value")
  })
})
