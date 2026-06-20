# 2026-05-09: TFSA Lifetime Limits and Medical Aid Tax Credits

## Summary

Two Phase 6 tax features implemented in this session.

---

## TFSA Lifetime Limit Tracking

### What changed
- `tfsaContributionsToDate?: number` added to `Account` type — user-supplied cumulative past contributions (not balance; growth doesn't count toward the limit)
- Projection engine (`lib/calculations/projection-engine.ts`) now enforces **R36k annual** and **R500k lifetime** caps on TFSA contributions during accumulation, starting from the user-supplied figure
- Account form shows a conditional "Total contributions to date" field for TFSA accounts only
- Account card shows a badge with lifetime used/remaining and warnings when annual or lifetime limits are exceeded
- Supabase migration: `tfsa_contributions_to_date numeric null` column added to `accounts` table; types regenerated

### Why
SARS penalises over-contributions to TFSAs. Without enforcement, projections were silently over-contributing past the R500k lifetime cap and R36k annual cap, producing overstated balances at retirement.

### Key files
- `types/accounts.ts` — new field
- `lib/calculations/projection-engine.ts` — cap logic (tracks per-account lifetime and yearly usage)
- `components/accounts/account-form.tsx` — conditional TFSA field
- `components/accounts/account-card.tsx` — TfsaLimitBadge component
- `lib/supabase/accounts.ts` — mapping updated
- `supabase/migrations/20260509000000_add_tfsa_contributions_to_date.sql`

### Tests
4 new tests in `lib/calculations/__tests__/projection-engine.test.ts`: lifetime cap stops contributions, fully maxed contributes R0, annual cap enforced, non-TFSA accounts unaffected.

---

## Medical Aid s6A Tax Credits

### What changed
- `MEDICAL_AID_CREDITS_CONFIG` added to `lib/constants/tax-year.config.ts` (2026/2027 SARS rates: R364/month primary member, R364 first dependant, R246 each additional)
- `calculateMedicalAidTaxCredit(dependants)` function in `retirement-tax.ts` — returns annual credit amount
- `calculateIncomeTaxWithRebates()` now accepts optional `medicalAidDependants` parameter and applies the s6A credit to reduce tax payable (after age rebates)
- `calculateRetirementTax()` applies credit when `monthlyMedicalAid` is set; `medicalAidTaxCredit` added to `RetirementTaxResult`
- `DrawdownConfig` gains `monthlyMedicalAid?: number` and `medicalAidDependants?: number`
- Projection engine drawdown phase: the long-standing `// TODO: Integrate medical costs` comment resolved — medical aid cost deducted from net income AND credit applied to income tax
- UI: two new fields in Assumptions form under Drawdown Strategy section

### Why
Medical aid credits are a direct reduction of tax payable (s6A of the Income Tax Act), not a deduction from income. The previous code only subtracted the contribution cost from net income but never applied the credit — meaning income tax was overstated for anyone with medical aid in retirement.

### Key files
- `lib/constants/tax-year.config.ts` — new MEDICAL_AID_CREDITS_CONFIG
- `lib/calculations/retirement-tax.ts` — credit calculation and application
- `lib/calculations/projection-engine.ts` — wired into drawdown phase
- `types/inputs.ts` — DrawdownConfig fields
- `components/inputs/assumptions-form.tsx` — UI fields

### Tests
9 new/updated tests in `lib/calculations/retirement-tax.test.ts` covering: credit amounts by dependant count, credit applied in calculateRetirementTax, multi-dependant scenarios, credit wipes out low-income tax liability, no credit when medical aid not set.
