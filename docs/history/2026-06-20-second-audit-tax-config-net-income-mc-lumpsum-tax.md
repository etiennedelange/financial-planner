# Second Audit Pass: 2026/2027 Tax Config, Net-Income Reconciliation, MC Lump Sum Tax

**Date:** 2026-06-20
**Author:** Claude
**Files Changed:**
- `lib/constants/tax-year.config.ts`
- `lib/constants/tax-tables.test.ts`
- `lib/calculations/retirement-tax.test.ts`
- `lib/calculations/projection-engine.ts`
- `lib/calculations/__tests__/projection-engine.test.ts`
- `lib/monte-carlo/simulation-engine.ts`
- `lib/monte-carlo/__tests__/simulation-engine.test.ts`
- `types/simulation.ts`
- `docs/FINANCIAL_LOGIC_REFERENCE.md`

## Summary

User supplied an external 6-point bug report against the calculation engines. Each
claim was verified against the live codebase rather than trusted outright: 2 were
fixed in an earlier session and are already false/stale (lump sum on whole portfolio,
CGT exclusion missing — see `2026-06-20-validator-audit-lump-sum-and-cgt-fixes.md`),
1 was flagged as debatable and intentionally left unfixed (fees double-counted in CSV
export), and 3 were confirmed live bugs, fixed here.

---

## 1. Stale 2026/2027 SARS figures

`tax-year.config.ts` still held the prior tax year's `INCOME_TAX_BRACKETS_CONFIG`,
`MEDICAL_AID_CREDITS_CONFIG`, and `CGT_ANNUAL_EXCLUSION_CONFIG.individual`. Verified
current 2026/2027 figures via web search and updated:
- Income tax brackets: new bracket boundaries (top bracket now starts at R1,878,600)
  and recomputed cumulative `baseTax` values
- Medical aid tax credits: R364 → R376 (member/first dependant), R246 → R254 (additional)
- CGT annual exclusion: R40,000 → R50,000

`TAX_REBATES_CONFIG` (17,820/9,765/3,249) and `TAX_THRESHOLDS_CONFIG`
(99,000/153,250/171,300) were deliberately left unchanged — they're internally
self-consistent (e.g. 17,820 / 0.18 = 99,000 exactly) and the bug report didn't flag
them; conflicting web search results for these two were judged less reliable than the
existing self-consistent values.

All dependent tests in `tax-tables.test.ts` and `retirement-tax.test.ts` were updated
with hand-verified expected values against the new brackets/credits/exclusion.

## 2. `monthlyNetIncomeAtRetirement` disagreed with the detailed payslip breakdown

`projection-engine.ts` computed this field via a shortcut — recomputing tax on the
full gross withdrawal with `calculateIncomeTaxWithRebates(annualGrossIncomeAtRetirement, retirementAge)` —
which ignored medical aid tax credits and account-type tax segregation (TFSA/
discretionary are not taxed as ordinary income). This caused the "Net Monthly Income"
figure to disagree with the correctly-computed "Less: Income Tax" line directly above
it in the Sample Retirement Payslip UI (`components/results/calculations-breakdown.tsx`).

Fixed by sourcing `monthlyNetIncomeAtRetirement` directly from the first drawdown
year's already-correct `netIncome` field (`yearlyProjections[yearsToRetirement].netIncome / 12`),
which is computed by the same per-account-type tax logic that drives the payslip
breakdown. No UI changes were needed — the two numbers now reconcile automatically.

## 3. Monte Carlo never taxed the lump sum itself

`simulateSingleRun` correctly restricts lump sum commutation to pension-type balances
and clamps it to one-third (fixed in the prior audit pass), but never called
`calculateLumpSumCommutation` to tax the commuted amount — `lifetimeIncomeTax` only
ever accumulated annual drawdown-phase income/CGT tax.

This does **not** affect the success-rate metric: success is determined purely by
`balance > 0`, and the lump sum already leaves the drawdown balance the same whether
or not tax is computed (tax is reporting-only in both engines, mirroring how the
deterministic engine treats it). The gap was purely a reporting-accuracy issue in the
`lifetimeIncomeTax` / `averageLifetimeIncomeTax` fields, which currently aren't
rendered in any production UI (only the deterministic engine's
`totalLifetimeIncomeTax` is shown, in `debug-window.tsx`).

Fixed by computing `calculateLumpSumCommutation(pensionBalanceAtRetirement, cappedLumpSumPercentage).lumpSumTax`
once per run and exposing it via new optional `SimulationRun.lumpSumTax` /
`SimulationResult.averageLumpSumTax` fields — kept separate from `lifetimeIncomeTax`
rather than folded in, mirroring the deterministic engine's existing
`totalLumpSumTax` / `totalLifetimeIncomeTax` split (`types/projections.ts`). Both new
fields are additive/optional, so no existing consumer needed changes.

---

## Testing

```bash
npx vitest run
# 542/542 tests passed (10 new: 4 in projection-engine.test.ts, 3 in simulation-engine.test.ts,
# plus rewritten expected values across tax-tables.test.ts and retirement-tax.test.ts)

npm run build
# Compiled successfully, no TS errors

npm run test:coverage
# projection-engine.ts: 95.1% lines
# simulation-engine.ts: 99.3% lines
# retirement-tax.ts: 100% lines
# All files: 95.2% statements / 96.5% lines (above the 90% threshold)
```

New tests cover, deterministically wherever possible (zero-return/zero-volatility
flat accounts):
- `monthlyNetIncomeAtRetirement` now matches `netIncome / 12` for the first drawdown
  year across TFSA, discretionary, and pension-type accounts
- Monte Carlo reports zero lump sum tax when no lump sum is taken, or when the lump
  sum is sourced from a non-pension account
- Monte Carlo lump sum tax matches `calculateLumpSumCommutation` directly for a
  pension-type balance large enough to exceed the R550,000 tax-free threshold

---

## Related Files

- `docs/project-phases/phase-9-site-improvement.md` — 9.1 Critical, three new items
  checked off
- `docs/history/2026-06-20-validator-audit-lump-sum-and-cgt-fixes.md` — prior pass on
  this same file set (account-type lump sum segregation, annuitisation cap, CGT
  exclusion, MC drawdown rewrite)
