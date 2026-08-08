import { test, expect } from "@playwright/test"
import { generate } from "otplib"
import {
  dismissDevOverlay,
  enrollTotp,
  signIn,
  signOut,
  signUpAndConfirm,
} from "../helpers/auth-helper"

test("enrolling in 2FA gates the next sign-in, and a recovery code unblocks + auto-unenrols", async ({ page }) => {
  const email = `mfa-${Date.now()}@test.local`
  const password = "StrongPassword123"

  await signUpAndConfirm(page, email, password)
  const { recoveryCodes } = await enrollTotp(page)

  // Sign out, then back in — must be stopped at the challenge.
  await signOut(page)
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/auth\/mfa/)

  // A recovery code gets in, and is then spent — and, because redemption goes
  // through the server-side auto-unenrol route, the lost factor is fully removed.
  await page.getByRole("button", { name: /use a recovery code/i }).click()
  await page.getByLabel("Recovery code").fill(recoveryCodes[0])
  await page.getByRole("button", { name: /verify/i }).click()
  await expect(page).toHaveURL(/\/calculator/)

  // Proof the auto-unenrol actually happened: signing out and back in with just
  // the password reaches /calculator directly, with no MFA challenge at all.
  await signOut(page)
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/calculator/)
})

test("clearing the TOTP challenge re-syncs the store, not just the URL", async ({ page }) => {
  const email = `mfa-sync-${Date.now()}@test.local`
  const password = "StrongPassword123"

  await signUpAndConfirm(page, email, password)

  // Give the account a scenario with a name we can look for after the challenge.
  // The switcher only renders at all when scenarioList is non-empty, so its
  // presence is exactly the signal this test needs.
  await dismissDevOverlay(page)
  const switcher = page.getByRole("button", { name: /scenario/i }).or(
    page.locator('button:has(span.truncate)').first()
  )
  await expect(switcher.first()).toBeVisible()
  const scenarioName = await switcher.first().innerText()

  const { secret } = await enrollTotp(page)

  await signOut(page)
  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/auth\/mfa/)

  await page.getByLabel(/authenticator app/i).fill(await generate({ secret }))
  await page.getByRole("button", { name: /verify/i }).click()
  await expect(page).toHaveURL(/\/calculator/)

  // The regression: sign-in syncs at aal1, where RLS legitimately returns zero
  // rows, so the store is left with an empty scenarioList and a null
  // activeScenarioId. A client-side router.replace() here would not remount
  // SupabaseProvider (it lives in the root layout), so nothing re-syncs at the
  // now-satisfied aal2 — the user lands on a working-looking /calculator whose
  // edits are silently discarded. Reaching the URL is not enough; the data has
  // to actually be back.
  await dismissDevOverlay(page)
  await expect(page.locator('button:has(span.truncate)').first()).toContainText(
    scenarioName.trim().split("\n")[0]
  )
})
