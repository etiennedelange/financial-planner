// Tiny pub/sub describing whether the browser is actually saving the user's data.
// With no server copy, a silent storage failure (quota exceeded, private mode,
// blocked site data) means silent data loss — so it is surfaced, never swallowed.

export type StorageHealth = "ok" | "unavailable" | "quota"

let health: StorageHealth = "ok"
const listeners = new Set<() => void>()

function set(next: StorageHealth) {
  if (health === next) return
  health = next
  for (const listener of listeners) listener()
}

export function getStorageHealth(): StorageHealth {
  return health
}

export function subscribeStorageHealth(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  )
}

export function reportStorageFailure(error: unknown): void {
  set(isQuotaError(error) ? "quota" : "unavailable")
}

export function reportStorageSuccess(): void {
  set("ok")
}

/** Probes whether localStorage is usable at all (private mode / blocked site data). */
export function probeStorage(): StorageHealth {
  try {
    const probe = "rc-storage-probe"
    window.localStorage.setItem(probe, "1")
    window.localStorage.removeItem(probe)
    set("ok")
  } catch (error) {
    reportStorageFailure(error)
  }
  return health
}

/** Test helper. */
export function resetStorageHealth(): void {
  health = "ok"
  listeners.clear()
}
