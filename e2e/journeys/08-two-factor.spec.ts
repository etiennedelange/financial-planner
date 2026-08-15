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

  // No protected plan-data reads or writes may reach PostgREST while the
  // session is at aal1 and a verified factor requires aal2: the coordinator
  // stops at the mfa-required phase before any claim or sync actor can run.
  // (The settings page's Active Sessions panel calls the my_sessions RPC on
  // re-render — that is session metadata, not plan data, so only the four
  // plan tables are tracked.)
  const restRequests: string[] = []
  const PLAN_TABLES = ["/scenarios", "/accounts", "/expense_groups", "/expenses"]
  const trackRest = (url: string) => restRequests.push(url)
  page.on("request", (req) => {
    if (
      req.url().includes("/rest/v1/") &&
      PLAN_TABLES.some((t) => req.url().includes(t))
    ) {
      trackRest(req.url())
    }
  })

  await signIn(page, email, password)
  await expect(page).toHaveURL(/\/auth\/mfa/)

  // The gate held: nothing reached PostgREST while at aal1.
  expect(restRequests).toHaveLength(0)

  // A recovery code gets in, and is then spent — and, because redemption goes
  // through the server-side auto-unenrol route, the lost factor is fully removed.
  await page.getByRole("button", { name: /use a recovery code/i }).click()
  await page.getByLabel("Recovery code").fill(recoveryCodes[0])
  // The challenge page loads the factor list asynchronously after mount; the
  // submit handler waits for it, but the button only becomes clickable once
  // a code is entered — fill and click, then wait for navigation.
  await page.getByRole("button", { name: /verify/i }).click()
  await expect(page).toHaveURL(/\/calculator/)

  // After elevation the store must have synced — at aal2, unlike the gated
  // sign-in above. The elevation is a full navigation (window.location.href),
  // so wait for the post-navigation sync request rather than racing the URL.
  await expect
    .poll(() => restRequests.length, { timeout: 15000 })
    .toBeGreaterThan(0)

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

  // The regression: on a pre-bootstrap sign-in at aal1 the coordinator stops at
  // the mfa-required phase — claim, scenario sync, and expense sync must NOT
  // run before elevation (RLS would return zero rows at aal1 anyway, but the
  // coordinator's ordering is what guarantees the protected reads happen only
  // after the challenge). A client-side router.replace() here would not remount
  // SupabaseProvider (it lives in the root layout), so nothing re-syncs at the
  // now-satisfied aal2 — the user lands on a working-looking /calculator whose
  // edits are silently discarded. Reaching the URL is not enough; the data has
  // to actually be back, which is only possible because the coordinator's
  // mfa-required phase held back sync until the full-navigation remount.
  await dismissDevOverlay(page)
  await expect(page.locator('button:has(span.truncate)').first()).toContainText(
    scenarioName.trim().split("\n")[0]
  )
})
