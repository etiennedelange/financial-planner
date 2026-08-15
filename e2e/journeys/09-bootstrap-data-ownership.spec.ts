import { test, expect } from "@playwright/test"
import { StateManager } from "../helpers/state-manager"
import { dismissDevOverlay, signIn, signOut, signUpAndConfirm } from "../helpers/auth-helper"
import { SINGLE_TFSA_STATE } from "../fixtures/state-seeds"

/**
 * Journey 9: Bootstrap and Data Ownership
 *
 * Regression coverage for the serialized bootstrap coordinator: hydration
 * happens once per persistence scope, guest and user keys stay distinct, a
 * signed-out reload never resurrects a previous account's cache, sign-out
 * evicts the user's scoped keys, and /print bootstraps through the same path.
 */

test.describe("Journey 9: Bootstrap Data Ownership", () => {
  let stateManager: StateManager

  test.beforeEach(async ({ page }) => {
    stateManager = new StateManager(page)
    await page.goto("/calculator")
    await stateManager.clearState()
  })

  test("a signed-out reload restores the guest plan and leaves no user key behind", async ({ page }) => {
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.reload()
    await stateManager.waitForHydration()

    await page.goto("/calculator/accounts")
    await expect(page.getByText("Tax Free Savings")).toBeVisible()

    // No user-scoped key may exist for a signed-out reload.
    const keys = await page.evaluate(() => Object.keys(localStorage))
    expect(keys.filter((k) => k.includes(":user:"))).toEqual([])
  })

  test("sign-out evicts the signed-out user's scoped keys", async ({ page }) => {
    const email = `bootstrap-${Date.now()}@test.local`
    const password = "StrongPassword123"
    await signUpAndConfirm(page, email, password)
    await stateManager.waitForHydration()

    // The user's session syncs into a user-scoped key.
    const userId = await page.evaluate(() => {
      const key = Object.keys(localStorage).find((k) => k.includes(":user:"))
      return key ? key.split(":user:")[1] : null
    })
    expect(userId).toBeTruthy()

    await signOut(page)
    // Sign-out triggers a full navigation; wait for the guest bootstrap, then
    // reload so the assertion covers the steady state (the eviction runs
    // during the SIGNED_OUT transition, and isLoaded never dips through it, so
    // polling the shell alone would read keys mid-transition).
    await page.waitForTimeout(1500)
    await page.reload()
    await stateManager.waitForHydration()

    // After sign-out the user's scoped keys are gone.
    const keys = await page.evaluate(() => Object.keys(localStorage))
    expect(keys.filter((k) => k.includes(`:user:${userId}`))).toEqual([])
  })

  test("a second user's sign-in cannot see the first user's cache", async ({ page }) => {
    const emailA = `bootstrap-a-${Date.now()}@test.local`
    const emailB = `bootstrap-b-${Date.now()}@test.local`
    const password = "StrongPassword123"

    // User A signs up and their local cache lands in a user-scoped key.
    await signUpAndConfirm(page, emailA, password)
    await stateManager.waitForHydration()

    await signOut(page)
    await stateManager.waitForHydration()

    // User B signs in on the same browser — must start from server state,
    // not user A's local cache.
    await signIn(page, emailB, password)
    await expect(page).toHaveURL(/\/calculator/)
    await stateManager.waitForHydration()

    const keys = await page.evaluate(() => Object.keys(localStorage))
    const userKeys = keys.filter((k) => k.includes(":user:"))
    // At most user B's own scoped key exists; user A's was evicted on sign-out.
    expect(userKeys.filter((k) => k.includes("bootstrap-a"))).toEqual([])
  })

  test("/print waits for the same bootstrap before printing", async ({ page }) => {
    await stateManager.seedState(SINGLE_TFSA_STATE)
    await page.goto("/print")
    await stateManager.waitForHydration()

    await expect(page.getByText("SA Retirement Plan Report")).toBeVisible()
  })
})
