// One-time cleanup when the app moved from accounts + cloud sync to browser-only
// storage. Runs BEFORE the stores rehydrate. Idempotent: running it again is a no-op.
//
//  1. Guest data lived under `<base>:guest`; it now lives under the plain `<base>`
//     key. The `:guest` copy wins over any stale un-suffixed key (it is the newer
//     one), and the old key is only deleted AFTER the new one was written, so a
//     write failure (quota) can never lose the plan.
//  2. Everything that belonged to an account is purged: user-scoped caches
//     (`<base>:user:<id>`), claim / legacy-ambiguous markers, legacy backups and
//     Supabase auth tokens. On a shared computer those hold somebody's financial
//     data, and nothing reads them any more.

const BASE_KEYS = ["financial-planner-storage", "expenses-store-v2"] as const

const PURGE_PREFIXES = ["rc-pending-claim-scenario-id:", "rc-legacy-ambiguous:", "sb-"] as const

function isAccountKey(key: string): boolean {
  if (PURGE_PREFIXES.some((prefix) => key.startsWith(prefix))) return true
  return BASE_KEYS.some(
    (base) => key.startsWith(`${base}:user:`) || key.startsWith(`${base}:legacy-backup:`),
  )
}

export interface MigrationResult {
  migrated: string[]
  purged: string[]
}

export function migrateToLocalOnlyStorage(storage: Storage): MigrationResult {
  const result: MigrationResult = { migrated: [], purged: [] }

  for (const base of BASE_KEYS) {
    const guestKey = `${base}:guest`
    const guestValue = storage.getItem(guestKey)
    if (guestValue === null) continue
    try {
      storage.setItem(base, guestValue)
    } catch {
      // Could not write the new key — keep the old one so nothing is lost; the
      // next load retries.
      continue
    }
    storage.removeItem(guestKey)
    result.migrated.push(base)
  }

  // Collect first: removing while iterating shifts indices.
  const stale: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key !== null && isAccountKey(key)) stale.push(key)
  }
  for (const key of stale) {
    storage.removeItem(key)
    result.purged.push(key)
  }

  return result
}

/** Expires Supabase auth cookies (`sb-…`) left behind by the old sign-in flow. */
export function purgeLegacyAuthCookies(doc: Pick<Document, "cookie">): string[] {
  const purged: string[] = []
  for (const part of doc.cookie.split(";")) {
    const name = part.split("=")[0]?.trim()
    if (!name || !name.startsWith("sb-")) continue
    doc.cookie = `${name}=; Max-Age=0; path=/`
    purged.push(name)
  }
  return purged
}
