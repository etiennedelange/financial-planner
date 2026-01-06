import { test, expect } from '@playwright/test'
import { StateManager } from '../helpers/state-manager'
import { ScreenshotHelper } from '../helpers/screenshot-helper'
import { EMPTY_STATE } from '../fixtures/state-seeds'

/**
 * Journey 2: Multi-Account Setup
 *
 * This test documents the journey of a user setting up multiple retirement accounts.
 * It captures the UX of managing multiple accounts and viewing aggregated projections.
 *
 * Key areas documented:
 * - Adding multiple accounts (TFSA, RA, Pension Fund)
 * - Portfolio summary with multiple accounts
 * - Aggregated chart projections
 * - Individual account management
 */
test.describe('Journey 2: Multi-Account Setup', () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, 'journey-02-multi-account-setup')
    stateManager = new StateManager(page)

    // Start with empty state
    await page.goto('/calculator')
    await stateManager.clearState()
    await stateManager.seedState(EMPTY_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test('should document multi-account setup and management', async ({ page }) => {
    // ========================================
    // Step 1: Add First Account (TFSA)
    // ========================================
    await screenshots.capture('empty-state-ready-for-accounts', {
      fullPage: true,
      description: 'Empty state - ready to add multiple accounts',
    })

    const addAccountButton = page.getByRole('button', { name: /add.*first.*account/i })
    await addAccountButton.click()
    await screenshots.waitForDialogAnimation()

    // Fill TFSA account
    await page.getByLabel(/account name/i).fill('Tax-Free Savings')
    await page.getByLabel(/provider/i).fill('Allan Gray')

    const accountTypeSelect = page.locator('button[role="combobox"]').filter({ hasText: /retirement annuity|select account type/i })
    await accountTypeSelect.click()
    await screenshots.waitForDialogAnimation()
    await page.getByRole('option', { name: /tax.*free.*savings/i }).click()

    await page.getByLabel(/current balance/i).fill('350000')
    await page.getByLabel(/monthly contribution/i).fill('3000')
    await page.getByLabel(/expected return/i).fill('11')
    await page.getByLabel(/annual fees/i).fill('0.5')
    await page.getByLabel(/^escalation/i).fill('6')

    await screenshots.capture('tfsa-account-form-filled', {
      description: 'TFSA account details filled',
    })

    await page.getByRole('button', { name: /add account/i }).click()
    await page.waitForTimeout(500)

    await screenshots.capture('first-account-added-tfsa', {
      fullPage: true,
      description: 'First account (TFSA) added successfully',
    })

    // ========================================
    // Step 2: Add Second Account (RA)
    // ========================================
    const addAnotherButton = page.getByRole('button', { name: /add account/i })
    await addAnotherButton.click()
    await screenshots.waitForDialogAnimation()

    // Fill RA account
    await page.getByLabel(/account name/i).fill('Retirement Annuity')
    await page.getByLabel(/provider/i).fill('10X Investments')

    const accountTypeSelect2 = page.locator('button[role="combobox"]').filter({ hasText: /retirement annuity|select account type/i })
    await accountTypeSelect2.click()
    await screenshots.waitForDialogAnimation()
    await page.getByRole('option', { name: /retirement annuity.*ra/i }).click()

    await page.getByLabel(/current balance/i).fill('450000')
    await page.getByLabel(/monthly contribution/i).fill('5000')
    await page.getByLabel(/expected return/i).fill('10.5')
    await page.getByLabel(/annual fees/i).fill('1.0')
    await page.getByLabel(/^escalation/i).fill('7')

    await screenshots.capture('ra-account-form-filled', {
      description: 'RA account details filled',
    })

    await page.getByRole('button', { name: /add account/i }).click()
    await page.waitForTimeout(500)

    await screenshots.capture('second-account-added-ra', {
      fullPage: true,
      description: 'Second account (RA) added - portfolio now has 2 accounts',
    })

    // Wait for charts to update
    await screenshots.waitForCharts()
    await screenshots.capture('charts-with-two-accounts', {
      description: 'Charts showing aggregated projections for 2 accounts',
    })

    // ========================================
    // Step 3: Add Third Account (Pension Fund)
    // ========================================
    await page.getByRole('button', { name: /add account/i }).click()
    await screenshots.waitForDialogAnimation()

    // Fill Pension Fund account
    await page.getByLabel(/account name/i).fill('Company Pension Fund')
    await page.getByLabel(/provider/i).fill('Sanlam')

    const accountTypeSelect3 = page.locator('button[role="combobox"]').filter({ hasText: /retirement annuity|select account type/i })
    await accountTypeSelect3.click()
    await screenshots.waitForDialogAnimation()
    await page.getByRole('option', { name: /pension fund/i }).click()

    await page.getByLabel(/current balance/i).fill('800000')
    await page.getByLabel(/monthly contribution/i).fill('4000')
    await page.getByLabel(/expected return/i).fill('9.5')
    await page.getByLabel(/annual fees/i).fill('1.2')
    await page.getByLabel(/^escalation/i).fill('7')

    await screenshots.capture('pension-account-form-filled', {
      description: 'Pension Fund account details filled',
    })

    await page.getByRole('button', { name: /add account/i }).click()
    await page.waitForTimeout(500)

    await screenshots.capture('third-account-added-pension', {
      fullPage: true,
      description: 'Third account (Pension Fund) added - complete multi-account portfolio',
    })

    // ========================================
    // Step 4: View Portfolio Summary
    // ========================================
    await screenshots.waitForCharts()
    await screenshots.waitForMonteCarloSimulation()

    await screenshots.capture('multi-account-portfolio-summary', {
      fullPage: true,
      description: 'Portfolio summary with all 3 accounts - aggregated view',
    })

    // Verify all accounts are visible (using heading role to avoid multiple matches)
    await expect(page.getByRole('heading', { name: 'Tax-Free Savings' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Retirement Annuity' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Company Pension Fund' })).toBeVisible()

    // Scroll to see all accounts
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await screenshots.capture('all-accounts-list-view', {
      fullPage: false,
      description: 'All three accounts visible in the list',
    })

    // ========================================
    // Step 5: Check Insights with Multiple Accounts
    // ========================================
    await page.getByRole('tab', { name: 'Insights' }).click()
    await screenshots.waitForTabTransition()
    await page.waitForTimeout(500)

    await screenshots.capture('insights-multi-account', {
      fullPage: true,
      description: 'Insights tab with multi-account portfolio analysis',
    })

    // ========================================
    // Step 6: Return to Accounts Tab
    // ========================================
    // UX PAIN POINT: Must switch back to see account details
    await page.getByRole('tab', { name: 'Accounts' }).click()
    await screenshots.waitForTabTransition()

    await screenshots.capture('back-to-accounts-from-insights', {
      fullPage: true,
      description: 'UX FRICTION: Switched back to Accounts to review account details',
    })

    // Log captured screenshots
    console.log(`\n✅ Journey 2 complete: ${screenshots.getScreenshots().length} screenshots captured`)
    console.log('\n📸 Screenshots:')
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
