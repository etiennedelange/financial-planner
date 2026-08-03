import { test, expect, type Page } from "@playwright/test"
import { generate } from "otplib"

// Local Supabase captures outbound mail in Mailpit on port 54324 (see
// e2e/journeys/02-password-reset.spec.ts for the Inbucket→Mailpit API note).
const MAILPIT = "http://127.0.0.1:54324"

async function latestConfirmationLink(email: string): Promise<string> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"Confirm"`)}`)
  const { messages } = await res.json()
  const newest = messages[0]
  if (!newest) throw new Error("No confirmation email found")
  const detail = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`).then((r) => r.json())
  const match = (detail.Text as string).match(/https?:\/\/\S+/)
  if (!match) throw new Error("No link in confirmation email")
  return match[0]
}

// The sidebar's account-menu button sits bottom-left — exactly where Next's
// dev-mode "issues" badge appears (e.g. the expected RLS rejection when
// claimLocalData runs against a still-gated aal1 session), which then
// intercepts clicks meant for the button underneath. Dev-overlay-only.
async function dismissDevOverlay(page: Page) {
  const collapse = page.getByRole("button", { name: "Collapse issues badge" })
  if (await collapse.isVisible().catch(() => false)) await collapse.click()
}

test("enrolling in 2FA gates the next sign-in, and a recovery code unblocks + auto-unenrols", async ({ page }) => {
  const email = `mfa-${Date.now()}@test.local`
  const password = "StrongPassword123"

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /sign up/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /create account/i }).click()
  await expect(page.getByText(/check your email/i)).toBeVisible()

  // Signup requires email confirmation before a session exists — follow the
  // confirmation link (via /auth/callback) to actually land signed in.
  await page.goto(await latestConfirmationLink(email))
  await expect(page).toHaveURL(/\/calculator/)

  await dismissDevOverlay(page)
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /manage account/i }).click()
  await page.getByRole("button", { name: /set up two-factor/i }).click()

  const dialog = page.getByRole("dialog")
  // .break-all is unique to the enrolment secret — plain ".font-mono" also
  // matches the "Security" SectionLabel heading rendered above it.
  const secret = await dialog.locator("p.font-mono.break-all").innerText()
  const totpCode = await generate({ secret: secret.trim() })
  await page.getByLabel("Six-digit code").fill(totpCode)
  await page.getByRole("button", { name: /verify & enable/i }).click()

  const codeCells = dialog.locator(".font-mono span")
  await expect(codeCells).toHaveCount(10)
  const recoveryCode = await codeCells.first().innerText()
  // "Download" rather than "Copy" — Copy calls navigator.clipboard.writeText(),
  // which throws (unhandled) without an explicit clipboard-write permission grant
  // in this headless context; Download needs no such permission.
  await page.getByRole("button", { name: /^download$/i }).click()
  await page.getByRole("button", { name: /i've saved them/i }).click()

  // The Manage Account dialog stays open after enrolment (only the nested
  // recovery-codes dialog closes) — dismiss it before the sidebar's account
  // menu is reachable again. Scope to [data-state="open"]: the just-closed
  // recovery-codes dialog is still in the DOM mid-exit-animation.
  const openDialog = page.locator('[role="dialog"][data-state="open"]')
  await openDialog.getByRole("button", { name: "Close" }).click()
  await expect(openDialog).toHaveCount(0)

  // Sign out, then back in — must be stopped at the challenge.
  await dismissDevOverlay(page)
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()

  await expect(page).toHaveURL(/\/auth\/mfa/)

  // A recovery code gets in, and is then spent — and, because redemption goes
  // through the server-side auto-unenrol route, the lost factor is fully removed.
  await page.getByRole("button", { name: /use a recovery code/i }).click()
  await page.getByLabel("Recovery code").fill(recoveryCode)
  await page.getByRole("button", { name: /verify/i }).click()
  await expect(page).toHaveURL(/\/calculator/)

  // Proof the auto-unenrol actually happened: signing out and back in with just
  // the password reaches /calculator directly, with no MFA challenge at all.
  await dismissDevOverlay(page)
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()

  await expect(page).toHaveURL(/\/calculator/)
})
