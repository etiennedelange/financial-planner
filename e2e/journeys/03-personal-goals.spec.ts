import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { SINGLE_TFSA_STATE } from '../fixtures/state-seeds'

/**
 * Journey 3: Personal Information & Goals
 *
 * This test documents the journey of a user adjusting personal information and retirement goals.
 * It captures the UX friction of switching between tabs to see the impact of changes.
 *
 * Key areas documented:
 * - Adjusting personal information (age, retirement age, life expectancy)
 * - Setting retirement goals (desired income, legacy amount)
 * - Tab switching to view projection updates
 * - Context loss when comparing changes
 */
test.describe('Journey 3: Personal Information & Goals', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-03-personal-goals')
    stateManager = new StateManager(page)

    // Start with a single TFSA account
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document personal info and goals adjustment flow', async ({ page }) => {
    // ========================================
    // Step 1: Initial State with Account
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('initial-state-with-account', {
      fullPage: true,
      description: 'Starting point - account already exists, default personal info',
    })

    // ========================================
    // Step 2: Navigate to Personal Tab
    // ========================================
    // UX PAIN POINT: Must leave Accounts tab to adjust personal info
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('personal-tab-initial', {
      fullPage: true,
      description: 'Personal tab - default values visible',
    })

    // ========================================
    // Step 3: Adjust Personal Information
    // ========================================
    await page.getByLabel(/current age/i).fill('35')
    await screenshots.capture('current-age-updated', {
      description: 'Current age changed to 35',
    })

    await page.getByLabel(/retirement age/i).fill('60')
    await screenshots.capture('retirement-age-updated', {
      description: 'Retirement age changed to 60',
    })

    await page.getByLabel(/life expectancy/i).fill('85')
    await screenshots.capture('life-expectancy-updated', {
      description: 'Life expectancy changed to 85',
    })

    await page.getByLabel(/annual income/i).fill('750000')
    await screenshots.capture('annual-income-updated', {
      fullPage: true,
      description: 'Annual income changed to R750,000',
    })

    // ========================================
    // Step 4: Navigate to Goals Tab
    // ========================================
    // UX PAIN POINT: Must switch to another tab to set goals
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('goals-tab-initial', {
      fullPage: true,
      description: 'Goals tab - CONTEXT LOST: cannot see personal info or charts',
    })

    // ========================================
    // Step 5: Adjust Retirement Goals
    // ========================================
    await page.getByLabel(/desired monthly income/i).fill('40000')
    await screenshots.capture('desired-income-updated', {
      description: 'Desired monthly income set to R40,000',
    })

    await page.getByLabel(/expected inflation/i).fill('5.5')
    await screenshots.capture('inflation-rate-updated', {
      description: 'Expected inflation set to 5.5%',
    })

    await page.getByLabel(/legacy goal/i).fill('500000')
    await screenshots.capture('legacy-amount-updated', {
      fullPage: true,
      description: 'Legacy goal set to R500,000',
    })

    // ========================================
    // Step 6: Switch Back to View Impact
    // ========================================
    // UX PAIN POINT: Must switch back to Accounts to see updated projections
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-accounts-after-personal-goals', {
      fullPage: true,
      description: 'UX FRICTION: Switched back to Accounts to see impact of changes',
    })

    // Wait for charts to update with new parameters
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('charts-updated-with-new-parameters', {
      description: 'Charts reflect updated personal info and goals',
    })

    // ========================================
    // Step 7: Check Insights for Recommendations
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500)

    await screenshots.capture('insights-with-updated-goals', {
      fullPage: true,
      description: 'Insights based on new personal info and goals',
    })

    // ========================================
    // Step 8: Want to Compare - Must Switch Back
    // ========================================
    // UX PAIN POINT: Want to see personal info while viewing insights
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-personal-from-insights', {
      fullPage: true,
      description: 'UX FRICTION: Had to leave Insights to review personal info',
    })

    // ========================================
    // Step 9: Multiple Tab Switches to Review
    // ========================================
    // Documenting the back-and-forth friction
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('reviewing-goals-again', {
      description: 'Reviewing goals again - lost insights context',
    })

    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('final-accounts-view', {
      fullPage: true,
      description: 'Back to main view - multiple tab switches to review changes',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 3 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
