# Phase 6: Enhanced Tax Calculations 🔄 IN PROGRESS

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

**Pending Tasks:**
- [x] Tax-optimized withdrawal sequencing — TFSA → Discretionary (CGT 40% inclusion) → Pension/RA/Preservation (full income tax); per-account balances tracked through drawdown; cost basis tracked for CGT on discretionary gains; drawdown table shows per-source breakdown
- [ ] Account-specific withdrawal tracking (Medium Priority)
  - Track which accounts are drawn from each year
  - Display projected depletion timeline per account
- [ ] Medical aid tax credits (Medium Priority)
  - Model medical aid contributions that qualify for tax credits
- [x] Tax configurations updated to 2026/2027 (RA deduction 27.5%/R430k, TFSA R36k/R500k)
- [x] Retirement lump sum tax tables (2026/2027)
- [x] Monthly annuity income tax calculations
- [x] Tax bracket modeling
- [ ] TFSA contribution tracking (lifetime limit) (Medium Priority)
- [ ] RA/Pension contribution optimization suggestions (Medium Priority)
