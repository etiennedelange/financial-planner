import type { Page } from "@playwright/test"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
} from "@/types"

/**
 * Calculator state structure matching Zustand store
 */
export interface CalculatorState {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions?: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
}

/**
 * StateManager - Utility for manipulating localStorage state in Playwright tests
 *
 * The SA Financial Planner uses Zustand with localStorage persistence under fixed
 * keys (no accounts, no scoping). This helper provides methods to seed, clear, and
 * inspect state for testing.
 *
 * LocalStorage keys:
 *   financial-planner-storage
 *   expenses-store-v2
 */
export class StateManager {
  constructor(private page: Page) {}

  /**
   * Clear both stores' keys (and any leftover suffixed legacy keys), so journeys
   * cannot leak state into each other.
   */
  async clearState() {
    await this.page.evaluate(() => {
      const prefix = ["financial-planner-storage", "expenses-store-v2"]
      const keysToRemove: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && prefix.some((p) => key === p || key.startsWith(`${p}:`))) {
          keysToRemove.push(key)
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k))
    })
  }

  /**
   * Seed state with predefined data. Merges with existing state to avoid
   * overwriting unrelated fields. Kept in sync with the calculator store's persist
   * `version` (lib/store/calculator-store.ts) so seeded payloads rehydrate via
   * the normal path. An older version runs `migrate`, which rebuilds
   * personalInfo from the payload alone: a seed without personalInfo then loses
   * the default ages and the app renders "Retiring at undefined".
   */
  async seedState(state: Partial<CalculatorState>) {
    await this.page.evaluate((stateData) => {
      const storageKey = "financial-planner-storage"
      const existing = localStorage.getItem(storageKey)
      const parsed = existing ? JSON.parse(existing) : { state: {} }

      // Merge new state into existing
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: { ...parsed.state, ...stateData },
          version: 4,
        }),
      )
    }, state)
  }

  /**
   * Get current state from localStorage
   */
  async getState(): Promise<CalculatorState | null> {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem("financial-planner-storage")
      return storage ? JSON.parse(storage).state : null
    })
  }

  /**
   * Wait for the stores to finish rehydrating from localStorage, signalled via the
   * data-bootstrap-phase attribute on the app shell. Replaces a blind sleep — a
   * fixed timeout cannot distinguish 'still hydrating' from 'ready but slow'.
   */
  async waitForHydration(timeoutMs = 10000) {
    await this.page.waitForSelector('[data-bootstrap-phase="ready"]', {
      timeout: timeoutMs,
    })
  }

  /**
   * Verify state was successfully persisted
   */
  async verifyState(expectedPartialState: Partial<CalculatorState>): Promise<boolean> {
    const currentState = await this.getState()
    if (!currentState) return false

    // Check if all expected fields match
    for (const [key, value] of Object.entries(expectedPartialState)) {
      if (JSON.stringify(currentState[key as keyof CalculatorState]) !== JSON.stringify(value)) {
        return false
      }
    }
    return true
  }

  /**
   * Get account count (for quick verification)
   */
  async getAccountCount(): Promise<number> {
    const state = await this.getState()
    return state?.accounts?.length ?? 0
  }
}
