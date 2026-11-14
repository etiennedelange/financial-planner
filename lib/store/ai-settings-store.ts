"use client"

import { useEffect } from "react"
import { create } from "zustand"
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware"
import { DEFAULT_AI_KEY_SETTINGS, type AiKeySettings } from "@/lib/ai/own-key"

export const AI_SETTINGS_STORAGE_KEY = "financial-planner-ai-key"

export interface AiSettingsState extends AiKeySettings {
  /** Keep the key after the browser closes (localStorage) instead of only for this session. */
  remember: boolean
  update: (patch: Partial<AiKeySettings & { remember: boolean }>) => void
  /** Wipes every stored key and returns to the hosted provider. */
  forgetKeys: () => void
}

function rememberFlag(serialized: string): boolean {
  try {
    const parsed = JSON.parse(serialized) as { state?: { remember?: unknown } }
    return parsed.state?.remember === true
  } catch {
    return false
  }
}

/**
 * Keeps the key in sessionStorage unless the user opts in to "remember", so by
 * default it is gone when the browser closes. The key never leaves the browser
 * except as a header on the user's own narrative request.
 *
 * This is deliberately device-scoped, not account-scoped: it is the person's
 * own credential for their own provider account, not plan data.
 */
export function createKeyStorage(
  getLocal: () => Storage | undefined,
  getSession: () => Storage | undefined,
): StateStorage {
  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn()
    } catch {
      return fallback
    }
  }
  return {
    getItem: (name) =>
      safe(() => getLocal()?.getItem(name) ?? getSession()?.getItem(name) ?? null, null),
    setItem: (name, value) => {
      const remember = rememberFlag(value)
      const [keep, drop] = remember ? [getLocal, getSession] : [getSession, getLocal]
      safe(() => drop()?.removeItem(name), undefined)
      safe(() => keep()?.setItem(name, value), undefined)
    },
    removeItem: (name) => {
      safe(() => getLocal()?.removeItem(name), undefined)
      safe(() => getSession()?.removeItem(name), undefined)
    },
  }
}

const browserStorage = (kind: "localStorage" | "sessionStorage") => () =>
  typeof window === "undefined" ? undefined : window[kind]

export const useAiSettingsStore = create<AiSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_AI_KEY_SETTINGS,
      remember: false,
      update: (patch) => set(patch),
      forgetKeys: () => set({ ...DEFAULT_AI_KEY_SETTINGS, remember: false }),
    }),
    {
      name: AI_SETTINGS_STORAGE_KEY,
      version: 1,
      // Rehydrated from an effect (useAiSettingsHydration), never at module load:
      // reading storage before hydration would render different markup on the
      // client than the server sent.
      skipHydration: true,
      storage: createJSONStorage(() =>
        createKeyStorage(browserStorage("localStorage"), browserStorage("sessionStorage")),
      ),
      partialize: ({
        mode,
        provider,
        gatewayApiKey,
        cloudflareAccountId,
        cloudflareApiToken,
        remember,
      }) => ({
        mode,
        provider,
        gatewayApiKey,
        cloudflareAccountId,
        cloudflareApiToken,
        remember,
      }),
    },
  ),
)

let hydrationStarted = false

/** Loads the saved key once, after mount. Safe to call from every consumer. */
export function useAiSettingsHydration(): void {
  useEffect(() => {
    if (hydrationStarted) return
    hydrationStarted = true
    void useAiSettingsStore.persist.rehydrate()
  }, [])
}

/** The plain settings object, without the store's actions. */
export function selectAiKeySettings(state: AiSettingsState): AiKeySettings {
  return {
    mode: state.mode,
    provider: state.provider,
    gatewayApiKey: state.gatewayApiKey,
    cloudflareAccountId: state.cloudflareAccountId,
    cloudflareApiToken: state.cloudflareApiToken,
  }
}
