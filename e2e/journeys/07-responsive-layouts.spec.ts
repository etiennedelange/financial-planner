import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { SINGLE_TFSA_STATE } from '../fixtures/state-seeds'

/**
 * Journey 7: Responsive Layouts
 *
 * This test documents how the UI adapts to different screen sizes.
 * It runs on desktop, tablet, and mobile viewports (configured in playwright.config.ts).
 *
 * Key areas documented:
 * - Tab navigation on smaller screens
 * - Account form on mobile
 * - Chart rendering on different screen sizes
 * - Navigation patterns on touch devices
 */
test.describe('Journey 7: Responsive Layouts', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-07-responsive-layouts')
    stateManager = new StateManager(page)

    // Start with a single TFSA account
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document responsive layout and mobile navigation', async ({ page }) => {
    // ========================================
    // Step 1: Initial View on Current Viewport
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('initial-accounts-view', {
      fullPage: true,
      description: 'Accounts tab - initial view on current viewport',
    })

    // ========================================
    // Step 2: Tab Navigation
    // ========================================
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('personal-tab-responsive', {
      fullPage: true,
      description: 'Personal tab - responsive layout',
    })

    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('goals-tab-responsive', {
      fullPage: true,
      description: 'Goals tab - responsive layout',
    })

    await page.getByRole('tab', { name: 'Assumptions' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('assumptions-tab-responsive', {
      fullPage: true,
      description: 'Assumptions tab - responsive layout',
    })

    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500)

    await screenshots.capture('insights-tab-responsive', {
      fullPage: true,
      description: 'Insights tab - responsive layout',
    })

    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('calculations-tab-responsive', {
      fullPage: true,
      description: 'Calculations tab - responsive layout',
    })

    // ========================================
    // Step 3: Back to Accounts and Test Account Form
    // ========================================
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-accounts-responsive', {
      fullPage: true,
      description: 'Back to Accounts tab',
    })

    // ========================================
    // Step 4: Open Account Dialog on Current Viewport
    // ========================================
    const addAccountButton = page.getByRole('button', { name: /add account/i })
    await addAccountButton.click()
    await screenshots.waitForDialogAnimation()

    await screenshots.capture('account-dialog-responsive', {
      fullPage: true,
      description: 'Account creation dialog - responsive layout',
    })

    // Close dialog
    const cancelButton = page.getByRole('button', { name: /cancel/i })
    await cancelButton.click()
    await page.waitForTimeout(300)

    // ========================================
    // Step 5: Test Display Mode Toggle
    // ========================================
    const displayModeButton = page.getByRole('button', { name: /today.*value|future.*value/i })
    if (await displayModeButton.isVisible()) {
      await displayModeButton.click()
      await page.waitForTimeout(300)

      await screenshots.capture('display-mode-toggle-responsive', {
        description: 'Display mode toggle - responsive layout',
      })

      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }

    // ========================================
    // Step 6: Scroll Behavior on Current Viewport
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 500))
    await screenshots.capture('scrolled-view-responsive', {
      fullPage: false,
      description: 'Scrolled view - responsive layout',
    })

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await screenshots.capture('bottom-view-responsive', {
      fullPage: false,
      description: 'Bottom of page - responsive layout',
    })

    // ========================================
    // Step 7: Final Full Page View
    // ========================================
    await page.evaluate(() => window.scrollTo(0, 0))
    await screenshots.capture('final-full-page-responsive', {
      fullPage: true,
      description: 'Final full page view on current viewport',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 7 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
