import { test, expect } from "@playwright/test"
import { StateManager } from "../helpers/state-manager"
import { ScreenshotHelper } from "../helpers/screenshot-helper"
import { field, fillNumber, goToPage } from "../helpers/app-helpers"
import { SINGLE_TFSA_STATE } from "../fixtures/state-seeds"

/**
 * Journey 3: Personal Information & Goals
 *
 * A user with one account sets their personal details and retirement goals on the Plan
 * page, checks what changed on Overview, Projections and Risk, and hits a validation rule.
 *
 * Key areas documented:
 * - Personal information (ages, annual income) and goals (income, legacy, inflation) on Plan
 * - Fields show formatted values (750 000) but the store holds plain numbers
 * - The effect of the edits on Overview and Risk
 * - Validation: an invalid age is explained and never reaches the store
 */
test.describe("Journey 3: Personal Information & Goals", () => {
  let screenshots: ScreenshotHelper
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    screenshots = new ScreenshotHelper(page, "journey-03-personal-goals")
    stateManager = new StateManager(page)

    // Start with a single TFSA account
    await page.goto("/calculator/overview")
    await stateManager.clearState()
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.reload()
    await stateManager.waitForHydration()
  })

  test("should document personal info and goals adjustment flow", async ({ page }) => {
    // ========================================
    // Step 1: Starting Point - Overview with Default Plan
    // ========================================
    await expect(page.getByText(/retirement verdict/i)).toBeVisible()
    await expect(page.getByText(/retiring at 65 · now 35/i)).toBeVisible()
    await screenshots.capture("initial-overview-default-plan", {
      fullPage: true,
      description: "Starting point - account exists, default personal info (35, retiring at 65)",
    })

    // ========================================
    // Step 2: Plan Page - Defaults
    // ========================================
    await goToPage(page, "Plan")
    await expect(field(page, /current age/i)).toHaveValue("35")
    await expect(field(page, /retirement age/i)).toHaveValue("65")
    await expect(field(page, /life expectancy/i)).toHaveValue("90")
    await screenshots.capture("plan-page-defaults", {
      fullPage: true,
      description: "Plan page - default values visible",
    })

    // ========================================
    // Step 3: Adjust Personal Information
    // ========================================
    await fillNumber(page, /current age/i, "40")
    await screenshots.capture("current-age-updated", {
      description: "Current age changed to 40",
    })

    await fillNumber(page, /retirement age/i, "60")
    await screenshots.capture("retirement-age-updated", {
      description: "Retirement age changed to 60",
    })

    await fillNumber(page, /life expectancy/i, "85")
    await screenshots.capture("life-expectancy-updated", {
      description: "Life expectancy changed to 85",
    })

    await fillNumber(page, /annual income/i, "750000")
    // Shown grouped, stored as a plain number
    await expect(field(page, /annual income/i)).toHaveValue(/^750\s000$/)
    await screenshots.capture("annual-income-updated", {
      fullPage: true,
      description: "Annual income changed to R750 000; the field shows 750 000",
    })

    // ========================================
    // Step 4: Adjust Retirement Goals and Assumptions
    // ========================================
    await fillNumber(page, /desired monthly income/i, "40000")
    await screenshots.capture("desired-income-updated", {
      description: "Desired monthly income set to R40 000",
    })

    await fillNumber(page, /legacy goal/i, "500000")
    await screenshots.capture("legacy-goal-updated", {
      description: "Legacy goal set to R500 000",
    })

    await fillNumber(page, /expected inflation/i, "6.5")
    await expect(field(page, /expected inflation/i)).toHaveValue("6.5")
    await screenshots.capture("inflation-rate-updated", {
      fullPage: true,
      description: "Expected inflation set to 6.5%",
    })

    // Every edit reached the store as a number
    await expect
      .poll(async () => {
        const s = await stateManager.getState()
        return {
          age: s?.personalInfo.currentAge,
          retire: s?.personalInfo.retirementAge,
          life: s?.personalInfo.lifeExpectancy,
          income: s?.personalInfo.annualIncome,
          desired: s?.retirementGoals.desiredMonthlyIncome,
          legacy: s?.retirementGoals.legacyAmount,
          inflation: s?.retirementGoals.inflationRate,
        }
      })
      .toEqual({
        age: 40,
        retire: 60,
        life: 85,
        income: 750000,
        desired: 40000,
        legacy: 500000,
        inflation: 6.5,
      })

    // ========================================
    // Step 5: Validation - an Invalid Age Is Explained and Not Stored
    // ========================================
    await field(page, /retirement age/i).fill("40")
    await expect(page.getByText(/retirement age must be after current age/i)).toBeVisible()
    await screenshots.capture("validation-retirement-before-current", {
      fullPage: true,
      description: "Retirement age equal to current age is rejected with a message",
    })
    const afterInvalid = await stateManager.getState()
    expect(afterInvalid?.personalInfo.retirementAge).toBe(60)

    // Fix it
    await fillNumber(page, /retirement age/i, "60")
    await expect(page.getByText(/retirement age must be after current age/i)).toBeHidden()

    // ========================================
    // Step 6: See the Impact
    // ========================================
    await goToPage(page, "Overview")
    await expect(page.getByText(/retiring at 60 · now 40/i)).toBeVisible()
    await screenshots.capture("overview-after-plan-changes", {
      fullPage: true,
      description: "Overview reflects the new ages (40, retiring at 60)",
    })

    await goToPage(page, "Projections")
    await page.waitForLoadState("networkidle")
    await screenshots.capture("projections-after-plan-changes", {
      fullPage: true,
      description: "Projections with the new plan",
    })

    await goToPage(page, "Risk")
    await screenshots.waitForMonteCarloSimulation()
    await screenshots.capture("risk-after-plan-changes", {
      fullPage: true,
      description: "Monte Carlo success rate for the updated plan",
    })

    // ========================================
    // Step 7: Everything Persisted Across Navigation
    // ========================================
    await goToPage(page, "Plan")
    await expect(field(page, /current age/i)).toHaveValue("40")
    await expect(field(page, /retirement age/i)).toHaveValue("60")
    await expect(field(page, /annual income/i)).toHaveValue(/^750\s000$/)
    await expect(field(page, /desired monthly income/i)).toHaveValue(/^40\s000$/)
    await screenshots.capture("final-plan-page", {
      fullPage: true,
      description: "Back on Plan - all edits persisted across navigation",
    })

    // Log captured screenshots
    console.log(
      `\n✅ Journey 3 complete: ${screenshots.getScreenshots().length} screenshots captured`,
    )
    console.log("\n📸 Screenshots:")
    screenshots.getScreenshots().forEach(({ filename, description }, index) => {
      console.log(`   ${index + 1}. ${filename} - ${description}`)
    })
  })
})
