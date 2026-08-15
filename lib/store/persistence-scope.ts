// Guest/user persistence-scope policy. The scope is set ONLY by the bootstrap
// coordinator before each rehydrate; it is not persisted inside the payload —
// the storage *key* encodes the scope, so one account's local cache can never
// silently become another account's claim.

export type PersistenceScope = { kind: "guest" } | { kind: "user"; userId: string }

// Module-level active scope — zustand passes the base storage name into
// getItem/setItem/removeItem, and the wrapper computes the scoped key from
// `activeScope` + that base name. There is no per-scope storage re-creation.
let activeScope: PersistenceScope = { kind: "guest" }

// Every gated storage instance registers a re-close callback here. The gate is
// released by the guest hydration's onRehydrateStorage; between setScope(user)
// and the user-scoped rehydrate settling it would otherwise stay open while the
// store still holds guest data — a write in that window would persist
// guest-shaped state into the user's key. setScope() therefore re-closes every
// instance, so the user scope is ungated only after its own rehydrate settles.
const gateReClosers = new Set<() => void>()

export function registerGateReCloser(reClose: () => void): () => void {
  gateReClosers.add(reClose)
  return () => gateReClosers.delete(reClose)
}

export function setScope(scope: PersistenceScope): void {
  activeScope = scope
  for (const reClose of gateReClosers) reClose()
}

export function getScope(): PersistenceScope {
  return activeScope
}

/** Scoped storage key for a base name, e.g. `retirement-calculator-storage` → `retirement-calculator-storage:user:user-a`. */
export function scopedKeyFor(baseName: string, scope: PersistenceScope): string {
  return scope.kind === "user" ? `${baseName}:user:${scope.userId}` : `${baseName}:guest`
}

export function keyForActiveScope(baseName: string): string {
  return scopedKeyFor(baseName, activeScope)
}

// Stores register their persistence base names so sign-out can evict the
// signed-out user's scoped keys across every store.
const registeredBaseNames = new Set<string>()

export function registerStorageBaseName(baseName: string): void {
  registeredBaseNames.add(baseName)
}

/** Removes every user-scoped key for `userId` across all registered stores. */
export function evictUserScopedKeys(userId: string): void {
  for (const baseName of registeredBaseNames) {
    window.localStorage.removeItem(scopedKeyFor(baseName, { kind: "user", userId }))
  }
}
