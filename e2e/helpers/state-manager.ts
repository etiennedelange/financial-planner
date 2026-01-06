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
 * The SA Retirement Calculator uses Zustand with localStorage persistence.
 * This helper provides methods to seed, clear, and inspect state for testing.
 *
 * LocalStorage key: 'retirement-calculator-storage'
 */
export class StateManager {
  constructor(private page: Page) {}

  /**
   * Clear all localStorage state (for fresh start)
   */
  async clearState() {
    await this.page.evaluate(() => {
      localStorage.removeItem('retirement-calculator-storage')
    })
  }

  /**
   * Seed state with predefined data
   * Merges with existing state to avoid overwriting unrelated fields
   */
  async seedState(state: Partial<CalculatorState>) {
    await this.page.evaluate((stateData) => {
      const storageKey = 'retirement-calculator-storage'
      const existing = localStorage.getItem(storageKey)
      const parsed = existing ? JSON.parse(existing) : { state: {} }

      // Merge new state into existing
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          state: { ...parsed.state, ...stateData },
          version: 0,
        })
      )
    }, state)
  }

  /**
   * Get current state from localStorage
   */
  async getState(): Promise<CalculatorState | null> {
    return await this.page.evaluate(() => {
      const storage = localStorage.getItem('retirement-calculator-storage')
      return storage ? JSON.parse(storage).state : null
    })
  }

  /**
   * Wait for Zustand to rehydrate state from localStorage
   * Call this after seeding state and reloading the page
   */
  async waitForHydration(timeoutMs = 1000) {
    await this.page.waitForTimeout(timeoutMs)
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
