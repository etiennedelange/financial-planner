import { CALCULATOR_STORAGE_KEY, useCalculatorStore } from "@/lib/store/calculator-store"
import {
  DEFAULT_MONTHLY_INCOME,
  EXPENSES_STORAGE_KEY,
  useExpensesStore,
} from "@/lib/store/expenses-store"
import { LAST_BACKUP_KEY } from "@/lib/utils/plan-io"

/** Exact keys that hold user data. The theme preference is deliberately kept. */
const LOCAL_DATA_KEYS = [
  CALCULATOR_STORAGE_KEY,
  EXPENSES_STORAGE_KEY,
  LAST_BACKUP_KEY,
  "plan-narrative-model-tier",
  "plan-narrative-provider",
] as const

/** Key prefixes that hold user data (encrypted API-key vault entries). */
const LOCAL_DATA_PREFIXES = ["rc-llm-key-v1:"] as const

/** Removes every user-data key from `storage`. Returns the keys it removed. */
export function removeLocalDataKeys(storage: Storage): string[] {
  const removed: string[] = []
  const all: string[] = []
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (key !== null) all.push(key)
  }
  for (const key of all) {
    const isData =
      (LOCAL_DATA_KEYS as readonly string[]).includes(key) ||
      LOCAL_DATA_PREFIXES.some((prefix) => key.startsWith(prefix))
    if (!isData) continue
    storage.removeItem(key)
    removed.push(key)
  }
  return removed
}

/**
 * Wipes everything this app stores in the browser.
 *
 * Order matters: the in-memory stores are reset FIRST. Removing the keys alone
 * and reloading would be fine, but removing them while the stores still hold the
 * data would let the persist middleware write it straight back on the next set().
 * The reset itself writes the defaults, so the keys are removed AFTER it.
 */
export function clearAllLocalData(storage: Storage = window.localStorage): string[] {
  useCalculatorStore.getState().resetToDefaults()
  useExpensesStore.getState().clearAll()
  useExpensesStore.setState({ monthlyIncome: DEFAULT_MONTHLY_INCOME })
  return removeLocalDataKeys(storage)
}
