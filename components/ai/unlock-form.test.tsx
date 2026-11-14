import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { __resetVaultForTests, getKey, lock, saveEncrypted } from "@/lib/ai/key-vault"
import { setInputValue, submitForm } from "@/lib/test-utils/dom"
import { UnlockForm } from "./unlock-form"

const KEY = "sk-ant-api03-UNLOCK-FORM-TEST-0123456789"
const PASS = "a sufficiently long passphrase"

/**
 * PBKDF2 (600k iterations) takes real time: wait for any "Saving…"/"Unlocking…" button to
 * settle. The poll must sit OUTSIDE act(): React holds state updates until an act scope exits.
 */
async function waitIdle(host: HTMLElement) {
  await vi.waitFor(
    async () => {
      await act(async () => {})
      const busy = [...host.querySelectorAll("button")].some((b) => b.textContent?.endsWith("…"))
      if (busy) throw new Error("still working")
    },
    { timeout: 15000, interval: 25 },
  )
}

describe("UnlockForm", () => {
  let host: HTMLElement
  let root: Root
  const onUnlocked = vi.fn()

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    __resetVaultForTests()
    onUnlocked.mockClear()
    await saveEncrypted("anthropic", KEY, PASS)
    lock("anthropic")
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    act(() => root.render(<UnlockForm provider="anthropic" onUnlocked={onUnlocked} />))
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const input = () => host.querySelector("input")!
  const button = () => host.querySelector("button")!
  const submit = async () => {
    await act(async () => submitForm(host.querySelector("form")!))
    await waitIdle(host)
  }

  it("is a real password field with the right autocomplete purpose, and needs input to submit", () => {
    expect(input().type).toBe("password")
    expect(input().autocomplete).toBe("current-password")
    expect(button().disabled).toBe(true)
    act(() => setInputValue(input(), "x"))
    expect(button().disabled).toBe(false)
  })

  it("unlocks with the right passphrase, clears the field and reports success", async () => {
    act(() => setInputValue(input(), PASS))
    await submit()
    expect(getKey("anthropic")).toBe(KEY)
    expect(input().value).toBe("")
    expect(onUnlocked).toHaveBeenCalledTimes(1)
  })

  it("rejects a wrong passphrase with a generic message and stays locked", async () => {
    act(() => setInputValue(input(), "definitely the wrong one"))
    await submit()
    expect(host.querySelector("[role=alert]")!.textContent).toBe("Wrong passphrase.")
    expect(getKey("anthropic")).toBeNull()
    expect(onUnlocked).not.toHaveBeenCalled()
  })

  it("reports a missing saved key instead of crashing", async () => {
    localStorage.clear()
    act(() => setInputValue(input(), PASS))
    await submit()
    expect(host.querySelector("[role=alert]")!.textContent).toContain("no saved key")
  })
})
