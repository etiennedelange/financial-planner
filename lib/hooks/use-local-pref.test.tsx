import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"
import { installFailingSetItem } from "@/lib/test-utils/failing-storage"
import { __resetLocalPrefsForTests, useLocalPref } from "./use-local-pref"

type Color = "red" | "green"
const isColor = (v: unknown): v is Color => v === "red" || v === "green"

function Reader({ id }: { id: string }) {
  const [value, setValue] = useLocalPref<Color>("test-color", "red", isColor)
  return (
    <button data-testid={id} onClick={() => setValue("green")}>
      {value}
    </button>
  )
}

describe("useLocalPref", () => {
  let host: HTMLElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    __resetLocalPrefsForTests()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const text = (id: string) => host.querySelector(`[data-testid=${id}]`)!.textContent

  it("uses the fallback when nothing is stored", () => {
    act(() => root.render(<Reader id="a" />))
    expect(text("a")).toBe("red")
  })

  it("reads a stored value, and ignores an invalid one", () => {
    localStorage.setItem("test-color", "green")
    act(() => root.render(<Reader id="a" />))
    expect(text("a")).toBe("green")
    act(() => root.unmount())
    root = createRoot(host)
    localStorage.setItem("test-color", "purple")
    act(() => root.render(<Reader id="a" />))
    expect(text("a")).toBe("red")
  })

  it("persists a change and updates EVERY component reading the key", () => {
    act(() =>
      root.render(
        <>
          <Reader id="a" />
          <Reader id="b" />
        </>,
      ),
    )
    act(() => (host.querySelector("[data-testid=a]") as HTMLElement).click())
    expect(text("a")).toBe("green")
    expect(text("b")).toBe("green")
    expect(localStorage.getItem("test-color")).toBe("green")
  })

  it("follows a change made in another tab (storage event)", () => {
    act(() => root.render(<Reader id="a" />))
    localStorage.setItem("test-color", "green")
    act(() => void window.dispatchEvent(new StorageEvent("storage", { key: "test-color" })))
    expect(text("a")).toBe("green")
  })

  it("still works for the session when storage is blocked", () => {
    const restore = installFailingSetItem(new DOMException("denied", "SecurityError"))
    try {
      act(() => root.render(<Reader id="a" />))
      act(() => (host.querySelector("[data-testid=a]") as HTMLElement).click())
      expect(text("a")).toBe("green")
    } finally {
      restore()
    }
  })
})
