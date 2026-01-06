import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { EMPTY_STATE } from '../fixtures/state-seeds'

/**
 * Journey 1: First-Time User Experience
 *
 * This test documents the journey of a user visiting the calculator for the first time.
 * It captures key UX pain points around tab switching and context loss.
 *
 * Key areas documented:
 * - Empty state messaging
 * - First account creation flow
 * - Tab navigation and switching
 * - Chart rendering and updates
 * - Context loss when switching between tabs
 */
test.describe('Journey 1: First-Time User Experience', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-01-first-time-user')
    stateManager = new StateManager(page)

    // Start with empty state
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(EMPTY_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document first-time user flow and tab switching friction', async ({ page }) => {
    // ========================================
    // Step 1: Empty State
    // ========================================
    await screenshots.capture('empty-state', {
      fullPage: true,
      description: 'Initial empty state - no accounts added yet',
    })

    // ========================================
    // Step 2: Add First Account - Open Dialog
    // ========================================
    const addAccountButton = page.getByRole('button', { name: /add.*first.*account/i })
    await expect(addAccountButton).toBeVisible()

    await addAccountButton.click()
    await screenshots.waitForDialogAnimation()
    await screenshots.capture('add-account-dialog-open', {
      description: 'Account creation dialog opened',
    })

    // ========================================
    // Step 3: Fill Account Form
    // ========================================
    await page.getByLabel(/account name/i).fill('My First TFSA')
    await page.getByLabel(/provider/i).fill('Allan Gray')

    // Select account type (dropdown) - Find the Select trigger button
    // The default value is "Retirement Annuity (RA)", we need to click to open dropdown
    const accountTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /retirement annuity|select account type/i })
    await accountTypeSelect.click()
    await screenshots.waitForDialogAnimation()
    await screenshots.capture('account-type-dropdown-open')

    // Select TFSA from dropdown
    await page.getByRole('option', { name: /tax.*free.*savings/i }).click()
    await screenshots.capture('account-type-selected')

    // Fill financial details
    await page.getByLabel(/current balance/i).fill('50000')
    await page.getByLabel(/monthly contribution/i).fill('2000')
    await page.getByLabel(/expected return/i).fill('11')
    await page.getByLabel(/annual fees/i).fill('0.5')
    await page.getByLabel(/^escalation/i).fill('6')

    await screenshots.capture('account-form-filled', {
      description: 'Account form completed with TFSA details',
    })

    // ========================================
    // Step 4: Submit and View Results
    // ========================================
    await page.getByRole('button', { name: /add account/i }).click()
    await page.waitForTimeout(500) // State update

    await screenshots.capture('first-account-added', {
      fullPage: true,
      description: 'First account successfully added - charts now visible',
    })

    // Verify account appears
    await expect(page.getByText('My First TFSA')).toBeVisible()

    // ========================================
    // Step 5: Charts Render
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.capture('portfolio-growth-chart-rendered', {
      description: 'Portfolio growth chart showing projections',
    })

    // Wait for Monte Carlo simulation
    await screenshots.waitForMonteCarloSimulation()
    await screenshots.capture('monte-carlo-simulation-complete', {
      description: 'Monte Carlo simulation completed',
    })

    // ========================================
    // Step 6: Tab Switching - Personal
    // ========================================
    // UX PAIN POINT: User must switch tabs to adjust personal info
    await page.getByRole('tab', { name: 'Personal' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('personal-tab-clicked', {
      fullPage: true,
      description: 'Personal tab - CONTEXT LOST: cannot see account details or charts',
    })

    // User adjusts age
    await page.getByLabel(/current age/i).fill('35')
    await screenshots.capture('personal-info-updated')

    // ========================================
    // Step 7: Tab Switching - Goals
    // ========================================
    // UX PAIN POINT: User must switch to another tab to set goals
    await page.getByRole('tab', { name: 'Goals' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('goals-tab-clicked', {
      fullPage: true,
      description: 'Goals tab - CONTEXT LOST: still cannot see accounts or projections',
    })

    // User sets retirement goal
    await page.getByLabel(/desired monthly income/i).fill('30000')
    await screenshots.capture('goals-updated')

    // ========================================
    // Step 8: Tab Switching Back to View Impact
    // ========================================
    // UX PAIN POINT: Must switch back to Accounts to see projection updates
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('back-to-accounts-after-changes', {
      fullPage: true,
      description: 'Switched back to Accounts tab to see updated projections',
    })

    // Wait for charts to update
    await screenshots.waitForCharts()
    await screenshots.capture('charts-updated-after-changes', {
      description: 'Charts reflect personal info and goals changes',
    })

    // ========================================
    // Step 9: Explore Insights Tab
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500) // Insights calculation

    await screenshots.capture('insights-tab-first-view', {
      fullPage: true,
      description: 'Insights tab - recommendations and analysis',
    })

    // Scroll through insights
    await page.evaluate(() => window.scrollTo(0, 500))
    await screenshots.capture('insights-tab-scrolled', {
      fullPage: false,
      description: 'Insights tab - additional recommendations',
    })

    // ========================================
    // Step 10: Tab Switching - Can't Compare
    // ========================================
    // UX PAIN POINT: User wants to see account details while viewing insights
    // but must switch tabs, losing insights context

    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('accounts-tab-after-viewing-insights', {
      fullPage: true,
      description: 'UX FRICTION: Had to leave Insights to see account details',
    })

    // ========================================
    // Step 11: Display Mode Toggle
    // ========================================
    // Check if display mode toggle is visible
    const displayModeButton = page.getByRole('button', { name: /today.*value|future.*value/i })
    if (await displayModeButton.isVisible()) {
      await displayModeButton.click()
      await page.waitForTimeout(300)
      await screenshots.capture('display-mode-toggled', {
        description: 'Display mode toggled (Real vs Nominal)',
      })

      // Close the popover by pressing Escape or clicking elsewhere
      await page.keyboard.press('Escape')
      await page.waitForTimeout(200)
    }

    // ========================================
    // Step 12: Calculations Tab
    // ========================================
    await page.getByRole('tab', { name: 'Calculations' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('calculations-tab', {
      fullPage: true,
      description: 'Calculations tab - detailed breakdown',
    })

    // ========================================
    // Summary Screenshot
    // ========================================
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()
    await screenshots.capture('journey-complete', {
      fullPage: true,
      description: 'Journey complete - back to main view',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 1 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
