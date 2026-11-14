"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { useCalculatorStore, CALCULATOR_STORAGE_KEY } from "@/lib/store/calculator-store"
import { useExpensesStore, EXPENSES_STORAGE_KEY } from "@/lib/store/expenses-store"
import { probeStorage } from "@/lib/store/storage-health"

const HydratedContext = createContext(false)

/** True once both stores have been read back from localStorage. */
export function useStoresHydrated(): boolean {
  return useContext(HydratedContext)
}

// Both stores use `skipHydration` (the server renders defaults), so the browser
// rehydrates them here, exactly once. No account,
// no network: the data never leaves this browser.
/**
 * Rehydrates one store and NEVER rejects. When localStorage is unusable, zustand's
 * non-persistent fallback has no `persist` API at all, so reading it throws; that is
 * "nothing to read", not a reason to leave the page blank. The storage-health probe
 * already tells the user that nothing is being saved.
 */
function rehydrateSafely(read: () => unknown): Promise<void> {
  return new Promise<void>((resolve) => {
    try {
      Promise.resolve(read()).then(
        () => resolve(),
        () => resolve(),
      )
    } catch {
      resolve()
    }
  })
}

/**
 * Whether `key` is still present in localStorage. Unreadable storage counts as present,
 * so a blocked browser never triggers a reload loop; there is nothing to reload into.
 */
function storageHas(key: string): boolean {
  try {
    return window.localStorage.getItem(key) !== null
  } catch {
    return true
  }
}

let hydration: Promise<void> | null = null
function hydrateOnce(): Promise<void> {
  if (!hydration) {
    hydration = (async () => {
      probeStorage()
      // Ask the browser not to evict this data under storage pressure. With no server
      // copy, eviction is data loss. Best-effort: the browser may decline silently.
      try {
        void navigator.storage?.persist?.()
      } catch {
        // Unsupported — the backup nudge is the fallback.
      }
      await Promise.all([
        rehydrateSafely(() => useCalculatorStore.persist.rehydrate()),
        rehydrateSafely(() => useExpensesStore.persist.rehydrate()),
      ])
    })()
  }
  return hydration
}

export function LocalDataProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    let cancelled = false
    void hydrateOnce().then(() => {
      if (!cancelled) setHydrated(true)
    })

    // Another tab saved: pull its data in instead of clobbering it with this
    // tab's stale in-memory copy on the next write. `storage` events fire only in
    // OTHER tabs, so there is no feedback loop.
    const onStorage = (event: StorageEvent) => {
      // A watched key that is now absent was cleared in another tab (clear-all removes
      // keys one by one). Rehydrating would keep this tab's stale copy in memory and
      // write it back on the next edit, so reload and let cleared data stay cleared.
      if (
        (event.key === CALCULATOR_STORAGE_KEY || event.key === EXPENSES_STORAGE_KEY) &&
        !storageHas(event.key)
      ) {
        window.location.reload()
      } else if (event.key === CALCULATOR_STORAGE_KEY)
        void rehydrateSafely(() => useCalculatorStore.persist.rehydrate())
      else if (event.key === EXPENSES_STORAGE_KEY)
        void rehydrateSafely(() => useExpensesStore.persist.rehydrate())
      else if (event.key === null) {
        // localStorage.clear() in another tab ("Clear all local data"). Rehydrating
        // from an empty store would keep this tab's stale copy in memory and write
        // it straight back on the next edit — reload so cleared data stays cleared.
        window.location.reload()
      }
    }
    window.addEventListener("storage", onStorage)
    return () => {
      cancelled = true
      window.removeEventListener("storage", onStorage)
    }
  }, [])

  return <HydratedContext.Provider value={hydrated}>{children}</HydratedContext.Provider>
}
