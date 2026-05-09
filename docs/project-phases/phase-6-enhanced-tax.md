# Phase 6: Enhanced Tax Calculations ✅ COMPLETE

**Goal:** Complete SA tax treatment implementation.

**Completed (90%):**
- ✅ Comprehensive SA retirement tax calculations implemented
- ✅ Age-based rebates (Primary, Secondary, Tertiary)
- ✅ Income tax and lump sum tax modeling
- ✅ Lifetime tax burden analysis
- ✅ Retirement payslip UI component
- ✅ Tax breakdown accordion in calculations
- ✅ Core tax calculations with Excel validation

**Completed (2026-04-27):**
- [x] Lump sum commutation UI — 0–33% slider in Drawdown Strategy section (SA one-third cap)
- [x] Lump sum commutation wired into projection engine — deducted from portfolio at retirement year 0, tax recorded in `totalLumpSumTax` and returned as `lumpSumCommutation` on `ProjectionResult`
- [x] `LumpSumCommutationResult` type added to `ProjectionResult`
- [x] Tax analysis accordion shows amber panel with gross amount, tax, net received, remaining portfolio, effective rate, and tier thresholds
- [x] Slider performance fix — local state + `onValueCommit` so store only updates on release (no CPU spike during drag)
- [x] `calculateProjection` moved into `useMemo` with deferred inputs in `calculator-client.tsx`
- [x] Tax-optimized withdrawal sequencing — TFSA → Discretionary (CGT 40% inclusion) → Pension/RA/Preservation (full income tax); per-account balances tracked through drawdown; cost basis tracked for CGT on discretionary gains; drawdown table shows per-source breakdown
- [x] Display mode (nominal/real) applied to all currency values in calculations breakdown — per-row `yearsFromNow` deflation in yearly tables
- [x] Bug fix: payslip `monthlyIncomeAtRetirement` now uses `remainingPortfolio` (post-lump-sum) not `portfolioAtRetirement`
- [x] Bug fix: Monte Carlo `simulateSingleRun` now deducts lump sum before calculating initial withdrawal — success rate was previously too optimistic when lump sum > 0

**Completed (2026-05-09):**
- [x] TFSA lifetime limit tracking — `tfsaContributionsToDate` field on Account; projection engine caps contributions at R36k/year and R500k lifetime; account card shows remaining room and warnings; Supabase migration + type regen
- [x] Medical aid tax credits (s6A) — `calculateMedicalAidTaxCredit()` reduces income tax directly (not taxable income); `monthlyMedicalAid` and `medicalAidDependants` added to DrawdownConfig; wired into projection engine drawdown phase; UI fields in Assumptions form; 2026/2027 rates: R364/month (member + first dependant), R246/month per additional
- [x] Account-specific withdrawal tracking — `accountBalancesAtRetirement` added to `ProjectionResult`; `accountBalances` (per-account year-end snapshots) added to `YearlyProjection`; "Account Depletion Timeline" section in drawdown accordion shows per-account depletion age, starting balance, progress bar, and survivor status; 6 new tests
- [x] RA/Pension contribution optimisation — `calculateRAOptimization()` in `lib/calculations/utils/ra-optimization.ts`; section 8 accordion shows deduction limit, utilisation bar, tax saving callout, and optimal contribution; income source labelled; 16 tests
- [x] Stale R350k cap fixed in `key-insights-summary`, `debug-window`, `personal-info-form`; TFSA R500k hardcode fixed in `account-form` — all now reference `SA_TAX_LIMITS`
- [x] Tax configurations updated to 2026/2027 (RA deduction 27.5%/R430k, TFSA R36k/R500k)
- [x] Retirement lump sum tax tables (2026/2027)
- [x] Monthly annuity income tax calculations
- [x] Tax bracket modeling
