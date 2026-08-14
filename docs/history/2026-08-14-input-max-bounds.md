# Monetary input bounds — absurd numbers rejected

## The bug

A value like `8798456465498798465498794654547987654987` (~8.8×10³⁹) could be entered into
every monetary input. Six fields had only a `.min(0)` bound (or none at all), so the value
passed validation, got stored as a IEEE-754 double with massive precision loss (the number
is ~28 orders of magnitude past `Number.MAX_SAFE_INTEGER`), and poisoned every downstream
calculation — tax brackets, projections, Monte Carlo, RA deduction limits.

Two follow-up complaints from live testing made the fix insufficient:

1. The validation error ("Enter a realistic balance (R1 trillion or less)") appeared, but the
   field still **physically accepted** the huge number.
2. A 40-digit value **overflows the input** (`scrollWidth` ≫ `clientWidth` on the 218px
   account-balance field — e.g. 360 vs 217), bleeding past the padding and breaking the
   textbox styling.

### Unbounded monetary fields

- `personal-info-form.tsx` — `annualIncome`
- `retirement-goals-form.tsx` — `desiredMonthlyIncome`, `legacyAmount`
- `account-form-dialog.tsx` — `currentBalance`, `monthlyContribution`, `tfsaContributionsToDate`
- `drawdown-strategy-form.tsx` — `minimumWithdrawal`, `maximumWithdrawal`, `monthlyMedicalAid`
  (raw `Number()` handlers, no validation at all)
- `expenses-page.tsx` — expense `amount` (add + inline-edit) and `monthlyIncome`
  (raw `parseFloat` handlers)

## The fix

Three layers.

### 1. `MAX_MONETARY_AMOUNT` constant (`lib/constants/limits.ts`)

R1 trillion. ~9,000× below `Number.MAX_SAFE_INTEGER`, so any accepted value round-trips
through a double with zero precision loss, while leaving headroom far beyond any plausible
personal portfolio.

### 2. Physical input blocking (`lib/utils/monetary.ts` + `lib/hooks/use-bounded-monetary.ts`)

`isAllowedMonetaryInput(raw, max)` — rejects non-finite, negative, or above-cap values;
strips spaces/commas so formatted input (`R 1 000`, `1,000`) passes exactly like the commit
handlers parse it. `clampMonetaryAmount` retained for programmatic writes.
`predictInsertedValue` predicts the value an edit would produce (used by the block).

`useBoundedMonetary(value, max)` returns `{ onChange, onBeforeInput }`:

- **`onBeforeInput` (primary)** — predicts the value that would result from the pending
  edit (`predictInsertedValue`) and calls `preventDefault()` when it would exceed the cap.
  The character **never enters the DOM**, so holding a key just stops adding digits — no
  flicker, no revert. Handles typing and paste; `type="number"` inputs expose no caret API,
  so insertion is assumed at the end of the field.
- **`onChange` (fallback)** — for browsers without `beforeinput`, rejects an out-of-range
  value by restoring the input to the exact last valid string (tracked in a ref written only
  inside the handler, so it is always precise — never a stale render-time value).

Wired into every monetary field:

- **Zod forms** (personal-info, retirement-goals, account-dialog): compose the guard with
  `register`'s `onChange`; the `.max()` schemas + input `max` attrs remain as defence for
  programmatic writes (saved plans, `setValue`). The account dialog also blocks the TFSA
  field at its own `tfsaLifetimeLimit`.
- **Controlled inputs** (drawdown strategy, expenses): guard blocks paste/typed over-cap
  values; the previous clamp-on-change is gone.
- The live-write forms gate store pushes on `schema.safeParse` (from the first iteration) so
  an invalid value never reaches state even if it got past the guard.

### 3. Stale persisted data sanitised on rehydrate (`calculator-store.ts`, `expenses-store.ts`)

Garbage persisted **before** the fix (e.g. a 40-digit `annualIncome`) would still render on
load and break the input styling. Both stores gained `version: 2` + a `migrate` that clamps
every persisted monetary field (annual income, retirement goals, drawdown withdrawals,
medical aid, account balances/contributions, expense amounts, monthly income) to the cap,
preserving `undefined` optionals and finite values.

## Verification

- `lib/utils/monetary.test.ts` — 15 tests: clamp passthrough/cap/negative/non-finite,
  `isAllowedMonetaryInput` empty/formatted/in-range/out-of-range/negatives/custom max,
  `predictInsertedValue` append/caret/selection + over-cap prediction.
  100% statement/branch coverage on the helper.
- `calculator-store.test.ts` / `expenses-store.test.ts` — 6 migration tests covering the
  absurd-clamp, finite-preserve, incomplete-state fallbacks, and present-optional paths.
- `npm run test` — 920/920 pass (51 files)
- `npm run test:coverage` — statements 93.92%, branches 85.51%, functions 94.88%,
  lines 94.59% (thresholds 90/85/90/90)
- `npm run typecheck` — clean
- `npm run lint` — 0 errors, 9 pre-existing React Compiler/RHF warnings (unchanged)
- `npm run build` — clean
- Live browser checks (Playwright) against the dev server:
  - Holding a key (20× `5`) on annual income and medical aid: value climbs to
    `555555555555` (12 digits) and **stops — the 13th digit never enters the DOM**
    (a native `input` listener never saw a 13-char value, proving `beforeinput`
    `preventDefault` blocks before insertion, not a post-hoc revert).
  - The cap `1000000000000` is typeable; one more digit is blocked; backspace and
    decimals (`0.5`) still work.
  - Pasting a 40-digit number is fully blocked (field stays empty); pasting a valid
    value still works.
  - Seeded version-1 localStorage with 40-digit garbage → rehydrate migrates to version 2 and
    clamps every field to the cap; page renders clean.

## Files touched

- `lib/constants/limits.ts` — `MAX_MONETARY_AMOUNT` (+ JSDoc)
- `lib/utils/monetary.ts` — `clampMonetaryAmount` + `isAllowedMonetaryInput`
- `lib/utils/monetary.test.ts` — new, 11 tests
- `lib/hooks/use-bounded-monetary.ts` — new `useBoundedMonetary` guard
- `components/inputs/personal-info-form.tsx` — guard + `.max()` + `max` attr + FieldError + gated store write
- `components/inputs/retirement-goals-form.tsx` — guard + `.max()` + `max` attrs + gated store write
- `components/accounts/account-form-dialog.tsx` — guard (incl. TFSA cap) + `.max()` + `max` attrs
- `components/inputs/drawdown-strategy-form.tsx` — guard replaces clamp
- `components/pages/expenses-page.tsx` — guard replaces clamp
- `lib/store/calculator-store.ts` — persist `version: 2` + migrate
- `lib/store/expenses-store.ts` — persist `version: 2` + migrate
- `lib/store/calculator-store.test.ts`, `lib/store/expenses-store.test.ts` — migration tests
- `docs/project-phases/phase-9-site-improvement.md` — item updated
