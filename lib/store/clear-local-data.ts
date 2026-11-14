import { CALCULATOR_STORAGE_KEY, useCalculatorStore } from "@/lib/store/calculator-store"
import {
  DEFAULT_MONTHLY_INCOME,
  EXPENSES_STORAGE_KEY,
  useExpensesStore,
} from "@/lib/store/expenses-store"
import { LAST_BACKUP_KEY } from "@/lib/utils/plan-io"

/**
 * Prefixes of keys that hold user data. A prefix matches the key itself and its scoped
 * variants (`<prefix>:guest`, `<prefix>:user:<id>`) that account-era builds wrote; those
 * variants hold the same financial data, so "clear all" must remove them too. The
 * pre-rename calculator key is listed for the same reason.
 * The theme preference is deliberately not listed.
 */
const LEGACY_CALCULATOR_KEY = "retirement-calculator-storage"
const USER_DATA_PREFIXES = [CALCULATOR_STORAGE_KEY, EXPENSES_STORAGE_KEY, LEGACY_CALCULATOR_KEY]

function isUserDataKey(key: string): boolean {
  if (key === LAST_BACKUP_KEY) return true
  return USER_DATA_PREFIXES.some((prefix) => key === prefix || key.startsWith(`${prefix}:`))
}

/** Removes every user-data key from `storage`. Returns the keys it removed. */
export function removeLocalDataKeys(storage: Storage): string[] {
  const removed: string[] = []
  const all: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key !== null) all.push(key)
  }
  for (const key of all) {
    if (!isUserDataKey(key)) continue
    storage.removeItem(key)
    removed.push(key)
  }
  return removed
}

/**
 * The browser's localStorage, or null when access throws (blocked site data). Read at
 * call time, never as a default parameter: a default that throws would stop the
 * in-memory reset below from ever running.
 */
function browserStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * Wipes everything this app stores in the browser.
 *
 * Order matters: the in-memory stores are reset FIRST. Removing the keys alone
 * and reloading would be fine, but removing them while the stores still hold the
 * data would let the persist middleware write it straight back on the next set().
 * The reset itself writes the defaults, so the keys are removed AFTER it.
 */
export function clearAllLocalData(storage?: Storage): string[] {
  useCalculatorStore.getState().resetToDefaults()
  useExpensesStore.getState().clearAll()
  useExpensesStore.setState({ monthlyIncome: DEFAULT_MONTHLY_INCOME })
  const target = storage ?? browserStorage()
  // With storage unreadable nothing could have been saved, so there is nothing to remove.
  // The in-memory reset above has already happened; a failed removal must not throw
  // out of the Settings click handler either.
  if (!target) return []
  try {
    return removeLocalDataKeys(target)
  } catch {
    return []
  }
}
