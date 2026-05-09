# 2026-05-09 — Account Depletion Tracking & RA Optimisation

## What changed

### Account depletion tracking
- `DrawdownAccount` extended with `id` and `name` fields in `projection-engine.ts`
- `YearlyProjection.accountBalances?: Record<string, number>` — per-account balance snapshot at each drawdown year-end
- `ProjectionResult.accountBalancesAtRetirement: Record<string, number>` — snapshot captured before the drawdown loop (after lump sum deduction); avoids reading mutated state at end of loop
- "Account Depletion Timeline" section added to the drawdown accordion in `calculations-breakdown.tsx`: colour-coded card per account showing starting balance, depletion age or survivor status, and a progress bar indicating what fraction of retirement years the account covers
- 6 new tests in `projection-engine.test.ts`

### RA/pension contribution optimisation (section 8)
- New utility `lib/calculations/utils/ra-optimization.ts` — `calculateRAOptimization(annualIncome, accounts)`:
  - Computes annual deduction limit: `min(income × 27.5%, R430k)`
  - Sums contributions across pension_fund / retirement_annuity / preservation_fund accounts only
  - Calculates remaining room, utilisation %, and annual tax saving using actual SA brackets + primary rebate
  - Flags `isFullyUtilized` and `isOverLimit`
- Section 8 accordion in calculations breakdown: utilisation bar, tax saving callout, optimal contribution, and how-it-works explainer
- Zero-income state shows a plain-text prompt pointing to Planning Inputs; income source noted on the deduction limit card
- 16 tests in `ra-optimization.test.ts`

### Hardcoded tax constant fixes
R350k RA cap was stale (current limit R430k). Fixed in four places:
- `key-insights-summary.tsx` — calculation now uses `SA_TAX_LIMITS.pensionRaMaxDeduction`
- `personal-info-form.tsx` — tooltip text now reads from constants dynamically
- `debug-window.tsx` — calculation, two display strings, and stale "2024/2025" label all corrected
- `account-form.tsx` — TFSA R500k Zod `.max()` and HTML `max` attr now use `SA_TAX_LIMITS.tfsaLifetimeLimit`

## Why
Phase 6 completion: the last two medium-priority items were account depletion visibility and RA deduction optimisation nudges. The stale constants were found during the RA work and fixed opportunistically — a single change to `tax-year.config.ts` now propagates everywhere.

## Test count
377 tests passing (was 355 at start of session).
