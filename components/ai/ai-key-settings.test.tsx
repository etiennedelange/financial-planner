import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import { __resetVaultForTests, getKey, getStatus, VAULT_PREFIX } from "@/lib/ai/key-vault"
import { __resetLocalPrefsForTests } from "@/lib/hooks/use-local-pref"
import { setInputValue, submitForm } from "@/lib/test-utils/dom"
import { AiKeySection } from "./ai-key-settings"

const KEY = "sk-ant-api03-SETTINGS-FORM-TEST-0123456789"
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

describe("AiKeySection (the API-key form)", () => {
  let host: HTMLElement
  let root: Root

  beforeEach(async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    __resetLocalPrefsForTests()
    __resetVaultForTests()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => root.render(<AiKeySection />))
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  const keyInput = () => host.querySelector<HTMLInputElement>("#ai-key")!
  const radio = (text: string) =>
    [...host.querySelectorAll<HTMLInputElement>("input[type=radio][name=ai-key-mode]")].find((r) =>
      r.closest("label")?.textContent?.includes(text),
    )!
  const passwordInputs = () =>
    [...host.querySelectorAll<HTMLInputElement>("input[type=password]")].filter(
      (i) => i.id !== "ai-key",
    )
  const status = () => host.querySelector("[data-testid=ai-key-status]")!.textContent
  const saveButton = () =>
    [...host.querySelectorAll("button")].find((b) => b.textContent?.match(/Save key|Saving/))!
  const alertText = () => host.querySelector("[role=alert]")?.textContent
  const save = async () => {
    await act(async () => submitForm(host.querySelector("form")!))
    await waitIdle(host)
  }
  const clickButton = async (text: string) => {
    const b = [...host.querySelectorAll("button")].find((x) => x.textContent?.includes(text))!
    await act(async () => b.click())
    await waitIdle(host)
  }

  it("starts with no key, a hardened key input, and Save disabled until something is typed", () => {
    expect(status()).toBe("No key saved.")
    expect(keyInput().type).toBe("password")
    expect(keyInput().autocomplete).toBe("new-password")
    expect(keyInput().getAttribute("spellcheck")).toBe("false")
    expect(keyInput().required).toBe(true)
    expect(saveButton().disabled).toBe(true)
    act(() => setInputValue(keyInput(), "x"))
    expect(saveButton().disabled).toBe(false)
  })

  it("defaults to session-only, which keeps the key in memory and clears the field", async () => {
    expect(radio("This session only").checked).toBe(true)
    act(() => setInputValue(keyInput(), KEY))
    await save()
    expect(getKey("anthropic")).toBe(KEY)
    expect(status()).toContain("this tab only")
    expect(keyInput().value).toBe("")
    expect(localStorage.length).toBe(0) // nothing at all is written, least of all the key
    for (let i = 0; i < localStorage.length; i++) {
      expect(localStorage.getItem(localStorage.key(i)!)).not.toContain("SETTINGS-FORM")
    }
  })

  it("rejects an invalid key with a friendly message and saves nothing", async () => {
    act(() => setInputValue(keyInput(), "sk-has a space-inside"))
    await save()
    expect(alertText()).toContain("doesn't look like a valid API key")
    expect(getStatus("anthropic")).toBe("none")
  })

  it("remember mode asks for a passphrase twice and refuses a mismatch", async () => {
    await act(async () => radio("Remember on this device").click())
    expect(passwordInputs()).toHaveLength(2)
    expect(passwordInputs()[0].autocomplete).toBe("new-password")
    act(() => setInputValue(keyInput(), KEY))
    act(() => setInputValue(passwordInputs()[0], PASS))
    act(() => setInputValue(passwordInputs()[1], PASS + "!"))
    await save()
    expect(alertText()).toBe("The passphrases don't match.")
    expect(getStatus("anthropic")).toBe("none")
  })

  it("remember mode refuses a short passphrase", async () => {
    await act(async () => radio("Remember on this device").click())
    act(() => setInputValue(keyInput(), KEY))
    act(() => setInputValue(passwordInputs()[0], "short"))
    act(() => setInputValue(passwordInputs()[1], "short"))
    await save()
    expect(alertText()).toContain("at least 12 characters")
    expect(localStorage.getItem(`${VAULT_PREFIX}anthropic`)).toBeNull()
  })

  it("remember mode stores only ciphertext, then supports lock → unlock → remove", async () => {
    await act(async () => radio("Remember on this device").click())
    act(() => setInputValue(keyInput(), KEY))
    act(() => setInputValue(passwordInputs()[0], PASS))
    act(() => setInputValue(passwordInputs()[1], PASS))
    await save()
    expect(status()).toContain("unlocked")
    const blob = localStorage.getItem(`${VAULT_PREFIX}anthropic`)!
    expect(blob).not.toContain("SETTINGS-FORM")
    expect(passwordInputs().every((i) => i.value === "")).toBe(true) // secrets not kept in the form

    await clickButton("Lock")
    expect(status()).toContain("encrypted")
    expect(getKey("anthropic")).toBeNull()

    const unlockInput = host.querySelector<HTMLInputElement>(
      'input[aria-label^="Passphrase to unlock"]',
    )!
    act(() => setInputValue(unlockInput, PASS))
    await clickButton("Unlock")
    expect(getKey("anthropic")).toBe(KEY)

    await clickButton("Remove key")
    expect(getStatus("anthropic")).toBe("none")
    expect(localStorage.getItem(`${VAULT_PREFIX}anthropic`)).toBeNull()
  })

  it("a locked saved key can be removed without unlocking it", async () => {
    await act(async () => radio("Remember on this device").click())
    act(() => setInputValue(keyInput(), KEY))
    act(() => setInputValue(passwordInputs()[0], PASS))
    act(() => setInputValue(passwordInputs()[1], PASS))
    await save()
    await clickButton("Lock")
    await clickButton("Remove saved key")
    expect(getStatus("anthropic")).toBe("none")
  })

  it("lets the user pick a provider and remembers it, with the spend-limit advice visible", async () => {
    expect(host.textContent).toContain("spending limit")
    expect(host.textContent).toContain("never sent to")
    localStorage.setItem("plan-narrative-provider", "openai")
    act(
      () =>
        void window.dispatchEvent(new StorageEvent("storage", { key: "plan-narrative-provider" })),
    )
    act(() => setInputValue(keyInput(), "sk-openai-test-key-0123456789"))
    await save()
    expect(getStatus("openai")).toBe("session")
    expect(getStatus("anthropic")).toBe("none")
  })
})
