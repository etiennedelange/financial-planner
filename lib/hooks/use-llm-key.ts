"use client"

import { useCallback, useState, useSyncExternalStore } from "react"
import { getStatus, subscribeVault, type KeyStatus } from "@/lib/ai/key-vault"
import { PROVIDER_IDS, type ProviderId } from "@/lib/ai/providers/origins"

const PROVIDER_KEY = "plan-narrative-provider"
const DEFAULT_PROVIDER: ProviderId = "anthropic"

function isProvider(value: unknown): value is ProviderId {
  return typeof value === "string" && (PROVIDER_IDS as string[]).includes(value)
}

/** Reactive status of the saved key for a provider ("none" | "locked" | "session" | "unlocked"). */
export function useKeyStatus(provider: ProviderId): KeyStatus {
  // The snapshot is a primitive string, so React only re-renders when the status
  // actually changes. Server snapshot is "none" so SSR and hydration agree.
  return useSyncExternalStore(
    subscribeVault,
    () => getStatus(provider),
    () => "none" as KeyStatus,
  )
}

/** The user's chosen provider — a non-secret preference, so it is fine in localStorage. */
export function useProviderChoice(): [ProviderId, (next: ProviderId) => void] {
  const [provider, setProviderState] = useState<ProviderId>(() => {
    try {
      const stored = window.localStorage.getItem(PROVIDER_KEY)
      return isProvider(stored) ? stored : DEFAULT_PROVIDER
    } catch {
      return DEFAULT_PROVIDER
    }
  })
  const setProvider = useCallback((next: ProviderId) => {
    setProviderState(next)
    try {
      window.localStorage.setItem(PROVIDER_KEY, next)
    } catch {
      // Preference only — losing it just resets to the default.
    }
  }, [])
  return [provider, setProvider]
}
