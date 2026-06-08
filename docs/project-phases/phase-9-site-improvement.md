# Phase 9: Site-Wide Improvement

_Identified 2026-06-07 via parallel agent audit (UI/UX, calculations, test coverage)._

## Status: 📋 Planned

---

## 9.1 — Calculation Correctness & Deduplication

### Critical
- [ ] **Negative years guard** — `projection-engine.ts:151-152`: `yearsToRetirement` and `yearsInRetirement` can go negative if ages are inverted; add early-return validation
- [ ] **CGT rate to constants** — `projection-engine.ts:408`: `0.40` hardcoded; move to `lib/constants/limits.ts` as `CGT_INCLUSION_RATE_INDIVIDUAL`
- [ ] **Monte Carlo duplication** — `scenario-comparison.ts:108-170` reimplements full accumulation/drawdown logic separately from `simulation-engine.ts`; consolidate to use the shared engine
- [ ] **`calculateMonthlyReturn()` triplicated** — exists in `projection.ts`, `simulation-engine.ts`, and `scenario-comparison.ts`; keep one, import everywhere

### High Priority
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
- [ ] **`calculator-store.ts` — zero tests** — Zustand store drives all scenario/account sync; needs tests for `syncFromDb`, scenario switching, debounce logic
- [ ] **`expenses-store.ts` — zero tests** — expense group/item sync, monthly income state; no coverage at all
- [ ] **Coverage gap ~25pp** — estimated 65-70% line coverage vs 90% threshold in `vitest.config.ts`; stores + projection edge cases are the main gap

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
- [ ] **Success rate color logic** — duplicated across 4 components (`dashboard-metric-card.tsx`, `success-gauge.tsx`, `projection-summary.tsx`, `sticky-results-bar.tsx`); extract to `lib/utils/colors.ts`
- [ ] **Hardcoded color classes** — `text-green-600`, `bg-red-500`, etc. used directly instead of semantic tokens; audit and replace across all 4 files above
- [ ] **Accessibility: aria labels** — only 5 aria-label attributes found across 58 components; add to: sidebar nav buttons, form inputs, chart containers, modal dialogs, status badges
- [ ] **Confirmation before delete** — no dialog before account or scenario deletion (`accounts-page.tsx:44-46`, `scenario-switcher.tsx:73-78`)
- [ ] **Success feedback** — no toast/confirmation after: add/edit account, export plan, scenario rename, reset to defaults

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
