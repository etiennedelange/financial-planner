import { scopedKeyFor } from "./persistence-scope"

// One-time read-and-move of the legacy un-scoped storage keys into scoped keys.
//
// Runs inside the machine's `hydratingGuest` state: it needs no authenticated
// identity — a legacy payload is routed by the `sessionId` INSIDE its own
// payload, so classification is self-contained and can run pre-auth. The
// hydratingGuest capture handler guarantees an early auth event cannot cancel
// this migration mid-copy.
//
// A non-null sessionId copies into that user's scoped key. A `sessionId: null`
// payload is ambiguous — it could belong to any account — and moves to the
// ambiguous holding area (fed to components/auth/legacy-local-plan-prompt.tsx),
// never silently auto-claimed by whoever signs in next.
//
// Delete-on-success only: a failed copy leaves the legacy key intact for retry.
//
// Version decision: the stores stay at `version: 2`. Scoped keys are new keys,
// so there is no stale scoped data to migrate; a legacy payload keeps its own
// `version` inside the copied blob, and zustand's `migrate` (the R1-trillion
// monetary clamp) still runs for v1 payloads when the scoped key rehydrates.
// Bumping to 3 would add nothing but a risk of skipping the clamp.

export const LEGACY_CALCULATOR_KEY = "retirement-calculator-storage"
export const LEGACY_EXPENSES_KEY = "expenses-store-v2"
const AMBIGUOUS_HOLDING_PREFIX = "rc-legacy-ambiguous:"

export interface AmbiguousLegacyState {
  /** Base storage name the payload belongs to (e.g. `retirement-calculator-storage`). */
  baseName: string
  scope: { kind: "guest" }
  payload: unknown
}

interface LegacyPayload {
  state?: { sessionId?: string | null } | null
  version?: unknown
}

export function holdingKeyFor(baseName: string): string {
  return `${AMBIGUOUS_HOLDING_PREFIX}${baseName}`
}

function readLegacy(key: string): LegacyPayload | null {
  const raw = window.localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as LegacyPayload
  } catch {
    return null
  }
}

/**
 * Migrates legacy un-scoped keys into scoped keys. Returns the ambiguous
 * (sessionId: null) states parked in the holding area; the caller renders
 * legacy-local-plan-prompt for those. Throws if a copy fails — the legacy key
 * is left intact for retry.
 */
export function migrateLegacyKeys(): AmbiguousLegacyState[] {
  const ambiguous: AmbiguousLegacyState[] = []

  for (const legacyKey of [LEGACY_CALCULATOR_KEY, LEGACY_EXPENSES_KEY] as const) {
    const payload = readLegacy(legacyKey)
    if (!payload) continue

    const sessionId = payload.state?.sessionId ?? null

    if (sessionId == null) {
      // Ambiguous: no user claim possible. Move to the holding area — the user
      // decides (prompt) whether it becomes the guest scope; it is never
      // auto-claimed by whoever signs in next. The holding write must succeed
      // before the source key is removed.
      window.localStorage.setItem(holdingKeyFor(legacyKey), JSON.stringify(payload))
      window.localStorage.removeItem(legacyKey)
      ambiguous.push({ baseName: legacyKey, scope: { kind: "guest" }, payload })
      continue
    }

    const scopedKey = scopedKeyFor(legacyKey, { kind: "user", userId: sessionId })
    // Copy, then delete — delete only on success. setItem throws (e.g. quota)
    // before the removeItem runs, leaving the legacy key intact for retry.
    window.localStorage.setItem(scopedKey, JSON.stringify(payload))
    window.localStorage.removeItem(legacyKey)
  }

  return ambiguous
}

/** Re-reads the holding area (survives reloads: migration may have run earlier). */
export function readAmbiguousLegacyStates(): AmbiguousLegacyState[] {
  const states: AmbiguousLegacyState[] = []
  for (const baseName of [LEGACY_CALCULATOR_KEY, LEGACY_EXPENSES_KEY] as const) {
    const raw = window.localStorage.getItem(holdingKeyFor(baseName))
    if (!raw) continue
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      continue
    }
    states.push({ baseName, scope: { kind: "guest" }, payload })
  }
  return states
}

/** Adopts an ambiguous legacy payload as guest-scoped state (user chose "Use this local plan"). */
export function adoptAmbiguousLegacy(state: AmbiguousLegacyState): void {
  window.localStorage.setItem(
    scopedKeyFor(state.baseName, { kind: "guest" }),
    JSON.stringify(state.payload)
  )
  window.localStorage.removeItem(holdingKeyFor(state.baseName))
}

/** Discards an ambiguous legacy payload (user chose "Keep account data"). */
export function discardAmbiguousLegacy(state: AmbiguousLegacyState): void {
  window.localStorage.removeItem(holdingKeyFor(state.baseName))
}
