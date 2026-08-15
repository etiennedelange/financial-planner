import { createJSONStorage, type PersistStorage } from "zustand/middleware"
import { keyForActiveScope, registerGateReCloser } from "./persistence-scope"

// Zustand's persist middleware writes to storage on EVERY set() — including
// auth-driven calls such as setSessionId() that SupabaseProvider fires while
// the layout's manual rehydrate() (skipHydration: true) is still reading.
// Those writes persist the store's pre-hydration DEFAULT state and clobber the
// user's saved data before rehydrate ever reads it back, so a reload wipes the
// plan. This wrapper drops all writes until the first rehydrate has settled
// (released via onRehydrateStorage in each store), which makes the clobbering
// structurally impossible rather than timing-dependent.
//
// Scoping: the wrapper computes the actual storage key from the module-level
// active scope (persistence-scope.ts) + the base name zustand passes in. When
// the coordinator switches scope (setScope) it re-closes the gate on every
// registered instance, so a write in the window between setScope(user) and the
// user-scoped rehydrate settling cannot leak guest state into the user's key.
export type GatedPersistStorage<S> = PersistStorage<S> & {
  release: () => void
  destroy: () => void
}

export function createGatedPersistStorage<S>(): GatedPersistStorage<S> | undefined {
  try {
    let released = false
    const inner = createJSONStorage<S>(() => window.localStorage)
    if (!inner) return undefined
    const unregister = registerGateReCloser(() => {
      released = false
    })
    return {
      getItem: (name) => inner.getItem(keyForActiveScope(name)),
      setItem: (name, value) => {
        if (!released) return undefined
        return inner.setItem(keyForActiveScope(name), value)
      },
      removeItem: (name) => inner.removeItem(keyForActiveScope(name)),
      release: () => {
        released = true
      },
      // The registry holds a reference to this instance's closure; drop it so a
      // re-created store (tests, HMR) cannot re-gate a dead instance.
      destroy: unregister,
    }
  } catch {
    // No window.localStorage (e.g. SSR) — mirror zustand's own behaviour of
    // degrading to a non-persistent store.
    return undefined
  }
}
