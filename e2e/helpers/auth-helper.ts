import { expect, type Page } from "@playwright/test"
import { generate } from "otplib"

// Local Supabase captures outbound mail in Mailpit on port 54324
// (the [inbucket] config section is deprecated in favor of [local_smtp]/Mailpit;
// Mailpit's API is /api/v1/search + /api/v1/message/{id}, not Inbucket's /api/v1/mailbox/{name}).
export const MAILPIT = "http://127.0.0.1:54324"

/** Pulls the first URL out of the newest mail to `email` whose subject matches. */
export async function latestMailLink(email: string, subject: string): Promise<string> {
  const res = await fetch(
    `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"${subject}"`)}`
  )
  const { messages } = await res.json()
  const newest = messages[0]
  if (!newest) throw new Error(`No "${subject}" email found for ${email}`)
  const detail = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`).then((r) => r.json())
  const match = (detail.Text as string).match(/https?:\/\/\S+/)
  if (!match) throw new Error(`No link in "${subject}" email`)
  return match[0]
}

// The sidebar's account-menu button sits bottom-left — exactly where Next's
// dev-mode "issues" badge appears (e.g. the expected RLS rejection when
// claimLocalData runs against a still-gated aal1 session), which then
// intercepts clicks meant for the button underneath. Dev-overlay-only.
export async function dismissDevOverlay(page: Page) {
  const collapse = page.getByRole("button", { name: "Collapse issues badge" })
  if (await collapse.isVisible().catch(() => false)) await collapse.click()
}

/**
 * Signs up and follows the emailed confirmation link, landing signed in.
 * Signup requires email confirmation before a session exists, so the link
 * (via /auth/callback) is what actually establishes one.
 */
export async function signUpAndConfirm(page: Page, email: string, password: string) {
  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /sign up/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /create account/i }).click()
  await expect(page.getByText(/check your email/i)).toBeVisible()

  await page.goto(await latestMailLink(email, "Confirm"))
  await expect(page).toHaveURL(/\/calculator/)
}

export async function signIn(page: Page, email: string, password: string) {
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()
}

export async function signOut(page: Page) {
  await dismissDevOverlay(page)
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
}

/**
 * Enrols TOTP from the Manage Account flow for the currently signed-in user.
 * "Manage Account" navigates to /calculator/settings — a route, not a modal —
 * so the enrolment UI renders inline on that page; the recovery-codes dialog is
 * the only role="dialog" in the flow.
 * Returns the shared secret (for minting live codes) and the recovery codes.
 */
export async function enrollTotp(page: Page): Promise<{ secret: string; recoveryCodes: string[] }> {
  await dismissDevOverlay(page)
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /manage account/i }).click()
  await page.getByRole("button", { name: /set up two-factor/i }).click()

  // The enrolment secret renders inline on the settings page. .break-all is
  // unique to it — plain ".font-mono" also matches the "Security" SectionLabel
  // heading rendered above it.
  const rawSecret = await page.locator("p.font-mono.break-all").innerText()
  const secret = rawSecret.trim()
  await page.getByLabel("Six-digit code").fill(await generate({ secret }))
  await page.getByRole("button", { name: /verify & enable/i }).click()

  const dialog = page.getByRole("dialog")
  const codeCells = dialog.locator(".font-mono span")
  await expect(codeCells).toHaveCount(10)
  const recoveryCodes = await codeCells.allInnerTexts()
  // "Download" rather than "Copy" — Copy calls navigator.clipboard.writeText(),
  // which throws (unhandled) without an explicit clipboard-write permission grant
  // in this headless context; Download needs no such permission.
  await page.getByRole("button", { name: /^download$/i }).click()
  await page.getByRole("button", { name: /i've saved them/i }).click()

  // The recovery-codes dialog closes after saving; the settings page remains.
  const openDialog = page.locator('[role="dialog"][data-state="open"]')
  await expect(openDialog).toHaveCount(0)

  return { secret, recoveryCodes }
}

/** Answers a TOTP prompt (the /auth/mfa gate, or a reauth dialog) with a live code. */
export async function fillTotpCode(page: Page, secret: string, label: RegExp | string) {
  await page.getByLabel(label).fill(await generate({ secret }))
}
