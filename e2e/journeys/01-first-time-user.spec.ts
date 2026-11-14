import { test, expect } from "@playwright/test"
import { StateManager } from "../helpers/state-manager"
import { ScreenshotHelper } from "../helpers/screenshot-helper"
import {
  accountDialog,
  continueToPerformance,
  field,
  fillAccountEssentials,
  fillAccountPerformance,
  fillNumber,
  goToPage,
  submitAccount,
  type AccountInput,
} from "../helpers/app-helpers"
import { EMPTY_STATE } from "../fixtures/state-seeds"

/**
 * Journey 1: First-Time User Experience
 *
 * A signed-out user opens the app with nothing saved, adds their first account through the
 * two-step wizard, then walks the sidebar pages to set up their plan and see the results.
 *
 * Key areas documented:
 * - Empty state and the first-account call to action
 * - The two-step add-account wizard (essentials, then performance)
 * - Sidebar navigation: Overview, Plan, Projections, Risk, Charts
 * - Plan edits persist to the store and show formatted values
 * - Monte Carlo runs only on the Risk page
 */
const TFSA: AccountInput = {
  name: "My First TFSA",
  provider: "Allan Gray",
  type: /tax.*free.*savings/i,
  balance: "50000",
  contribution: "2000",
  expectedReturn: "11",
  fees: "0.5",
  escalation: "6",
}

test.describe("Journey 1: First-Time User Experience", () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, "journey-01-first-time-user")
    stateManager = new StateManager(page)

    // Start with empty state, on the Accounts page where a first-time user lands to add one
    await page.goto("/calculator/accounts")
    await stateManager.clearState()
    await stateManager.seedState(EMPTY_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test("should document first-time user flow across the sidebar pages", async ({ page }) => {
    // ========================================
    // Step 1: Empty State
    // ========================================
    await screenshots.capture("empty-state", {
      fullPage: true,
      description: "Initial empty state - no accounts added yet",
    })

    // ========================================
    // Step 2: Add First Account - Step 1 of 2 (Essentials)
    // ========================================
    const addAccountButton = page.getByRole("button", { name: /add.*first.*account/i })
    await expect(addAccountButton).toBeVisible()
    await addAccountButton.click()
    await expect(accountDialog(page)).toBeVisible()
    await screenshots.capture("add-account-dialog-open", {
      description: "Account wizard opened on the Essentials step",
    })

    await fillAccountEssentials(page, TFSA)
    await screenshots.capture("account-essentials-filled", {
      description: "Step 1 of 2 complete: name, provider, type, balance and contribution",
    })

    // ========================================
    // Step 3: Add First Account - Step 2 of 2 (Performance)
    // ========================================
    await continueToPerformance(page)
    await fillAccountPerformance(page, TFSA)
    await screenshots.capture("account-performance-filled", {
      description: "Step 2 of 2 complete: expected return, fees and escalation",
    })

    // ========================================
    // Step 4: Submit and See the Account
    // ========================================
    await submitAccount(page)
    await expect(page.getByText(TFSA.name).first()).toBeVisible()
    await expect.poll(() => stateManager.getAccountCount()).toBe(1)

    // The stored account has the numbers that were typed, not their formatted text
    const state = await stateManager.getState()
    expect(state?.accounts[0]).toMatchObject({
      name: TFSA.name,
      type: "tfsa",
      currentBalance: 50000,
      monthlyContribution: 2000,
      expectedReturn: 11,
      annualFees: 0.5,
      contributionEscalation: 6,
    })

    await screenshots.capture("first-account-added", {
      fullPage: true,
      description: "First account added and listed",
    })

    // ========================================
    // Step 5: Overview
    // ========================================
    await goToPage(page, "Overview")
    // Overview is a verdict plus metric cards; its charts live on the Charts and Risk pages
    await expect(page.getByText(/retirement verdict/i)).toBeVisible()
    await expect(page.getByText(/across 1 account/i)).toBeVisible()
    await screenshots.capture("overview-with-first-account", {
      fullPage: true,
      description: "Overview with the first account's verdict and metrics",
    })

    // ========================================
    // Step 6: Plan - Personal Information and Goals
    // ========================================
    await goToPage(page, "Plan")
    await fillNumber(page, /current age/i, "35")
    await screenshots.capture("plan-personal-info-updated", {
      description: "Current age set on the Plan page",
    })

    await fillNumber(page, /desired monthly income/i, "30000")
    // Shown grouped, stored as a plain number
    await expect(field(page, /desired monthly income/i)).toHaveValue(/^30\s000$/)
    await screenshots.capture("plan-goals-updated", {
      fullPage: true,
      description: "Desired monthly income set; the field shows 30 000",
    })

    await expect
      .poll(async () => {
        const s = await stateManager.getState()
        return [s?.personalInfo.currentAge, s?.retirementGoals.desiredMonthlyIncome]
      })
      .toEqual([35, 30000])

    // ========================================
    // Step 7: Projections
    // ========================================
    await goToPage(page, "Projections")
    await page.waitForLoadState("networkidle")
    await screenshots.capture("projections-after-plan-changes", {
      fullPage: true,
      description: "Projections reflect the new age and income goal",
    })

    // ========================================
    // Step 8: Risk - Monte Carlo
    // ========================================
    await goToPage(page, "Risk")
    await screenshots.waitForMonteCarloSimulation()
    await screenshots.capture("risk-simulation-complete", {
      fullPage: true,
      description: "Monte Carlo simulation completed on the Risk page",
    })

    // ========================================
    // Step 9: Display Mode Toggle
    // ========================================
    const displayModeButton = page.getByRole("button", { name: /today.*value|future.*value/i })
    await expect(displayModeButton).toBeVisible()
    await displayModeButton.click()
    await page.getByText(/today's value \(real\)/i).click()
    await expect(page.getByRole("button", { name: /today's value/i })).toBeVisible()
    await screenshots.capture("display-mode-toggled", {
      description: "Display mode switched to Today's Value (Real)",
    })

    // ========================================
    // Step 10: Charts, Then Back to Plan
    // ========================================
    await goToPage(page, "Charts")
    await screenshots.waitForCharts()
    await screenshots.capture("charts-page", {
      fullPage: true,
      description: "Charts page",
    })

    // The plan edits are still there after visiting other pages
    await goToPage(page, "Plan")
    await expect(field(page, /current age/i)).toHaveValue("35")
    await screenshots.capture("journey-complete", {
      fullPage: true,
      description: "Journey complete - plan values persisted across navigation",
    })

    // Log captured screenshots
    console.log(
      `\n✅ Journey 1 complete: ${screenshots.getScreenshots().length} screenshots captured`,
    )
    console.log("\n📸 Screenshots:")
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
