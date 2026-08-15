# Phase 11: Dead Code Cleanup 📋 PLANNED

**Goal:** Delete or un-export the code that `knip` (v6.32.2) proves unreferenced, so the
surface area the compiler and future audits must reason about shrinks. No behavioural
change — cleanup only.

**Origin:** 2026-08-15. `npx knip` run and every finding verified by hand (repo-wide
grep for importers). Three findings from the raw report were excluded after verification
(see "Do NOT touch" below); everything in the checklists below is confirmed dead or
internal-only.

**Verification method for each item:** `grep` for the file path / export name across all
`*.ts`/`*.tsx`; a symbol is only listed here if the only matches are its own definition
and/or its own module's export statement.

---

## Checklist

### Step 1: Delete unused files (8 files — zero importers anywhere)

- [ ] `components/auth/static-finance-chart.tsx`
- [ ] `components/dashboard/collapsible-section.tsx`
- [ ] `components/dashboard/quick-actions-card.tsx`
- [ ] `components/dashboard/sticky-results-bar.tsx`
- [ ] `components/ui/page-header.tsx`
- [ ] `components/ui/sheet.tsx`
- [ ] `components/ui/tabs.tsx`
- [ ] `lib/calculations/__tests__/money-basis.type-test.ts` — **only if** the type-check
      coverage it pins is ported elsewhere first (see "Do NOT touch")

### Step 2: Remove unused dependency (1)

- [ ] `@radix-ui/react-tabs` (`package.json:49`) — only importer was the deleted
      `components/ui/tabs.tsx`; nothing else references it (verified in `pnpm-lock.yaml`
      too)

### Step 3: Delete truly dead exports (no references anywhere — not even in own module)

Exports:

- [ ] `CardHeader`, `CardFooter`, `CardTitle`, `CardDescription`
      (`components/ui/card.tsx` — only the export statement; `page-card.tsx` bans them)
- [ ] `ChartLegend`, `ChartLegendContent` (`components/ui/chart.tsx` — not used
      internally either, only exported)
- [ ] `DialogClose`, `DialogFooter` (`components/ui/dialog.tsx`)
- [ ] `DrawerTrigger`, `DrawerClose`, `DrawerFooter` (`components/ui/drawer.tsx` —
      `DrawerPortal`/`DrawerOverlay` are internal, see Step 4)
- [ ] `DropdownMenuCheckboxItem`, `DropdownMenuRadioItem`, `DropdownMenuShortcut`,
      `DropdownMenuGroup`, `DropdownMenuPortal`, `DropdownMenuSub`,
      `DropdownMenuSubContent`, `DropdownMenuSubTrigger`, `DropdownMenuRadioGroup`
      (`components/ui/dropdown-menu.tsx` — `DropdownMenuContent` renders the
      primitive directly, never these locals)
- [ ] `SelectLabel`, `SelectSeparator` (`components/ui/select.tsx` — the scroll
      buttons are internal, see Step 4)
- [ ] `TableFooter`, `TableCaption` (`components/ui/table.tsx`)
- [ ] `RETIREMENT_READY_STATE`, `TFSA_AT_LIMIT_STATE`, `OLD_PENSION_STATE`,
      `createAccount` (`e2e/fixtures/state-seeds.ts` — e2e specs only import
      `EMPTY_STATE`, `SINGLE_TFSA_STATE`, `MULTI_ACCOUNT_STATE`)
- [ ] `MAILPIT` (`e2e/helpers/auth-helper.ts` — `02-password-reset.spec.ts` defines its
      own local copy)
- [ ] `fillTotpCode` (`e2e/helpers/auth-helper.ts` — no caller; `enrollTotp` mints codes
      inline)
- [ ] `TAX_YEAR` (`lib/constants/tax-year.config.ts` — only referenced in a comment;
      the file's other exports carry the real config)
- [ ] `getScope` (`lib/store/persistence-scope.ts` — not even called internally)
- [ ] `Constants` (`types/supabase.ts`)

Types:

- [ ] `BadgeProps`, `ButtonProps`, `ChartDataColumn`, `FloatingAction`,
      `PlanNarrativeAccount`, `PlanNarrativeRequest`, `SustainabilityPoint`,
      `AccountSummary`, `GroupColorOption`, `AccountSourceBreakdown`,
      `LumpSumCommutationResult`

### Step 4: Un-export internal-only symbols (keep the code, drop the `export` keyword)

These are used within their own module but never imported anywhere — knip flags them as
unused exports, yet they are live code. Removing `export` keeps behaviour identical and
silences knip:

- [ ] `badgeVariants` (`badge.tsx` — used by `Badge`)
- [ ] `AlertDialogPortal`, `AlertDialogOverlay` (`alert-dialog.tsx` — used by
      `AlertDialogContent`)
- [ ] `ChartStyle` (`chart.tsx` — used by `ChartContainer`)
- [ ] `DrawerPortal`, `DrawerOverlay` (`drawer.tsx` — used by `DrawerContent`)
- [ ] `SelectScrollUpButton`, `SelectScrollDownButton` (`select.tsx` — used by
      `SelectContent`)
- [ ] `ScrollBar` (`scroll-area.tsx` — used by `ScrollArea`)
- [ ] `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, `CompositeTypes`
      (`types/supabase.ts` — building blocks of the generated `Database` type chain)
- [ ] `latestMailLink` (`e2e/helpers/auth-helper.ts` — used by `signUpAndConfirm`,
      which e2e specs do use)
- [ ] `toRealValue` (`lib/utils/currency.ts` — used by the real/current-mode formatters)
- [ ] `LEGACY_CALCULATOR_KEY`, `LEGACY_EXPENSES_KEY`, `holdingKeyFor`
      (`lib/store/legacy-scope-migration.ts` — used by the migration functions)
- [ ] `SustainabilityPoint` (`income-sustainability.ts` — used by
      `buildIncomeSustainabilitySeries`)

### Do NOT touch (knip false positives / intentional)

- **`SelectGroup`** — knip's report lists it, but it IS imported and rendered by
  `components/accounts/account-form-dialog.tsx:13,154` (used by `accounts-page.tsx`).
  The 2026-08-15 knip run no longer flags it.
- **`lib/calculations/__tests__/money-basis.type-test.ts`** — never imported by design;
  it is a compile-time-only test exercised by `npm run typecheck` (`tsc --noEmit`).
  Deleting it would silently drop a type-safety check. Port the money-basis assertions
  into a regular test first if the file must go.
- **`tailwindcss` / `tw-animate-css` devDependencies** — knip flags them as unused, but
  they are consumed via `postcss.config.mjs` and `app/globals.css:2`.

### Step 5: Close-out verification

- [ ] `npx knip` — no remaining unused files/dependencies/exports in the lists above
- [ ] `npm run typecheck` — clean (the money-basis type check must still run if the
      test file was kept)
- [ ] `npm run build` — clean
- [ ] `npm run test` — all pass; coverage gate green
