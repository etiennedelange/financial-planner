import { test, expect, type Page } from "@playwright/test"
import { StateManager } from "../helpers/state-manager"
import { ScreenshotHelper } from "../helpers/screenshot-helper"
import {
  accountDialog,
  continueToPerformance,
  fillAccountEssentials,
  fillAccountPerformance,
  goToPage,
  submitAccount,
  type AccountInput,
} from "../helpers/app-helpers"
import { EMPTY_STATE } from "../fixtures/state-seeds"

/**
 * Journey 2: Multi-Account Setup
 *
 * A user builds a portfolio of three accounts (TFSA, RA, Pension Fund) through the
 * two-step wizard, then checks the aggregated views.
 *
 * Key areas documented:
 * - Adding multiple accounts, from the empty state and then from the floating Add Account bar
 * - The portfolio summary and the grouped account list
 * - Every typed number is stored as a number (not its formatted text)
 * - Aggregated figures on Overview, Charts and Risk
 */
const TFSA: AccountInput = {
  name: "Tax-Free Savings",
  provider: "Allan Gray",
  type: /tax.*free.*savings/i,
  balance: "350000",
  contribution: "3000",
  expectedReturn: "11",
  fees: "0.5",
  escalation: "6",
}
const RA: AccountInput = {
  name: "Retirement Annuity",
  provider: "10X Investments",
  type: /retirement annuity/i,
  balance: "450000",
  contribution: "5000",
  expectedReturn: "10.5",
  fees: "1.0",
  escalation: "7",
}
const PENSION: AccountInput = {
  name: "Company Pension Fund",
  provider: "Sanlam",
  type: /pension fund/i,
  balance: "800000",
  contribution: "4000",
  expectedReturn: "9.5",
  fees: "1.2",
  escalation: "7",
}

test.describe("Journey 2: Multi-Account Setup", () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, "journey-02-multi-account-setup")
    stateManager = new StateManager(page)

    // Start with empty state
    await page.goto("/calculator/accounts")
    await stateManager.clearState()
    await stateManager.seedState(EMPTY_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  /** Run the whole wizard for one account, with a screenshot at each stage. */
  async function addWithScreenshots(page: Page, account: AccountInput, slug: string) {
    await fillAccountEssentials(page, account)
    await screenshots.capture(`${slug}-essentials-filled`, {
      description: `${account.name}: step 1 of 2 (essentials) filled`,
    })
    await continueToPerformance(page)
    await fillAccountPerformance(page, account)
    await screenshots.capture(`${slug}-performance-filled`, {
      description: `${account.name}: step 2 of 2 (performance) filled`,
    })
    await submitAccount(page)
  }

  test("should document multi-account setup and management", async ({ page }) => {
    // ========================================
    // Step 1: Add First Account (TFSA) from the empty state
    // ========================================
    await screenshots.capture("empty-state-ready-for-accounts", {
      fullPage: true,
      description: "Empty state - ready to add multiple accounts",
    })

    await page.getByRole("button", { name: /add.*first.*account/i }).click()
    await expect(accountDialog(page)).toBeVisible()
    await addWithScreenshots(page, TFSA, "tfsa")
    await expect(page.getByText(TFSA.name).first()).toBeVisible()
    await expect.poll(() => stateManager.getAccountCount()).toBe(1)
    await screenshots.capture("first-account-added-tfsa", {
      fullPage: true,
      description: "First account (TFSA) added",
    })

    // ========================================
    // Step 2: Add Second Account (RA) from the floating bar
    // ========================================
    await page.getByRole("button", { name: /^add account$/i }).click()
    await expect(accountDialog(page)).toBeVisible()
    await addWithScreenshots(page, RA, "ra")
    await expect(page.getByText(RA.name).first()).toBeVisible()
    await expect.poll(() => stateManager.getAccountCount()).toBe(2)
    await screenshots.capture("second-account-added-ra", {
      fullPage: true,
      description: "Second account (RA) added - portfolio now has 2 accounts",
    })

    // ========================================
    // Step 3: Add Third Account (Pension Fund)
    // ========================================
    await page.getByRole("button", { name: /^add account$/i }).click()
    await expect(accountDialog(page)).toBeVisible()
    await addWithScreenshots(page, PENSION, "pension")
    await expect(page.getByText(PENSION.name).first()).toBeVisible()
    await expect.poll(() => stateManager.getAccountCount()).toBe(3)

    // ========================================
    // Step 4: Portfolio Summary and Stored Values
    // ========================================
    await expect(page.getByText(/3 accounts/i).first()).toBeVisible()
    await screenshots.capture("multi-account-portfolio-summary", {
      fullPage: true,
      description: "Portfolio summary with all 3 accounts - grouped by type",
    })

    // Every typed number was stored as a number, including decimals like 10.5 and 1.2
    const state = await stateManager.getState()
    const byName = Object.fromEntries((state?.accounts ?? []).map((a) => [a.name, a]))
    expect(byName[TFSA.name]).toMatchObject({
      type: "tfsa",
      currentBalance: 350000,
      monthlyContribution: 3000,
      expectedReturn: 11,
      annualFees: 0.5,
      contributionEscalation: 6,
    })
    expect(byName[RA.name]).toMatchObject({
      type: "retirement_annuity",
      currentBalance: 450000,
      monthlyContribution: 5000,
      expectedReturn: 10.5,
      annualFees: 1,
      contributionEscalation: 7,
    })
    expect(byName[PENSION.name]).toMatchObject({
      type: "pension_fund",
      currentBalance: 800000,
      monthlyContribution: 4000,
      expectedReturn: 9.5,
      annualFees: 1.2,
      contributionEscalation: 7,
    })

    // ========================================
    // Step 5: Aggregated Views
    // ========================================
    await goToPage(page, "Overview")
    await expect(page.getByText(/across 3 accounts/i)).toBeVisible()
    await screenshots.capture("overview-three-accounts", {
      fullPage: true,
      description: "Overview aggregating all three accounts",
    })

    await goToPage(page, "Charts")
    await screenshots.waitForCharts()
    await screenshots.capture("charts-with-three-accounts", {
      fullPage: true,
      description: "Charts showing aggregated projections for 3 accounts",
    })

    await goToPage(page, "Risk")
    await screenshots.waitForMonteCarloSimulation()
    await screenshots.capture("risk-with-three-accounts", {
      fullPage: true,
      description: "Monte Carlo run across the whole portfolio",
    })

    // ========================================
    // Step 6: Back to Accounts
    // ========================================
    await goToPage(page, "Accounts")
    await expect(page.getByText(TFSA.name).first()).toBeVisible()
    await expect(page.getByText(RA.name).first()).toBeVisible()
    await expect(page.getByText(PENSION.name).first()).toBeVisible()
    await screenshots.capture("back-to-accounts", {
      fullPage: true,
      description: "All three accounts still listed after visiting other pages",
    })

    // Log captured screenshots
    console.log(
      `\n✅ Journey 2 complete: ${screenshots.getScreenshots().length} screenshots captured`,
    )
    console.log("\n📸 Screenshots:")
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
