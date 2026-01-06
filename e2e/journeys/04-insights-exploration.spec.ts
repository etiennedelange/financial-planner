import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { MULTI_ACCOUNT_STATE } from '../fixtures/state-seeds'

/**
 * Journey 4: Insights Exploration
 *
 * This test documents the journey of a user exploring insights and recommendations.
 * It captures the UX friction of switching between Insights and other tabs to verify data.
 *
 * Key areas documented:
 * - Insights tab recommendations and analysis
 * - Optimal contribution suggestions
 * - Scenario comparisons
 * - Context loss when comparing with account details
 * - Need to switch back to Accounts/Assumptions tabs
 */
test.describe('Journey 4: Insights Exploration', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-04-insights-exploration')
    stateManager = new StateManager(page)

    // Start with multi-account portfolio for richer insights
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(MULTI_ACCOUNT_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document insights exploration and context loss', async ({ page }) => {
    // ========================================
    // Step 1: Initial Accounts View
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('accounts-tab-initial', {
      fullPage: true,
      description: 'Starting view - multi-account portfolio on Accounts tab',
    })

    // ========================================
    // Step 2: Navigate to Insights
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500)

    await screenshots.capture('insights-tab-opened', {
      fullPage: true,
      description: 'Insights tab - initial view with recommendations',
    })

    // ========================================
    // Step 3: Explore Optimal Contribution Section
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 300))
    await screenshots.capture('optimal-contribution-section', {
      description: 'Optimal contribution recommendations visible',
    })

    // ========================================
    // Step 4: Explore Investment Scenarios
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 600))
    await screenshots.capture('investment-scenarios', {
      description: 'Investment scenario comparisons',
    })

    // ========================================
    // Step 5: Scroll Through All Insights
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 900))
    await screenshots.capture('additional-insights', {
      description: 'Additional insights and analysis',
    })

    await page.evaluate(() => window.scrollTo(0, 1200))
    await screenshots.capture('insights-bottom-section', {
      description: 'Bottom section of insights',
    })

    // ========================================
    // Step 6: Want to Verify Account Details
    // ========================================
    // UX PAIN POINT: Reading insights, want to check account details without losing place
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-accounts-to-verify-data', {
      fullPage: true,
      description: 'UX FRICTION: Left Insights to verify account balances and contributions',
    })

    // Scroll to see specific account
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await screenshots.capture('checking-specific-account-details', {
      description: 'Verifying specific account details mentioned in insights',
    })

    // ========================================
    // Step 7: Back to Insights - Lost Scroll Position
    // ========================================
    // UX PAIN POINT: Returning to Insights, lost scroll position
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(300)

    await screenshots.capture('insights-tab-reopened', {
      fullPage: true,
      description: 'UX FRICTION: Returned to Insights, lost previous scroll position',
    })

    // ========================================
    // Step 8: Want to Check Assumptions
    // ========================================
    // UX PAIN POINT: Insights mention assumptions, need to switch tabs to verify
    await page.getByRole('tab', { name: 'Assumptions' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('assumptions-tab-to-verify', {
      fullPage: true,
      description: 'UX FRICTION: Switched to Assumptions to verify values mentioned in insights',
    })

    // ========================================
    // Step 9: Back to Insights Again
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('insights-reopened-again', {
      fullPage: true,
      description: 'Multiple tab switches to cross-reference insights with data',
    })

    // ========================================
    // Step 10: Want to See Goals Alongside Insights
    // ========================================
    // UX PAIN POINT: Insights reference retirement goals, can't see both
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('goals-tab-from-insights', {
      fullPage: true,
      description: 'UX FRICTION: Cannot see insights and goals simultaneously',
    })

    // ========================================
    // Step 11: Final Return to Insights
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('insights-final-view', {
      fullPage: true,
      description: 'Back to insights after multiple context switches',
    })

    // Scroll to specific insight to capture
    await page.evaluate(() => window.scrollTo(0, 400))
    await screenshots.capture('insights-focused-recommendation', {
      description: 'Focused view of specific recommendation',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 4 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
