import { expect, type Page } from "@playwright/test"

/**
 * Helpers for driving the post-redesign app: a sidebar with one page per area
 * (Overview, Accounts, Plan, Expenses, Projections, Risk, Charts) instead of tabs.
 *
 * Numeric fields are plain text boxes (NumberField) that format as you type, so they are
 * found with `getByRole("textbox", { name })`. `getByLabel` is ambiguous for fields with a
 * stepper, because "Increase <label>" / "Decrease <label>" buttons carry the same text.
 */

export type PageName =
  | "Overview"
  | "Accounts"
  | "Plan"
  | "Expenses"
  | "Projections"
  | "Risk"
  | "Charts"

/**
 * Click a navigation link and wait for the route to change. The desktop sidebar is
 * "Main navigation" and the phone layout has a bottom bar called "Mobile navigation";
 * role queries only match the one that is visible, so this works at every viewport.
 */
export async function goToPage(page: Page, name: PageName) {
  await hideDevIndicator(page)
  const nav = page.getByRole("navigation", { name: /main navigation|mobile navigation/i })
  // The Accounts link carries a count badge ("Accounts 1"), so match the start of the name.
  await nav.getByRole("link", { name: new RegExp(`^${name}`) }).click()
  await page.waitForURL(`**/calculator/${name.toLowerCase()}`)
}

/**
 * Hide the Next.js dev-tools badge. In `next dev` it floats at the bottom-left and covers the
 * first tab of the phone's bottom navigation, so clicks on "Overview" are intercepted and
 * Playwright retries until the test times out. It does not exist in a production build.
 */
export async function hideDevIndicator(page: Page) {
  await page.evaluate(() => {
    if (document.getElementById("e2e-hide-dev-indicator")) return
    const style = document.createElement("style")
    style.id = "e2e-hide-dev-indicator"
    style.textContent = "nextjs-portal { display: none !important }"
    document.head.appendChild(style)
  })
}

/** A numeric text box by its visible label. */
export function field(page: Page, name: RegExp | string) {
  return page.getByRole("textbox", { name })
}

/**
 * Fill a numeric field and wait until its value has been written to the persisted store.
 * Values are validated before they reach the store, so this also proves the input was valid.
 */
export async function fillNumber(page: Page, name: RegExp | string, value: string) {
  const input = field(page, name)
  await input.fill(value)
  // The field formats as you type (600000 -> "600 000"), so compare digits only.
  await expect
    .poll(async () => (await input.inputValue()).replace(/\D/g, "").replace(/^0+(?=\d)/, ""))
    .toBe(value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))
}

export interface AccountInput {
  name: string
  provider: string
  /** Matches the option's name in the Account type list. */
  type: RegExp
  balance: string
  contribution: string
  expectedReturn: string
  fees: string
  escalation: string
}

/** The Add Account dialog. */
export const accountDialog = (page: Page) => page.getByRole("dialog", { name: /add account/i })

/** Step 1 of the add-account wizard: essentials. */
export async function fillAccountEssentials(page: Page, a: AccountInput) {
  const dialog = accountDialog(page)
  await dialog.getByRole("textbox", { name: /account name/i }).fill(a.name)
  await dialog.getByRole("textbox", { name: /provider/i }).fill(a.provider)
  await dialog.getByRole("combobox", { name: /account type/i }).click()
  await page.getByRole("option", { name: a.type }).click()
  await dialog.getByRole("textbox", { name: /current balance/i }).fill(a.balance)
  await dialog.getByRole("textbox", { name: /monthly contribution/i }).fill(a.contribution)
}

/** Move from step 1 to step 2 and wait for the performance fields. */
export async function continueToPerformance(page: Page) {
  const dialog = accountDialog(page)
  await dialog.getByRole("button", { name: /continue/i }).click()
  await expect(dialog.getByRole("textbox", { name: /expected return/i })).toBeVisible()
}

/** Step 2 of the add-account wizard: performance assumptions. */
export async function fillAccountPerformance(page: Page, a: AccountInput) {
  const dialog = accountDialog(page)
  await dialog.getByRole("textbox", { name: /expected return/i }).fill(a.expectedReturn)
  await dialog.getByRole("textbox", { name: /annual fees/i }).fill(a.fees)
  await dialog.getByRole("textbox", { name: /^escalation/i }).fill(a.escalation)
}

/** Submit the wizard and wait for the dialog to close. */
export async function submitAccount(page: Page) {
  const dialog = accountDialog(page)
  await dialog.getByRole("button", { name: /^add account$/i }).click()
  await expect(dialog).toBeHidden()
}

/** Complete the whole wizard without screenshots, for journeys where it is just setup. */
export async function addAccount(page: Page, a: AccountInput) {
  await fillAccountEssentials(page, a)
  await continueToPerformance(page)
  await fillAccountPerformance(page, a)
  await submitAccount(page)
}
