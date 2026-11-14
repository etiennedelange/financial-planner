import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test"
import { __resetLocalPrefsForTests } from "@/lib/hooks/use-local-pref"
import { __resetVaultForTests } from "@/lib/ai/key-vault"

import { AiAssistantSettings } from "./ai-assistant-settings"

describe("AiAssistantSettings", () => {
  let host: HTMLElement
  let root: Root

  const mount = async () => {
    await act(async () => root.render(<AiAssistantSettings />))
    await act(async () => {}) // settle async status checks
  }
  const radio = (name: string, indexOrText: number | string) => {
    const radios = [...host.querySelectorAll<HTMLInputElement>(`input[name=${name}]`)]
    return typeof indexOrText === "number"
      ? radios[indexOrText]
      : radios.find((r) => r.closest("label")?.textContent?.includes(indexOrText))!
  }
  const choose = async (r: HTMLInputElement) => {
    await act(async () => r.click())
    await act(async () => {})
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    localStorage.clear()
    __resetLocalPrefsForTests()
    __resetVaultForTests()
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("defaults to copying a prompt — no key field, no model section", async () => {
    await mount()
    expect(radio("narrative-mode", 0).checked).toBe(true)
    expect(host.querySelector("#ai-key")).toBeNull()
  })

  it("offers exactly two modes, with the key option labelled advanced", async () => {
    await mount()
    const labels = [...host.querySelectorAll("input[name=narrative-mode]")].map(
      (r) => r.closest("label")!.textContent,
    )
    expect(labels).toHaveLength(2)
    expect(labels[0]).toContain("Copy a prompt")
    expect(labels[1]).toContain("advanced")
  })

  it("explains that the default needs no key and sends nothing from here", async () => {
    await mount()
    expect(host.textContent).toContain("No key, nothing sent from here")
    expect(host.textContent).toContain("subscription")
  })

  it("the advanced mode reveals the API-key form (and only then)", async () => {
    await mount()
    await choose(radio("narrative-mode", "advanced"))
    expect(localStorage.getItem("plan-narrative-mode")).toBe("key")
    expect(host.querySelector("#ai-key")).not.toBeNull()
    expect(host.textContent).toContain("spending limit")
    await choose(radio("narrative-mode", "Copy a prompt"))
    expect(host.querySelector("#ai-key")).toBeNull()
  })
})
