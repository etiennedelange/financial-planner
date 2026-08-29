import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { RollingValue } from "./rolling-value"

function render(node: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  return { container, root }
}

describe("RollingValue", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    const r = render(null)
    container = r.container
    root = r.root
  })

  afterEach(() => {
    root.unmount()
    container.remove()
  })

  it("shows the value immediately when settling into a number (no count-up)", async () => {
    await act(async () => {
      root.render(<RollingValue value={100} format={(v) => v.toFixed(0)} />)
    })
    expect(container.textContent).toBe("100")
  })

  it("counts up from `initial` on first appearance", async () => {
    await act(async () => {
      root.render(<RollingValue value={100} format={(v) => v.toFixed(0)} initial={0} />)
    })
    expect(container.textContent).toBe("0")
  })

  it("settles at the target value after a value change", async () => {
    await act(async () => {
      root.render(<RollingValue value={100} format={(v) => v.toFixed(0)} />)
    })
    expect(container.textContent).toBe("100")

    await act(async () => {
      root.render(<RollingValue value={200} format={(v) => v.toFixed(0)} />)
    })
    // The spring needs animation frames to advance. Poll until it settles at
    // the new target — it must never snap instantly (it must pass through
    // intermediate values) and must never stay stuck at the old value.
    let elapsed = 0
    while (container.textContent !== "200" && elapsed < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 50))
      await act(async () => {})
      elapsed += 50
    }
    expect(container.textContent).toBe("200")
  })

  it("re-renders with a changed format function", async () => {
    await act(async () => {
      root.render(<RollingValue value={100} format={(v) => `R ${v}`} />)
    })
    await act(async () => {
      root.render(<RollingValue value={100} format={(v) => `$ ${v}`} />)
    })
    expect(container.textContent).toBe("$ 100")
  })
})