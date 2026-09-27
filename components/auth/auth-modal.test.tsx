import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"


vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: {} }),
}))
vi.mock("@/components/auth/turnstile", async () => {
  const { forwardRef } = await import("react")
  return { Turnstile: forwardRef(function Turnstile() { return <div data-testid="turnstile" /> }) }
})
vi.mock("@/components/auth/finance-animation", () => ({ FinanceAnimation: () => null }))

import { AuthModal } from "./auth-modal"

describe("AuthModal feature flag", () => {
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
    vi.unstubAllEnvs()
  })

  async function renderOpen() {
    await act(async () => {
      root.render(<AuthModal open onClose={() => {}} />)
    })
  }

  it("disables every control and skips the captcha when auth is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", undefined)
    await renderOpen()

    expect(document.body.textContent).toContain("Accounts are coming soon")
    expect(document.querySelector("[data-testid=turnstile]")).toBeNull()
    const fieldset = document.querySelector("fieldset")
    expect(fieldset?.disabled).toBe(true)
    const submit = document.querySelector<HTMLButtonElement>("button[type=submit]")
    expect(submit?.textContent).toBe("Coming soon")
  })

  it("renders the live form with captcha when auth is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    await renderOpen()

    expect(document.body.textContent).toContain("Sign in to your account to continue")
    expect(document.querySelector("[data-testid=turnstile]")).not.toBeNull()
    expect(document.querySelector("fieldset")?.disabled).toBe(false)
  })
})
