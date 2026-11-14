import { describe, it, expect, beforeEach } from "vite-plus/test"
import {
  AI_SETTINGS_STORAGE_KEY,
  createKeyStorage,
  selectAiKeySettings,
  useAiSettingsStore,
} from "./ai-settings-store"

class MemoryStorage implements Storage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  clear() {
    this.map.clear()
  }
  getItem(key: string) {
    return this.map.get(key) ?? null
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.map.delete(key)
  }
  setItem(key: string, value: string) {
    this.map.set(key, value)
  }
}

const serialized = (remember: boolean) =>
  JSON.stringify({ state: { remember, gatewayApiKey: "k" } })

describe("createKeyStorage", () => {
  let local: MemoryStorage
  let session: MemoryStorage
  beforeEach(() => {
    local = new MemoryStorage()
    session = new MemoryStorage()
  })

  it("keeps the key in sessionStorage by default", () => {
    const storage = createKeyStorage(
      () => local,
      () => session,
    )
    storage.setItem("k", serialized(false))
    expect(session.getItem("k")).toBe(serialized(false))
    expect(local.getItem("k")).toBeNull()
  })

  it("moves the key to localStorage when remember is on, and back when it is turned off", () => {
    const storage = createKeyStorage(
      () => local,
      () => session,
    )
    storage.setItem("k", serialized(true))
    expect(local.getItem("k")).toBe(serialized(true))
    expect(session.getItem("k")).toBeNull()

    storage.setItem("k", serialized(false))
    expect(local.getItem("k")).toBeNull()
    expect(session.getItem("k")).toBe(serialized(false))
  })

  it("treats an unparseable value as not remembered", () => {
    const storage = createKeyStorage(
      () => local,
      () => session,
    )
    storage.setItem("k", "{not json")
    expect(local.getItem("k")).toBeNull()
    expect(session.getItem("k")).toBe("{not json")
  })

  it("reads localStorage first, then sessionStorage", () => {
    const storage = createKeyStorage(
      () => local,
      () => session,
    )
    session.setItem("k", "session")
    expect(storage.getItem("k")).toBe("session")
    local.setItem("k", "local")
    expect(storage.getItem("k")).toBe("local")
  })

  it("removes from both", () => {
    const storage = createKeyStorage(
      () => local,
      () => session,
    )
    local.setItem("k", "a")
    session.setItem("k", "b")
    storage.removeItem("k")
    expect(local.getItem("k")).toBeNull()
    expect(session.getItem("k")).toBeNull()
  })

  it("survives unavailable or throwing storage (private mode, SSR)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
      removeItem: () => {
        throw new Error("blocked")
      },
    } as unknown as Storage
    const storage = createKeyStorage(
      () => throwing,
      () => undefined,
    )
    expect(storage.getItem("k")).toBeNull()
    expect(() => storage.setItem("k", serialized(true))).not.toThrow()
    expect(() => storage.removeItem("k")).not.toThrow()
  })
})

describe("useAiSettingsStore", () => {
  beforeEach(() => {
    useAiSettingsStore.getState().forgetKeys()
    window.localStorage.clear()
    window.sessionStorage.clear()
  })

  it("defaults to the hosted provider with no keys", () => {
    expect(selectAiKeySettings(useAiSettingsStore.getState())).toEqual({
      mode: "hosted",
      provider: "gateway",
      gatewayApiKey: "",
      cloudflareAccountId: "",
      cloudflareApiToken: "",
    })
    expect(useAiSettingsStore.getState().remember).toBe(false)
  })

  it("persists edits to sessionStorage unless remember is on", () => {
    useAiSettingsStore.getState().update({ mode: "own", gatewayApiKey: "vck_abc12345" })
    expect(window.sessionStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toContain("vck_abc12345")
    expect(window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBeNull()

    useAiSettingsStore.getState().update({ remember: true })
    expect(window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toContain("vck_abc12345")
    expect(window.sessionStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBeNull()
  })

  it("forgetKeys wipes every key and returns to hosted mode", () => {
    useAiSettingsStore.getState().update({
      mode: "own",
      provider: "cloudflare",
      gatewayApiKey: "vck_abc12345",
      cloudflareApiToken: "cf-token-123",
      cloudflareAccountId: "0123456789abcdef0123456789abcdef",
      remember: true,
    })
    useAiSettingsStore.getState().forgetKeys()
    const state = useAiSettingsStore.getState()
    expect(state.mode).toBe("hosted")
    expect(state.gatewayApiKey + state.cloudflareApiToken + state.cloudflareAccountId).toBe("")
    expect(window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY) ?? "").not.toContain("cf-token")
  })

  it("does not persist the store's actions", () => {
    useAiSettingsStore.getState().update({ gatewayApiKey: "vck_abc12345" })
    const raw = JSON.parse(window.sessionStorage.getItem(AI_SETTINGS_STORAGE_KEY) ?? "{}")
    expect(Object.keys(raw.state).sort()).toEqual(
      [
        "cloudflareAccountId",
        "cloudflareApiToken",
        "gatewayApiKey",
        "mode",
        "provider",
        "remember",
      ].sort(),
    )
  })

  it("rehydrates a remembered key from localStorage and a session key from sessionStorage", async () => {
    const saved = (remember: boolean, key: string) =>
      JSON.stringify({
        state: {
          mode: "own",
          provider: "gateway",
          gatewayApiKey: key,
          cloudflareAccountId: "",
          cloudflareApiToken: "",
          remember,
        },
        version: 1,
      })

    window.sessionStorage.setItem(AI_SETTINGS_STORAGE_KEY, saved(false, "vck_session_1"))
    await useAiSettingsStore.persist.rehydrate()
    expect(useAiSettingsStore.getState().gatewayApiKey).toBe("vck_session_1")
    expect(useAiSettingsStore.getState().mode).toBe("own")

    window.sessionStorage.clear()
    window.localStorage.setItem(AI_SETTINGS_STORAGE_KEY, saved(true, "vck_local_1"))
    await useAiSettingsStore.persist.rehydrate()
    expect(useAiSettingsStore.getState().gatewayApiKey).toBe("vck_local_1")
    expect(useAiSettingsStore.getState().remember).toBe(true)
  })

  it("does not read storage until asked (hydration is deferred to after mount)", () => {
    expect(useAiSettingsStore.persist.getOptions().skipHydration).toBe(true)
  })
})
