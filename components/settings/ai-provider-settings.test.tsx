import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test"
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { AiProviderSettings } from "./ai-provider-settings"
import { useAiSettingsStore } from "@/lib/store/ai-settings-store"

// Lets React's act() flush updates outside a test-library harness.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null
let container: HTMLElement | null = null

/** Client render (not server markup), so the zustand store's current state is used. */
function render(): Document {
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root!.render(<AiProviderSettings />))
  return document
}

afterEach(() => {
  act(() => root?.unmount())
  container?.remove()
  root = null
  container = null
})

function pressed(doc: Document, name: string): string | null {
  const button = [...doc.querySelectorAll("button")].find((b) => b.textContent?.trim() === name)
  if (!button) throw new Error(`no button "${name}"`)
  return button.getAttribute("aria-pressed")
}

describe("AiProviderSettings", () => {
  beforeEach(() => {
    useAiSettingsStore.getState().forgetKeys()
  })

  describe("regression: the selected option is exposed to assistive technology, not just by colour", () => {
    it("marks App default as pressed in hosted mode", () => {
      const doc = render()
      expect(pressed(doc, "App default")).toBe("true")
      expect(pressed(doc, "My own API key")).toBe("false")
    })

    it("marks My own API key and the chosen provider as pressed in own-key mode", () => {
      useAiSettingsStore.getState().update({ mode: "own", provider: "cloudflare" })
      const doc = render()
      expect(pressed(doc, "App default")).toBe("false")
      expect(pressed(doc, "My own API key")).toBe("true")
      expect(pressed(doc, "Cloudflare Workers AI")).toBe("true")
      expect(pressed(doc, "Vercel AI Gateway")).toBe("false")
    })

    it("names each button group by its visible label", () => {
      useAiSettingsStore.getState().update({ mode: "own" })
      const doc = render()
      const names = [...doc.querySelectorAll('[role="group"]')].map((group) => {
        const labelId = group.getAttribute("aria-labelledby") ?? ""
        return doc.getElementById(labelId)?.textContent?.trim()
      })
      expect(names).toEqual(["Explain My Plan uses", "Provider"])
    })
  })

  it("shows no key fields in hosted mode", () => {
    const doc = render()
    expect(doc.querySelector('input[type="password"]')).toBeNull()
  })

  it("uses new-password autocomplete on the key field so the site login isn't autofilled", () => {
    useAiSettingsStore.getState().update({ mode: "own" })
    const doc = render()
    expect(doc.querySelector('input[type="password"]')?.getAttribute("autocomplete")).toBe(
      "new-password",
    )
  })
})
