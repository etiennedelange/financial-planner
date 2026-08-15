import { createJSONStorage, type PersistStorage } from "zustand/middleware"

// Zustand's persist middleware writes to storage on EVERY set() — including
// auth-driven calls such as setSessionId() that SupabaseProvider fires while
// the layout's manual rehydrate() (skipHydration: true) is still reading.
// Those writes persist the store's pre-hydration DEFAULT state and clobber the
// user's saved data before rehydrate ever reads it back, so a reload wipes the
// plan. This wrapper drops all writes until the first rehydrate has settled
// (released via onRehydrateStorage in each store), which makes the clobbering
// structurally impossible rather than timing-dependent.
export function createGatedPersistStorage<S>(): (PersistStorage<S> & { release: () => void }) | undefined {
  try {
    let released = false
    const inner = createJSONStorage<S>(() => window.localStorage)
    if (!inner) return undefined
    return {
      getItem: (name) => inner.getItem(name),
      setItem: (name, value) => {
        if (!released) return undefined
        return inner.setItem(name, value)
      },
      removeItem: (name) => inner.removeItem(name),
      release: () => {
        released = true
      },
    }
  } catch {
    // No window.localStorage (e.g. SSR) — mirror zustand's own behaviour of
    // degrading to a non-persistent store.
    return undefined
  }
}
