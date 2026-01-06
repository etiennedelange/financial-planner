import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { MULTI_ACCOUNT_STATE } from '../fixtures/state-seeds'

/**
 * Journey 6: Calculations Review
 *
 * This test documents the journey of a user reviewing detailed calculations and formulas.
 * It captures the UX friction of switching tabs to verify input values against calculations.
 *
 * Key areas documented:
 * - Calculations tab breakdown
 * - Detailed formula views
 * - Need to switch between Calculations and Accounts/Assumptions to verify inputs
 * - Context loss when cross-referencing values
 */
test.describe('Journey 6: Calculations Review', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-06-calculations-review')
    stateManager = new StateManager(page)

    // Start with multi-account portfolio for complex calculations
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(MULTI_ACCOUNT_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document calculations review and cross-reference friction', async ({ page }) => {
    // ========================================
    // Step 1: Initial Accounts View
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('accounts-tab-before-calculations', {
      fullPage: true,
      description: 'Accounts tab showing portfolio before reviewing calculations',
    })

    // ========================================
    // Step 2: Navigate to Calculations Tab
    // ========================================
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-tab-initial', {
      fullPage: true,
      description: 'Calculations tab - main view with methodology sections',
    })

    // ========================================
    // Step 3: Explore Projection Methodology
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 300))
    await screenshots.capture('projection-methodology-section', {
      description: 'Projection methodology and formulas',
    })

    // ========================================
    // Step 4: Scroll Through Calculation Details
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 600))
    await screenshots.capture('calculation-details-mid', {
      description: 'Mid-section of calculation details',
    })

    await page.evaluate(() => window.scrollTo(0, 900))
    await screenshots.capture('calculation-details-lower', {
      description: 'Lower section of calculation details',
    })

    await page.evaluate(() => window.scrollTo(0, 1200))
    await screenshots.capture('calculation-details-bottom', {
      description: 'Bottom section with Monte Carlo details',
    })

    // ========================================
    // Step 5: Want to Verify Account Values
    // ========================================
    // UX PAIN POINT: Seeing calculations, need to verify account inputs
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-accounts-to-verify-inputs', {
      fullPage: true,
      description: 'UX FRICTION: Left Calculations to verify account input values',
    })

    // Scroll to specific account
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await screenshots.capture('verifying-account-details', {
      description: 'Checking specific account values referenced in calculations',
    })

    // ========================================
    // Step 6: Back to Calculations
    // ========================================
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-reopened', {
      fullPage: true,
      description: 'Back to Calculations tab after verifying inputs',
    })

    // ========================================
    // Step 7: Want to Check Assumptions Used
    // ========================================
    // UX PAIN POINT: Calculations reference assumptions, need to switch to verify
    await page.getByRole('tab', { name: 'Assumptions' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('assumptions-to-verify-calculations', {
      fullPage: true,
      description: 'UX FRICTION: Switched to Assumptions to verify values in formulas',
    })

    // ========================================
    // Step 8: Back to Calculations Again
    // ========================================
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-reopened-again', {
      fullPage: true,
      description: 'Returned to Calculations after checking assumptions',
    })

    // Scroll to specific section
    await page.evaluate(() => window.scrollTo(0, 400))
    await screenshots.capture('calculations-focused-section', {
      description: 'Focused on specific calculation section',
    })

    // ========================================
    // Step 9: Want to See Goals Referenced
    // ========================================
    // UX PAIN POINT: Calculations mention retirement goals, can't see both
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('goals-from-calculations', {
      fullPage: true,
      description: 'UX FRICTION: Cannot view calculations and goals simultaneously',
    })

    // ========================================
    // Step 10: Multiple Switches to Cross-Reference
    // ========================================
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('personal-from-calculations', {
      fullPage: true,
      description: 'Checking personal info referenced in calculations',
    })

    // Final return to calculations
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-final-view', {
      fullPage: true,
      description: 'Final calculations view after multiple tab switches',
    })

    // Scroll to bottom to see all details
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await screenshots.capture('calculations-complete-bottom', {
      description: 'Complete bottom section of calculations',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 6 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
