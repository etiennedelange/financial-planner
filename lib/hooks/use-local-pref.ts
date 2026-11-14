"use client"

import { useCallback, useSyncExternalStore } from "react"

// A small, NON-secret string preference kept in localStorage (e.g. which AI mode is on).
// Built on useSyncExternalStore so every component reading the same key stays in sync
// (the Settings page and the Overview card), other tabs' changes arrive via `storage`
// events, and the server render + hydration use the fallback — no hydration mismatch.
// If storage is blocked the value is kept in memory for the session.

const memory = new Map<string, string>()
const listeners = new Set<() => void>()

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

function read(key: string): string | null {
  const inMemory = memory.get(key)
  if (inMemory !== undefined) return inMemory
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function useLocalPref<T extends string>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const stored = read(key)
      return isValid(stored) ? stored : fallback
    },
    () => fallback,
  )

  const set = useCallback(
    (next: T) => {
      memory.set(key, next)
      try {
        window.localStorage.setItem(key, next)
      } catch {
        // Blocked storage: the in-memory copy still applies for this session.
      }
      for (const listener of listeners) listener()
    },
    [key],
  )

  return [value, set]
}

/** Test helper. */
export function __resetLocalPrefsForTests(): void {
  memory.clear()
  listeners.clear()
}
