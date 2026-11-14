import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { FloatingActionBar } from "./floating-action-bar"

describe("FloatingActionBar scroll hiding", () => {
  let host: HTMLElement
  let scroller: HTMLElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      cb(0)
      return 0
    })
    // The real layout: an outer <main> from the root layout that does NOT scroll, around
    // the app shell's scroll container
    host = document.createElement("div")
    host.innerHTML = `<main><div data-app-scroller></div></main>`
    document.body.appendChild(host)
    scroller = host.querySelector("[data-app-scroller]") as HTMLElement
    const mount = document.createElement("div")
    scroller.appendChild(mount)
    root = createRoot(mount)
  })

  afterEach(() => {
    act(() => root.unmount())
    host.remove()
    vi.unstubAllGlobals()
  })

  const bar = () => scroller.querySelector("div.fixed") as HTMLElement

  it("hides when the app's scroll container scrolls down, and returns on scroll up", () => {
    act(() => root.render(<FloatingActionBar primary={{ label: "Save", onClick: () => {} }} />))
    expect(bar().className).toContain("translate-y-0")

    scroller.scrollTop = 300
    act(() => void scroller.dispatchEvent(new Event("scroll")))
    expect(bar().className).toContain("translate-y-full")

    scroller.scrollTop = 100
    act(() => void scroller.dispatchEvent(new Event("scroll")))
    expect(bar().className).toContain("translate-y-0")
  })

  it("is not fooled by an outer <main> that never scrolls", () => {
    act(() => root.render(<FloatingActionBar primary={{ label: "Save", onClick: () => {} }} />))
    const outerMain = host.querySelector("main") as HTMLElement
    outerMain.scrollTop = 300
    act(() => void outerMain.dispatchEvent(new Event("scroll")))
    expect(bar().className).toContain("translate-y-0")
  })
})
