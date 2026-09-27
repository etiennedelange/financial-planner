import type { Page } from '@playwright/test'
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
} from '@/types'

/**
 * Calculator state structure matching Zustand store
 */
export interface CalculatorState {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions?: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: 'nominal' | 'real'
}

/**
 * StateManager - Utility for manipulating localStorage state in Playwright tests
 *
 * The SA Financial Planner uses Zustand with localStorage persistence,
 * scoped per identity (guest or user:<id>) — see lib/store/persistence-scope.ts.
 * This helper provides methods to seed, clear, and inspect state for testing.
 *
 * LocalStorage keys:
 *   retirement-calculator-storage:guest | :user:<userId>
 *   expenses-store-v2:guest | :user:<userId>
 */
export class StateManager {
  constructor(private page: Page) {}

  /**
   * Clear every scoped key for both stores (guest + all users), so journeys
   * cannot leak state into each other.
   */
  async clearState() {
    await this.page.evaluate(() => {
      const prefix = ['retirement-calculator-storage', 'expenses-store-v2']
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
   * Seed state with predefined data into the guest scope (the default for
   * signed-out journeys). Merges with existing state to avoid overwriting
   * unrelated fields. Kept in sync with the stores' current version (2) so
   * seeded payloads rehydrate via the normal path rather than the migrate
   * clamp.
   */
  async seedState(state: Partial<CalculatorState>) {
    await this.page.evaluate((stateData) => {
      const storageKey = 'retirement-calculator-storage:guest'
      const existing = localStorage.getItem(storageKey)
      const parsed = existing ? JSON.parse(existing) : { state: {} }

      // Merge new state into existing
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: { ...parsed.state, ...stateData },
          version: 2,
        })
      )
    }, state)
  }

  /**
   * Get current state from localStorage (guest scope)
   */
  async getState(): Promise<CalculatorState | null> {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem('retirement-calculator-storage:guest')
      return storage ? JSON.parse(storage).state : null
    })
  }

  /**
   * Wait for the bootstrap coordinator to reach ready, signalled via the
   * data-bootstrap-phase attribute on the app shell. Replaces the previous
   * blind sleep — a fixed timeout cannot distinguish 'still hydrating' from
   * 'ready but slow', which two-phase (guest, then user) hydration makes
   * strictly more fragile.
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
