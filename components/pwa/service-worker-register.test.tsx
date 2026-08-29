import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ServiceWorkerRegister } from "./service-worker-register"

function render(node: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  return { container, root }
}

describe("ServiceWorkerRegister", () => {
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
    vi.unstubAllEnvs()
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker
  })

  it("registers /sw.js in production when service workers are supported", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const register = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" })
  })

  it("does not register outside production builds", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const register = vi.fn()
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(register).not.toHaveBeenCalled()
  })

  it("does not register when service workers are unsupported", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(container.textContent).toBe("")
  })
})
