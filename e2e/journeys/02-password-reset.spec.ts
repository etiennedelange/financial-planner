import { test, expect } from "@playwright/test"

// Local Supabase captures outbound mail in Mailpit on port 54324
// (the [inbucket] config section is deprecated in favor of [local_smtp]/Mailpit;
// Mailpit's API is /api/v1/search + /api/v1/message/{id}, not Inbucket's /api/v1/mailbox/{name}).
const MAILPIT = "http://127.0.0.1:54324"

async function latestResetLink(email: string): Promise<string> {
  const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email} subject:"Reset"`)}`)
  const { messages } = await res.json()
  const newest = messages[0]
  if (!newest) throw new Error("No reset email found")
  const detail = await fetch(`${MAILPIT}/api/v1/message/${newest.ID}`).then((r) => r.json())
  const match = (detail.Text as string).match(/https?:\/\/\S+/)
  if (!match) throw new Error("No link in reset email")
  return match[0]
}

test("password reset requires setting a new password", async ({ page }) => {
  const email = `reset-${Date.now()}@test.local`
  const oldPassword = "OldPassword123"
  const newPassword = "NewPassword456"

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /sign up/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(oldPassword)
  await page.getByRole("button", { name: /create account/i }).click()

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /forgot password/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: /send reset link/i }).click()
  await expect(page.getByText(/reset link sent/i)).toBeVisible()

  await page.goto(await latestResetLink(email))

  // The defect this test exists for: the link must NOT drop the user in the app.
  await expect(page).toHaveURL(/\/auth\/reset-password/)
  await expect(page.getByText(/set a new password/i)).toBeVisible()

  await page.getByLabel("New password").fill(newPassword)
  await page.getByLabel("Confirm password").fill(newPassword)
  await page.getByRole("button", { name: /update password/i }).click()
  await expect(page).toHaveURL(/reset=success/)

  // signOut({ scope: "others" }) intentionally keeps THIS browser's session alive
  // (only other sessions are killed) — sign out of it explicitly before checking
  // that the old password is dead, otherwise there's no "Sign in" button to click.
  await page.getByRole("button", { name: "Account menu" }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()

  // The old password must be dead.
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(oldPassword)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
})
