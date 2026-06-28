# Phase 9: Site-Wide Improvement

_Identified 2026-06-07 via parallel agent audit (UI/UX, calculations, test coverage)._

## Status: 📋 Planned

---

## 9.1 — Calculation Correctness & Deduplication

### Critical
- [x] **Negative years guard** (2026-06-20) — `calculateProjection` now returns a safe degenerate `ProjectionResult` (via new `buildEmptyProjectionResult` helper, shared with the empty-accounts path) when `yearsToRetirement < 0 || yearsInRetirement < 0`; 3 new tests covering inverted ages and the valid zero-years edge case
- [x] **CGT rate to constants** (2026-06-20) — `0.40` moved to `SA_TAX_LIMITS.cgtInclusionRateIndividual` in `lib/constants/limits.ts`; `projection-engine.ts` imports it
- [x] **Monte Carlo duplication** (2026-06-20) — `scenario-comparison.ts`'s `runFullMonteCarloSimulation` no longer reimplements accumulation/drawdown; it now wraps the scenario's aggregate inputs into a single synthetic `Account` and calls `runMonteCarloSimulation` from `simulation-engine.ts` directly. Removed the local `generateRandomReturn` sampler (now uses the shared log-normal RNG in `random-returns.ts`)
- [x] **`calculateMonthlyReturn()` triplicated** (2026-06-20) — removed the duplicate in `projection-engine.ts` and the inline version in `simulation-engine.ts`; both now import the canonical version from `lib/calculations/utils/projection.ts`
- [x] **Lump sum commutation applied to non-pension balances** (2026-06-20) — `sa-retirement-calc-validator` audit found `projection-engine.ts` and `simulation-engine.ts` applied `lumpSumPercentage` uniformly across ALL accounts, incorrectly extending the retirement-fund lump-sum tax treatment to TFSA/discretionary money. Both engines now compute the lump sum against the pension/RA/preservation-fund balance only and apply the resulting fraction solely to `PENSION_TYPES` accounts
- [x] **Missing one-third annuitisation cap** (2026-06-20) — neither engine enforced the SA one-third commutation limit independently of the UI slider; added `SA_TAX_LIMITS.maxLumpSumCommutationPercentage` (`100/3`) to `tax-year.config.ts`/`limits.ts` and clamp `lumpSumPercentage` to it at the call site in both `projection-engine.ts` and `simulation-engine.ts` (not inside `calculateLumpSumCommutation`, which has its own test suite asserting unclamped behavior for >33% inputs as pure tax math)

### High Priority
- [x] **R40,000 CGT annual exclusion missing** (2026-06-20) — discretionary withdrawals were taxed on 40% of the full realized gain with no annual exclusion applied; added `CGT_ANNUAL_EXCLUSION_CONFIG`/`SA_TAX_LIMITS.cgtAnnualExclusion` (R40,000, s5(1) Eighth Schedule) and subtract it from the year's realized gain (summed across all discretionary accounts, since the exclusion is per-taxpayer not per-account) before applying the 40% inclusion rate, in both engines
- [x] **Monte Carlo used one blended pool for drawdown, no tax tracking** (2026-06-20) — `simulateSingleRun` previously combined all accounts into a single balance at retirement and withdrew from it with a blended return, with a code comment admitting tax was only "implicitly included." Rewrote drawdown to track each account separately (continuing its own per-account stochastic return sequence) and withdraw in the same TFSA → discretionary → pension order as the deterministic engine, computing per-year income/CGT tax (with the R40k exclusion) for reporting via a new optional `SimulationRun.lifetimeIncomeTax` / `SimulationResult.averageLifetimeIncomeTax` field. Tax is informational only in both engines — it does not deplete the portfolio further, matching existing deterministic-engine behavior
- [x] **Stale 2026/2027 SARS figures** (2026-06-20) — `tax-year.config.ts` still had the prior tax year's income tax brackets, medical aid tax credits, and CGT annual exclusion. Updated `INCOME_TAX_BRACKETS_CONFIG`, `MEDICAL_AID_CREDITS_CONFIG` (R376/R254), and `CGT_ANNUAL_EXCLUSION_CONFIG.individual` (R40,000 → R50,000) to current SARS figures; `TAX_REBATES_CONFIG`/`TAX_THRESHOLDS_CONFIG` verified internally self-consistent and left unchanged
- [x] **`monthlyNetIncomeAtRetirement` disagreed with the detailed payslip breakdown** (2026-06-20) — `projection-engine.ts` recomputed tax on the full gross withdrawal via `calculateIncomeTaxWithRebates`, ignoring medical aid credits and account-type tax segregation (TFSA/discretionary vs pension). Replaced with a direct read of the first drawdown year's already-correct `netIncome`, so the two figures now reconcile
- [x] **Monte Carlo never taxed the lump sum itself** (2026-06-20) — `simulateSingleRun` deducted the commuted lump sum from pension-type balances but had no call to `calculateLumpSumCommutation`, so `lifetimeIncomeTax` excluded lump-sum tax entirely. Added a per-run lump sum tax calculation reported via new optional `SimulationRun.lumpSumTax` / `SimulationResult.averageLumpSumTax` (separate field, mirrors the deterministic engine's `totalLumpSumTax`/`totalLifetimeIncomeTax` split); does not change the success-rate metric since that only depends on portfolio balance
- [ ] **TFSA re-contribution room in drawdown** — `projection-engine.ts:391-398`: withdrawals restore annual room next tax year (SA rule) but `tfsaContributionsToDate` is never updated post-retirement
- [ ] **Medical aid credit minimum threshold** — `retirement-tax.ts:21-28`: SA requires minimum contribution level to claim s6A credit; no validation present
- [ ] **Dividend withholding tax** — 20% SA rate on local dividends not modeled; all returns treated as capital appreciation
- [ ] **Spending phase multipliers documented** — `spending-phase.ts:28-39`: 100%/80%/70% thresholds and medical premium formula (`0.15 * (yearsInRetirement - 25) / 10`) have no SA research source; document or revise

### Medium Priority
- [ ] **Hardcoded thresholds to constants** — spending phase year breakpoints, scenario comparison success thresholds (`>=70%`, `>=75%` in `scenario-comparison.ts:268,279`), binary search precision (`R100` in `optimal-contribution.ts:77`)
- [ ] **NaN/Infinity guards** — no defensive checks before returning calculation results; add at key division points (e.g., `gainFraction` at `projection-engine.ts:406`)
- [ ] **Supabase error context** — `accounts.ts:50-59` returns empty array on error without logging; distinguish "no data" from "error"

---

## 9.2 — Test Coverage

### Critical
- [x] **`calculator-store.ts` — 27 comprehensive tests** (2026-06-16) — `setSessionId`, all account operations (add/update/remove/seed), personal info/goals/assumptions/drawdown/display mode updates, plan loading, reset to defaults, all scenario ops (switch/create/rename/delete), syncFromDb (existing/first sign-in/scenario restore), sync debouncing, edge cases
- [x] **`expenses-store.ts` — 25 comprehensive tests** (2026-06-16) — initialization, session management, group operations (add/update/remove), expense operations (add/update/remove/toggle), sample data loading, clear all, syncFromDb (fetch/dedup), debouncing, concurrent operations, edge cases (missing group, zero/negative amounts)
- [ ] **Coverage gap assessment** — with 52 new store tests (520→520 total), need to run `npm run test:coverage` to verify if 90% threshold now met in store files

### High Priority
- [ ] **`retirement-tax.test.ts`** — add high-income brackets (>R1M, >R2M), medical dependants >4, negative income edge case
- [ ] **`projection-engine.test.ts`** — add multi-account drawdown, zero-account, negative-return years, lump sum commutation during drawdown (not just at start)
- [ ] **`expenses.test.ts`** — add error cases for `upsertGroup`/`upsertExpense` (only deletes currently tested for errors); test partial data (groups exist, expenses don't)
- [ ] **`scenarios.test.ts`** — add error cases for `renameScenario`/`updateScenario`; round-trip create→fetch field integrity test

### Medium Priority
- [ ] **Supabase test strategy** — current tests mock the entire Supabase query chain (brittle to API changes); consider integration tests against the local test DB
- [ ] **`monte-carlo/use-monte-carlo-worker.ts`** — worker lifecycle and message-passing errors untested
- [ ] **`currency.ts` / `formatters.ts`** — no tests for negative values, very large numbers, or rounding edge cases
- [ ] **`scenario-comparison.ts`** — `compareScenarios` function barely tested; missing zero-contribution, short (1-5 year) and long (40+ year) horizon cases

---

## 9.3 — UI/UX Polish

### High Priority
- [x] **Success rate color logic** (2026-06-27) — extracted to `lib/utils/success-rate.ts`; unified thresholds ≥90/75/60/40; all 4 consumer components updated; 10 new tests
- [x] **Hardcoded color classes** (2026-06-27) — `text-green-*`, `text-red-*`, `text-orange-*` replaced with `text-success`, `text-destructive`, `text-warning`, `text-chart-2/4` semantic tokens across all affected components
- [x] **Accessibility: aria labels** (2026-06-27) — added `aria-label="Main navigation"` + `aria-current="page"` to sidebar; `aria-label` on icon buttons (rename/delete scenario, delete account); `role="img"` + `aria-label` on success gauge; `aria-label` on success rate badge; charts already had labels from prior implementation
- [x] **Confirmation before delete** (2026-06-27) — AlertDialog added to `scenario-switcher.tsx`; accounts page already had it
- [x] **Success feedback** (2026-06-27) — shadcn toast system added (`lib/hooks/use-toast.ts`, `components/ui/toaster.tsx`, mounted in calculator layout); wired to: add/edit/delete account, scenario rename/delete, export plan, reset to defaults
- [x] **Floating bottom action bar** (2026-06-28) — new `components/ui/floating-action-bar.tsx` with scroll-hide behavior (hides on scroll-down >80px, shows on scroll-up); added to Accounts page (primary: Add Account, secondary: Seed) and Expenses page (primary: New Group); clears BottomNav on mobile (`bottom-14`) and sidebar on desktop (`md:left-[220px]`)
- [x] **Redundant CTAs cleaned up** (2026-06-28) — removed ghost "Add another account" button from populated accounts list; removed "Add accounts" banner from `dashboard-metrics-grid.tsx`; overview now shows `GettingStarted` exclusively when no projection exists (no parallel empty key-insights card)

### Medium Priority
- [ ] **Responsive gaps** — sidebar fixed `w-[220px]` with no mobile collapse; `dashboard-metrics-grid.tsx:145` has no breakpoint below `sm`; expenses page grid has no `md` fallback
- [ ] **Sidebar width as CSS variable** — `w-[220px]` duplicated in `sidebar.tsx:60` and `app-shell.tsx:37`; extract to `--sidebar-width` in `globals.css`
- [ ] **Chart heights as CSS variables** — `h-[300px]`/`h-[260px]` scattered across chart components; extract to `--chart-height-full`/`--chart-height-compact`
- [ ] **Button/input size standardization** — some icon buttons use `size="icon"`, others use inline `h-7 w-7`; some inputs use `h-7`, others default height
- [ ] **Missing loading states** — import plan button, account form submit, print page render

### Low Priority
- [ ] **Chart accessibility** — add `role="img"` + descriptive `aria-label` to `monte-carlo-chart.tsx`, `portfolio-growth-chart.tsx`, `success-gauge.tsx`
- [ ] **`<div>` as button** — `expenses-page.tsx:169` uses `className="cursor-pointer"` on a `<div>` for group collapse; replace with `<button>`
- [ ] **Color theme parity** — toggle has "Gold" option but settings page doesn't; reconcile
- [ ] **Form error messages** — Zod defaults ("must be positive") lack SA context; improve to e.g. "Age must be between 18 and 100"
- [ ] **Empty states** — expenses page has no empty state when no groups exist; insights panel shows nothing if no accounts

---

## Suggested Work Order

1. **9.2 Critical** — store tests first; they block meaningful coverage numbers
2. **9.1 Critical** — negative years guard + CGT constant + Monte Carlo deduplication
3. **9.3 High** — color deduplication + aria labels (high user-facing impact, low risk)
4. **9.2 High** — tax/projection edge case tests
5. **9.1 High** — TFSA drawdown room + dividend tax + medical credit threshold
6. **9.3 Medium** — responsive layout + loading states
7. Remainder in any order
