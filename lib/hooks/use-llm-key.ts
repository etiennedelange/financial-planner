"use client"

import { useSyncExternalStore } from "react"
import { getStatus, subscribeVault, type KeyStatus } from "@/lib/ai/key-vault"
import {
  DEFAULT_NARRATIVE_MODE,
  isNarrativeMode,
  NARRATIVE_MODE_KEY,
  type NarrativeMode,
} from "@/lib/ai/narrative-mode"
import { PROVIDER_IDS, type ProviderId } from "@/lib/ai/providers/origins"
import { useLocalPref } from "@/lib/hooks/use-local-pref"

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
  return useLocalPref(PROVIDER_KEY, DEFAULT_PROVIDER, isProvider)
}

/** How the plan summary is produced (copy a prompt / own API key). */
export function useNarrativeMode(): [NarrativeMode, (next: NarrativeMode) => void] {
  return useLocalPref(NARRATIVE_MODE_KEY, DEFAULT_NARRATIVE_MODE, isNarrativeMode)
}
