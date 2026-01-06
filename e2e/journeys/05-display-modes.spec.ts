import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { SINGLE_TFSA_STATE } from '../fixtures/state-seeds'

/**
 * Journey 5: Display Modes
 *
 * This test documents the journey of a user toggling between display modes.
 * It captures the UX around understanding which mode is active and its impact.
 *
 * Key areas documented:
 * - Real vs Nominal value display toggle
 * - Compounding method toggle
 * - Display mode persistence across tabs
 * - Understanding which mode is currently active
 */
test.describe('Journey 5: Display Modes', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-05-display-modes')
    stateManager = new StateManager(page)

    // Start with a single TFSA account
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document display mode toggles and visibility', async ({ page }) => {
    // ========================================
    // Step 1: Initial State - Default Mode
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('initial-state-default-mode', {
      fullPage: true,
      description: 'Default display mode - Future Value (Nominal)',
    })

    // ========================================
    // Step 2: Toggle Display Mode Button
    // ========================================
    const displayModeButton = page.getByRole('button', { name: /today.*value|future.*value/i })
    await expect(displayModeButton).toBeVisible()

    await displayModeButton.click()
    await page.waitForTimeout(300)

    await screenshots.capture('display-mode-popover-open', {
      description: 'Display mode popover showing options',
    })

    // Close popover to see the full UI
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await screenshots.capture('display-mode-toggled-to-real', {
      fullPage: true,
      description: 'Display mode toggled to Today\'s Value (Real)',
    })

    // Wait for charts to update
    await screenshots.waitForCharts()
    await screenshots.capture('charts-in-real-mode', {
      description: 'Charts showing values in Real terms',
    })

    // ========================================
    // Step 3: Toggle Compounding Method
    // ========================================
    const nominalButton = page.getByRole('button', { name: /nominal/i })
    await expect(nominalButton).toBeVisible()

    await nominalButton.click()
    await page.waitForTimeout(300)

    await screenshots.capture('compounding-method-popover', {
      description: 'Compounding method popover open',
    })

    // Close popover
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await screenshots.capture('compounding-method-changed', {
      fullPage: true,
      description: 'Compounding method toggled',
    })

    // ========================================
    // Step 4: Check Mode Visibility on Personal Tab
    // ========================================
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('personal-tab-with-display-mode', {
      fullPage: true,
      description: 'Personal tab - display mode indicator visible',
    })

    // ========================================
    // Step 5: Check Mode Visibility on Goals Tab
    // ========================================
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('goals-tab-with-display-mode', {
      fullPage: true,
      description: 'Goals tab - display mode indicator visible',
    })

    // ========================================
    // Step 6: Check Mode Visibility on Assumptions Tab
    // ========================================
    await page.getByRole('tab', { name: 'Assumptions' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('assumptions-tab-with-display-mode', {
      fullPage: true,
      description: 'Assumptions tab - display mode indicator visible',
    })

    // ========================================
    // Step 7: Check Mode Visibility on Insights Tab
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500)

    await screenshots.capture('insights-tab-with-display-mode', {
      fullPage: true,
      description: 'Insights tab - display mode affects recommendations',
    })

    // ========================================
    // Step 8: Check Mode Visibility on Calculations Tab
    // ========================================
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-tab-with-display-mode', {
      fullPage: true,
      description: 'Calculations tab - display mode affects values shown',
    })

    // ========================================
    // Step 9: Toggle Back to Nominal Mode
    // ========================================
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    const displayModeButton2 = page.getByRole('button', { name: /today.*value|future.*value/i })
    await displayModeButton2.click()
    await page.waitForTimeout(300)

    await screenshots.capture('toggling-back-to-nominal', {
      description: 'Toggling back to Future Value (Nominal)',
    })

    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    await screenshots.waitForCharts()
    await screenshots.capture('back-to-nominal-mode', {
      fullPage: true,
      description: 'Back to Future Value (Nominal) mode',
    })

    // ========================================
    // Step 10: Verify Mode Persists Across Tab Switches
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('insights-with-nominal-mode', {
      fullPage: true,
      description: 'Insights tab - confirmed nominal mode persists',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 5 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
