import { createJSONStorage, type PersistStorage } from "zustand/middleware"

// Zustand's persist middleware writes to storage on EVERY set(). Both stores use
// `skipHydration: true` and are rehydrated manually by <StoreHydrator>, so any
// set() that lands BEFORE that first rehydrate settles would persist the store's
// pre-hydration DEFAULT state and clobber the user's saved data before it is ever
// read back. This wrapper drops every write until the first rehydrate has settled
// (released via onRehydrateStorage in each store), which makes the clobbering
// structurally impossible rather than timing-dependent.
//
// Failures (quota exceeded, storage blocked) are reported through the storage-health
// channel, keyed by storage key, so a later successful save of a DIFFERENT store
// cannot hide that this store's latest save never reached storage.
import { reportStorageFailure, reportStorageSuccess } from "@/lib/store/storage-health"

export type GatedPersistStorage<S> = PersistStorage<S> & {
  release: () => void
}

export function createGatedPersistStorage<S>(): GatedPersistStorage<S> | undefined {
  try {
    let released = false
    const inner = createJSONStorage<S>(() => window.localStorage)
    if (!inner) return undefined
    return {
      getItem: (name) => inner.getItem(name),
      setItem: (name, value) => {
        if (!released) return undefined
        try {
          const result = inner.setItem(name, value)
          reportStorageSuccess(name)
          return result
        } catch (error) {
          reportStorageFailure(error, name)
          return undefined
        }
      },
      removeItem: (name) => inner.removeItem(name),
      release: () => {
        released = true
      },
    }
  } catch {
    // No window.localStorage (SSR, or access throws when storage is blocked) —
    // mirror zustand's own behaviour of degrading to a non-persistent store.
    return undefined
  }
}
