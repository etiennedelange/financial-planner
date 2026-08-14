# Phase 9.3 — UI/UX polish: CSS-variable extraction, loading states, chart data tables, Zod messages

## What changed

Resolved every open Medium and Low item under Phase 9.3 (UI/UX Polish). A live audit against
current code first found **four items already resolved** since the phase doc was written
(2026-06-07) — those are now ticked with evidence rather than re-worked. The genuinely open
items were implemented.

## Open items implemented

### 1. Sidebar width → CSS variable
- Added `--sidebar-width: 220px` to `@theme inline` / `:root` in `app/globals.css`.
- `components/layout/sidebar.tsx` now uses `w-(--sidebar-width)`;
  `components/layout/app-shell.tsx` `md:pl-(--sidebar-width)`;
  `components/ui/floating-action-bar.tsx` `md:left-(--sidebar-width)`.
- This was a third duplication (`floating-action-bar.tsx`) beyond the two the doc listed.

### 2. Chart heights → CSS variables
- Added `--chart-height-compact: 180px` and `--chart-height-full: 260px`.
- All six chart components' `h-[180px] md:h-[260px]` replaced with
  `h-(--chart-height-compact) md:h-(--chart-height-full)`.

### 3. Button size standardization
- New `size="icon-sm"` variant (`h-7 w-7`) on `components/ui/button.tsx`.
- expenses-page and accounts-page icon buttons no longer carry inline `h-6 w-6`/`h-7 w-7`
  overrides; the raw `<button>` expand chevron in accounts-page is now a `Button`.

### 4. Missing loading states
- **Import plan** (`settings-page.tsx`): button disabled + "Importing…" while
  `parsePlanFile` runs.
- **Account form submit** (`account-form-dialog.tsx`): submit buttons disabled via RHF
  `isSubmitting`, labelled "Adding…"/"Saving…".
- **Print page** (`app/print/print-client.tsx`): now calls `useCalculatorStore.persist.rehydrate()`
  itself (it is a standalone route outside the `/calculator` layout that owns rehydrate) and
  gates on `useAuth().isLoaded` (the root-layout SupabaseProvider runs `syncFromDb` here).
  **This fixes a latent bug:** `/print` previously read an unhydrated store, so it always
  rendered "No projection data" even for users with saved plans. A `useSyncExternalStore`
  variant (waiting only on `hasHydrated`) was tried first but fires before the async DB sync,
  so the auth-loaded gate is the correct condition.

### 5. Dead code: `success-gauge.tsx` deleted
- Confirmed imported nowhere; removed.

### 6. Chart data tables (accessibility)
- New reusable `components/ui/chart-data-table.tsx`: a collapsible, closed-by-default data
  table (shadcn Table) under each chart. `aria-expanded` disclosure button, formatted
  currency/percent cells, and a caption per chart.
- Wired into all six charts: portfolio growth, income sustainability, Monte Carlo percentiles,
  scenario comparison, sensitivity tornado, cost of delay.

### 7. SA-context Zod messages
- `personal-info-form.tsx`, `retirement-goals-form.tsx`, `assumptions-form.tsx`,
  `account-form-dialog.tsx`: generic Zod defaults ("must be positive", "Too small/big")
  replaced with SA-specific messages (e.g. "Age must be between 18 and 100", "Annual income
  cannot be negative", "Max lifetime limit is R500,000"). Zod v4 `{ error }` params used.

## Items audited and found already resolved

- **Responsive gaps** — sidebar is `hidden md:flex` + mobile `BottomNav`; metrics grid has a
  `grid-cols-2` base; expenses grid is single-column below `lg` with `order-first` summary.
- **`<div>` as button** — group collapse in expenses-page is now a real `<button>`.
- **Empty states** — expenses page has `EmptyGroups`; insights panel has its own empty state.
- **RHF validation never fires** — all four forms already use `mode: "onChange"`; verified live
  (clearing Current Age shows the error).

## Verification

- `npm run test` — 867/867 pass
- `npm run typecheck` — clean
- `npm run lint` — 0 errors, 9 warnings (all pre-existing React Compiler/RHF `watch()`
  incompatibility warnings; identical on `main` — verified via stash)
- `npm run build` — clean; production CSS contains `--sidebar-width`, `--chart-height-*` and
  the generated `w-(--sidebar-width)` / `md:pl-(--sidebar-width)` utilities
- Browser-verified via Playwright:
  - All six charts render a working "Show data table" disclosure (table + captions)
  - `--sidebar-width` drives layout: content starts at x=220 on desktop, sidebar `display:none`
    + bottom nav on a 390px viewport
  - `size="icon-sm"` buttons render at 28×28px
  - Clearing Current Age shows "Enter your current age"; age 5 shows "Age must be between 18
    and 100"
  - `/print` now passes its loading gate (was stuck / wrong-state before)

## Notes

- `npm run test:coverage` branch coverage remains 84.61% vs the 85% global threshold — a
  **pre-existing** gap on `main`, unchanged by this branch.
- The repo's pre-existing `stash@{0}` ("On feature/auth-hardening-2fa: opencode audit") was
  briefly disturbed by a stray `git stash pop` during this work; it was restored intact and no
  unrelated files remain in the working tree.

## Files touched

- `app/globals.css` — `--sidebar-width`, `--chart-height-*` tokens
- `components/layout/sidebar.tsx`, `components/layout/app-shell.tsx`,
  `components/ui/floating-action-bar.tsx` — CSS-var usage
- `components/ui/button.tsx` — `icon-sm` size variant
- `components/ui/chart-data-table.tsx` — **new** reusable chart data table
- `components/charts/*` (6 files) — height tokens + data tables
- `components/charts/success-gauge.tsx` — deleted
- `components/pages/expenses-page.tsx`, `components/pages/accounts-page.tsx` — `icon-sm`
- `components/pages/settings-page.tsx` — import loading state
- `components/accounts/account-form-dialog.tsx` — submit loading state + Zod messages
- `components/inputs/{personal-info,retirement-goals,assumptions}-form.tsx` — Zod messages
- `app/print/print-client.tsx` — rehydrate + auth-loaded gate
- `docs/project-phases/phase-9-site-improvement.md` — 9.3 items flipped
