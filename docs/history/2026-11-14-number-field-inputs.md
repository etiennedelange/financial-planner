---
type: History Entry
title: "2026-11-14 — NumberField: Plan page inputs sized to their data, with units inside"
description: "Inputs used full-width type=number boxes with raw values and the unit hidden in the label. A shared, tested NumberField/NumberInput now shows formatted values, in-field units, content-fitted widths, steppers and a clear focus ring across the Plan, Risk, Accounts, Drawdown and Expenses forms; the base Input gets the same border and focus ring. Account delete no longer needs a confirmation dialog."
date: 2026-11-14
tags: [ui, forms, accessibility, plan-page]
---

# 2026-11-14 — NumberField

## Why

The inputs read as dated, and shrinking the boxes would not have fixed it. The real problems, from the Plan page at desktop width:

- **Width ignored the data.** "35" sat in a ~510px box and "0" in a ~1040px one.
- **Raw values, hidden units.** The field showed `600000`, the unit lived in the label ("Annual Income (R)"), and a caption below repeated the value formatted.
- **Stacked label + box + caption for every field**, all at the same visual weight, with no grouping of related fields.
- **Weak field definition**: a faint grey fill, a hairline border and a 1px 40%-opacity focus ring.
- **Small misalignments**: the info icon made one label row taller, so labels on the same row sat 5px apart.
- **No numeric affordances** (spinners were hidden globally, nothing replaced them).

Direction "A — refined boxes" was chosen from three interactive mockups (refined boxes, ledger rows, slider pairs).

## What changed

- `lib/utils/number-field.ts` — pure helpers: `sanitizeNumberText`, `parseNumberText`, `formatNumberValue`, `sameFieldValue`, `caretAfterReformat`, `stepNumber`, `exceedsHardMax`. No input logic lives in the component.
- `components/ui/number-field.tsx` — `NumberField`: controlled `number` in/out (NaN = empty, so the schema still says "Enter a ..."), formatted text, `prefix`/`suffix` inside the field, `width` by data kind (`compact` ~9.25rem, `money` 16rem, `full`), optional stepper plus ↑/↓ (Shift ×10), fixed-height label row, label + tooltip, hint, `FieldError`, `aria-invalid` / `aria-describedby`, `inputMode` numeric or decimal.
- Forms converted to `Controller` + `NumberField`: `personal-info-form.tsx` (ages grouped with a years-saving / years-drawing bar, income), `retirement-goals-form.tsx` (desired income with the at-retirement figure as the hint, legacy goal), `assumptions-form.tsx` (three returns and inflation). Zod schemas, store gating and `reset` syncing are unchanged.
- The R1 trillion cap is now `hardMax` on the field, replacing `useBoundedMonetary` on these forms. The hook remains for `expenses-page`, `account-form-dialog` and `drawdown-strategy-form`.
- Out-of-range ages and rates can still be typed (only the cap blocks keystrokes), so validation keeps explaining the problem instead of silently ignoring keys.
- Focus: the wrapper shows the border and a 3px ring; the input uses `outline-hidden` rather than `outline-none`, so Windows forced-colors mode still draws a 2px outline (verified by emulation). `outline-none` also tripped shadscan `focus-visible-not-suppressed` (88/100); `outline-hidden` restored 90/100.

## Verification

- `lib/utils/number-field.test.ts` (32) and `components/ui/number-field.test.tsx` (21): grouping, paste, comma decimals, R0, NaN, hard cap, steppers, clamping, float drift, external value sync, a11y wiring.
- `components/inputs/personal-info-form.test.tsx` (10): store receives numbers, grouped display, R0, cap, retirement-before-current rejected with message, cleared field never stores NaN, external store change updates the field. The existing `assumptions-form.test.tsx` passes unchanged.
- Mutation-checked: removing the hard cap, the external-value sync, or the NaN-for-empty rule each fails two tests.
- Full suite 1523 passing; typecheck and `vp check` 0 errors; `shadscan:gate` 90/100.
- Browser at 1440 and 390 px, light and dark (dark at 1440): typing, regrouping, stepping, validation message, no horizontal overflow, 0 console errors.
- `npm run build` was not run: the dev server was running and a build would overwrite its `.next`.

## Follow-up: every remaining form (same day)

- `components/ui/number-input.tsx` — the control without a label (`size="sm"` for inline editors, `alignEnd`, `onKeyDown` that can veto stepping). `NumberField` is now label + hint + error around it. `Label` exports `FIELD_LABEL_CLASS` so text and number fields share one label style. `NumberField` gained `controlClassName` for fields whose label or hint is longer than the value.
- Converted: `volatility-form` (Risk), `drawdown-strategy-form` (min/max withdrawal, medical aid, dependants), `account-form-dialog` (balance, contribution, return, fees, escalation, TFSA contributions), `expenses-page` (add row, edit row, monthly income). Empty-means-undefined fields (medical aid, dependants) map NaN to `undefined`; withdrawals map NaN to 0 so the store never holds NaN. Dependants is now capped at 10 as typed (it was only an HTML `max`, which never blocked typing).
- Base `Input` (auth forms, scenario switcher, account name/provider, expense names) and `NumberInput`: border `--input`, hover darkens to `muted-foreground`, 3px focus ring, `rounded-lg`, `aria-invalid` styling, `outline-hidden`. The `--input` token itself is untouched here: #40 (theme contrast) had already raised it to a 3:1 boundary, and these fields use it so they match Select and outline Button. (An earlier draft used `muted-foreground/40`, about 1.9:1, which fails WCAG 1.4.11.)
- `useBoundedMonetary` now has no callers (the `lib/hooks/use-bounded-monetary.ts` file and `isAllowedMonetaryInput` / `predictInsertedValue` remain, with their tests).
- The only remaining `type="number"` is a Recharts axis, not an input.
- Verified: new tests `number-input` (10), `volatility-form` (5), `drawdown-strategy-form` (9), `account-form-dialog` (7), `expenses-page` (13, first tests for that page). Mutation-checked: removing the TFSA cap, the medical-aid `undefined` rule, the dependants cap, the income `> 0` rule, the keep-old-amount rule and the income focus effect each fail a test. Browser: account dialog and Risk volatility field checked at 1440 px light; expenses inline editors and income editor exercised.

## Follow-up: account delete without a confirmation dialog

The delete icon opened an `AlertDialog` that floated in, moved the pointer's target away from the button and demanded a second click. The dialog's own copy already said "You can undo this from the toast", so the safety net existed; the dialog was redundant friction.

- `components/pages/accounts-page.tsx` — the trash icon now deletes on one click. The "Account deleted" toast (name and balance) carries Undo, which re-adds the same account object.
- The toast now stays 8 s (`DELETE_UNDO_MS`). Before, Radix closed it at its own 3 s default (the store's 4.2 s timer was never the visible limit), which is too short for the only safety net.
- `components/pages/accounts-page.test.tsx` (4): one click deletes, no dialog or alertdialog, the toast names the account and lasts at least 8 s, Undo restores an identical account, other accounts are untouched. Mutation-checked: a click that no longer deletes fails all four; a 3 s toast fails the duration test.
- Browser: 3 accounts, one click, 2 accounts, no dialog, toast shown, Undo, 3 accounts.
- Known limit: Undo re-appends the account, so within its group it can land last rather than where it was. Not changed (it needs a store API for restoring at an index).

## Follow-up: e2e journeys 1-3 repaired, and a real wizard bug found

The unit tests do not exercise `e2e/journeys`, so the redesign could have broken them. Running them showed they were broken well before this work: they were written for the old tabbed UI ("Personal / Goals / Insights" tabs, a one-step account form, charts and Monte Carlo on the first page) and last changed on 2026-10-31.

- **Selector break from this work, fixed.** `getByLabel(/retirement age/i)` matches the input plus its "Increase/Decrease" stepper buttons (three elements, strict-mode failure for six fields). Numeric fields are now found with `getByRole("textbox", { name })`.
- **Rewritten for the sidebar app.** Journeys 01, 02 and 03 now use `e2e/helpers/app-helpers.ts` (`goToPage` for the desktop sidebar and the phone bottom bar, `field`, `fillNumber`, and the two-step add-account wizard). They assert behaviour, not just screenshots: stored numbers equal typed numbers (including 10.5 and 1.2), formatted display (`750 000`), plan edits persisting across navigation, and an invalid age being explained and not stored. `waitForMonteCarloSimulation` now waits for "Likely range" on the Risk page (the success-rate card shows a placeholder while the worker runs).
- **Real app bug found by journey 1, fixed.** One click on "Continue" in the add-account wizard saved the account with default return and fees and closed the dialog, skipping step 2. Continue (`type="button"`) and Add Account (`type="submit"`) sat in the same spot, so React reused one DOM button and flipped its type; the async click handler re-rendered before the browser's default action, so the same click then submitted the form. Fixed with distinct `key`s so the element is replaced (`account-form-dialog.tsx`). Regression: the unit test "Continue and Add Account are different DOM elements" (mutation-checked: fails without the keys) plus journeys 01 and 02, which fail on exactly this symptom without the fix. Happy-dom cannot reproduce the browser's submit ordering, so the unit test pins the cause, not the symptom.
- **Phone layout, three more findings.** The `mobile` project uses WebKit, which is not installed in this container, so the journeys were run in Chromium at the iPhone viewport (393x852) with a temporary config (not kept). That surfaced: (1) the display-mode button in the top bar had **no accessible name below `md`**, because its text is `hidden md:inline` (a real WCAG 4.1.2 gap); it now has `aria-label="<Future|Today's> Value, change display mode"` (starts with the visible words), covered by `top-bar.test.tsx` and mutation-checked; (2) the Next.js dev-tools badge covers the first bottom-nav tab in `next dev`, so `goToPage` hides it (`hideDevIndicator`; it does not exist in production builds); (3) `StateManager.seedState` still wrote persist version 2 while the store is at 3, so a seed without `personalInfo` went through `migrate`, which rebuilt `personalInfo` as `{ annualIncome: 0 }` and the Overview rendered "Retiring at undefined". The helper now writes version 3 and its comment says why. Real users always have `personalInfo` saved, so this was an unrealistic fixture, not a user-facing bug.
- **Results.** Journeys 01-03 pass on desktop-chrome, tablet and the phone layout (9 of 9). They fail without the wizard `key` fix.
- **Not done.** Journeys 04-07 still target the old tabs and fail; they need the same port (README says so). 08, 09 and the password-reset spec need Supabase and were not run.

## Follow-up: input text size and password managers

- **Size.** In review, the field values (16px / 500) were visibly larger than the 13px labels and 14px option cards beside them. Form values are now `text-base sm:text-sm` (14px on desktop, 16px below `sm` because iOS zooms the page when an input under 16px is focused), controls are 36px tall (`h-9`), and the inflation field's hint no longer wraps (`width="full"` with `controlClassName` for the control). The Drawdown card's own labels use `FIELD_LABEL_CLASS` so every label on the Plan page matches. Measured in the browser: values 14px/500 = option-card titles, label 13px, phone value 16px, no overflow.
- **Password managers.** The fields are `type="text"` with `inputMode="numeric"|"decimal"` on purpose: `type="number"` cannot show `600 000`, scrolls on the mouse wheel and accepts `e`/`+`. Password managers (1Password) offer to fill any plain text box, and `autoComplete="off"` is ignored by them, so `lib/utils/no-autofill.ts` (`NO_AUTOFILL_PROPS`: `data-1p-ignore`, `data-lpignore`, `data-bwignore`, `data-form-type="other"`, `autocomplete="off"`) is applied to every `NumberInput` and to the non-credential text boxes (account name/provider, expense and group names, scenario names). Sign-in, password and MFA fields deliberately do not get it. Verified the attributes in the live DOM; whether the 1Password icon actually disappears was not verified (no extension in the test browser).

## Not done

- Not reviewed: dark mode and 390 px for the new forms beyond the Plan page (the phone layout was exercised by the journeys, not reviewed visually); the auth modal after the base `Input` change was not viewed.
- Stepper hit area (24×26 px) not audited at 320 px.
- `npm run build` was not run (the dev server was running and a build would overwrite its `.next`).
