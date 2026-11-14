import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"

// The provider hydrates once per module instance, so each test imports a fresh copy
// (and fresh stores) to start from a clean, un-hydrated state.
async function setup() {
  vi.resetModules()
  const provider = await import("./local-data-provider")
  const calc = await import("@/lib/store/calculator-store")
  const exp = await import("@/lib/store/expenses-store")
  return { ...provider, calc, exp }
}

const PLAN = (age: number) =>
  JSON.stringify({
    state: {
      personalInfo: {
        currentAge: age,
        retirementAge: 65,
        lifeExpectancy: 90,
        annualIncome: 600000,
      },
    },
    version: 4,
  })

describe("LocalDataProvider", () => {
  let host: HTMLElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.restoreAllMocks()
  })

  async function mount(setupResult: Awaited<ReturnType<typeof setup>>) {
    const { LocalDataProvider, useStoresHydrated } = setupResult
    function Probe() {
      return <span data-testid="probe">{String(useStoresHydrated())}</span>
    }
    await act(async () => {
      root.render(
        <LocalDataProvider>
          <Probe />
        </LocalDataProvider>,
      )
    })
    await act(async () => {}) // let the hydration promise settle
  }

  const probe = () => host.querySelector("[data-testid=probe]")!.textContent

  it("reports hydrated only after both stores were read back from localStorage", async () => {
    localStorage.setItem("financial-planner-storage", PLAN(51))
    const s = await setup()
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).not.toBe(51)
    await mount(s)
    expect(probe()).toBe("true")
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).toBe(51)
  })

  it("migrates data saved under the old :guest key and purges account leftovers first", async () => {
    localStorage.setItem("financial-planner-storage:guest", PLAN(47))
    localStorage.setItem("financial-planner-storage:user:abc", PLAN(30))
    localStorage.setItem("sb-x-auth-token", "t")
    const s = await setup()
    await mount(s)
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).toBe(47)
    expect(localStorage.getItem("financial-planner-storage:guest")).toBeNull()
    expect(localStorage.getItem("financial-planner-storage:user:abc")).toBeNull()
    expect(localStorage.getItem("sb-x-auth-token")).toBeNull()
  })

  it("starts cleanly when there is nothing saved", async () => {
    const s = await setup()
    await mount(s)
    expect(probe()).toBe("true")
    expect(s.exp.useExpensesStore.getState().groups).toEqual([])
  })

  it("pulls in a change made by ANOTHER tab instead of overwriting it later", async () => {
    localStorage.setItem("financial-planner-storage", PLAN(40))
    const s = await setup()
    await mount(s)
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).toBe(40)

    // Another tab saved a newer plan.
    localStorage.setItem("financial-planner-storage", PLAN(58))
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "financial-planner-storage" }))
    })
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).toBe(58)
  })

  it("syncs expenses changes from another tab too", async () => {
    const s = await setup()
    await mount(s)
    localStorage.setItem(
      "expenses-store-v2",
      JSON.stringify({ state: { groups: [], expenses: [], monthlyIncome: 12345 }, version: 2 }),
    )
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "expenses-store-v2" }))
    })
    expect(s.exp.useExpensesStore.getState().monthlyIncome).toBe(12345)
  })

  it("ignores storage events for unrelated keys", async () => {
    localStorage.setItem("financial-planner-storage", PLAN(40))
    const s = await setup()
    await mount(s)
    localStorage.setItem("financial-planner-storage", PLAN(70))
    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "theme" }))
    })
    expect(s.calc.useCalculatorStore.getState().personalInfo.currentAge).toBe(40)
  })

  it("reloads when another tab cleared ALL data, so stale memory can't be written back", async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { reload } as unknown as Location,
    })
    try {
      const s = await setup()
      await mount(s)
      await act(async () => {
        window.dispatchEvent(new StorageEvent("storage", { key: null }))
      })
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original })
    }
  })

  it("asks the browser for persistent storage, and survives browsers without the API", async () => {
    const persist = vi.fn().mockResolvedValue(true)
    Object.defineProperty(navigator, "storage", { configurable: true, value: { persist } })
    const s = await setup()
    await mount(s)
    expect(persist).toHaveBeenCalledTimes(1)
    Object.defineProperty(navigator, "storage", { configurable: true, value: undefined })
    act(() => root.unmount())
    root = createRoot(host)
    const s2 = await setup()
    await mount(s2)
    expect(probe()).toBe("true") // no throw without navigator.storage
  })

  it("removes its storage listener on unmount", async () => {
    const remove = vi.spyOn(window, "removeEventListener")
    const s = await setup()
    await mount(s)
    act(() => root.unmount())
    expect(remove).toHaveBeenCalledWith("storage", expect.any(Function))
    root = createRoot(host) // keep afterEach's unmount valid
  })
})
