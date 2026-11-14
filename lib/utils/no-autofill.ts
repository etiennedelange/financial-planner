/**
 * Props that stop password managers offering to fill a field.
 *
 * Use on text boxes that are not credentials or contact details (numbers, account and
 * expense names, scenario names). `autoComplete="off"` alone is ignored by password
 * managers; each has its own opt-out: 1Password, LastPass, Bitwarden, Dashlane.
 *
 * Do NOT use on sign-in, sign-up, password or MFA fields, where autofill is wanted.
 */
export const NO_AUTOFILL_PROPS = {
  autoComplete: "off",
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const
