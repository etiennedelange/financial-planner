// Tiny pub/sub describing whether the browser is actually saving the user's data.
// With no server copy, a silent storage failure (quota exceeded, private mode,
// blocked site data) means silent data loss — so it is surfaced, never swallowed.
//
// Failures are tracked PER storage key. Each store saves under its own key, so a
// small save that succeeds must not clear a failed save of a different store:
// the user would otherwise lose unsaved edits with no warning on reload.

export type StorageHealth = "ok" | "unavailable" | "quota"

const DEFAULT_KEY = "default"
const PROBE_KEY = "probe"

let health: StorageHealth = "ok"
const failures = new Map<string, StorageHealth>()
const listeners = new Set<() => void>()

function set(next: StorageHealth) {
  if (health === next) return
  health = next
  for (const listener of listeners) listener()
}

/** The overall state is the worst outstanding failure across all keys. */
function recompute() {
  const states = [...failures.values()]
  if (states.includes("unavailable")) set("unavailable")
  else if (states.includes("quota")) set("quota")
  else set("ok")
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

/** Records a failed save under `key` (the storage key that failed). */
export function reportStorageFailure(error: unknown, key: string = DEFAULT_KEY): void {
  failures.set(key, isQuotaError(error) ? "quota" : "unavailable")
  recompute()
}

/** Clears only the failure recorded for `key`; other keys' failures stay visible. */
export function reportStorageSuccess(key: string = DEFAULT_KEY): void {
  failures.delete(key)
  recompute()
}

/** Probes whether localStorage is usable at all (private mode / blocked site data). */
export function probeStorage(): StorageHealth {
  try {
    const probe = "rc-storage-probe"
    window.localStorage.setItem(probe, "1")
    window.localStorage.removeItem(probe)
    reportStorageSuccess(PROBE_KEY)
  } catch (error) {
    reportStorageFailure(error, PROBE_KEY)
  }
  return health
}

/** Test helper. */
export function resetStorageHealth(): void {
  health = "ok"
  failures.clear()
  listeners.clear()
}
