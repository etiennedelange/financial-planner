# SA Retirement Calc Validator Audit: Lump Sum, Annuitisation Cap, MC Tax, CGT Exclusion

**Date:** 2026-06-20
**Author:** Claude
**Files Changed:**
- `lib/calculations/projection-engine.ts`
- `lib/monte-carlo/simulation-engine.ts`
- `lib/constants/tax-year.config.ts`
- `lib/constants/limits.ts`
- `types/simulation.ts`
- `lib/calculations/__tests__/projection-engine.test.ts`
- `lib/monte-carlo/__tests__/simulation-engine.test.ts`

## Summary

Ran the `sa-retirement-calc-validator` agent against the calculation engines. It found 2
critical and 2 high-severity bugs; all four are fixed and tested here.

---

## 1. (Critical) Lump sum commutation applied to TFSA/discretionary balances

Both `projection-engine.ts` and `simulation-engine.ts` deducted `lumpSumPercentage` from
the **total** portfolio balance at retirement, uniformly across every account type. SA
law only allows commuting a lump sum from pension/RA/preservation fund balances — TFSA
and discretionary money was never subject to this restriction or its tax table in the
first place.

Fixed by computing the lump sum against `pensionBalanceAtRetirement` (the sum of
`PENSION_TYPES` account balances only) and applying the resulting fraction solely to
those accounts when building drawdown state. TFSA and discretionary balances now pass
through lump-sum calculation completely untouched, regardless of the configured
percentage.

## 2. (Critical) No one-third annuitisation cap enforced in the engine

The UI slider caps the lump sum input at 33%, but neither calculation engine enforced
this independently — both trusted the caller. Since the engines are also invoked
directly from tests, debug tooling, and saved plans, a value above one-third could
silently bypass the legal commutation limit.

Added `MAX_LUMP_SUM_COMMUTATION_PERCENTAGE = 100 / 3` to `tax-year.config.ts`, exposed as
`SA_TAX_LIMITS.maxLumpSumCommutationPercentage`. Both engines now clamp the requested
percentage to this cap before computing the commutation amount.

This was deliberately **not** added inside `calculateLumpSumCommutation()` in
`retirement-tax.ts` — its existing test suite asserts unclamped behavior for 50%, 100%,
and >100% inputs as pure tax-table math, independent of the legal commutation limit. The
cap is enforced at the call site in each engine instead, keeping `retirement-tax.ts`
and its tests untouched.

## 3. (High) R40,000 CGT annual exclusion missing

Discretionary withdrawals taxed 40% of the entire realized capital gain with no annual
exclusion — SA law (s5(1) Eighth Schedule) excludes the first R40,000 of capital gains
per taxpayer per year before the inclusion rate applies.

Added `CGT_ANNUAL_EXCLUSION_CONFIG.individual = 40000` to `tax-year.config.ts`, exposed
as `SA_TAX_LIMITS.cgtAnnualExclusion`. Both engines now sum realized gains across **all**
discretionary accounts for the year (the exclusion is per-taxpayer, not per-account),
subtract the exclusion, then apply the 40% inclusion rate to the remainder.

## 4. (High) Monte Carlo used a single blended pool and didn't track tax

`simulateSingleRun` combined every account into one balance at retirement and drew it
down using a single blended return series, with a comment admitting tax was only
"implicitly included" in the withdrawal amount. This diverged from the deterministic
engine's per-account sequential withdrawal model (TFSA → discretionary → pension), which
is the actual driver of success-rate differences between the two engines — not tax
feedback into portfolio depletion, since neither engine ever fed tax back into the
nominal Rand amount withdrawn.

Rewrote the drawdown phase of `simulateSingleRun`:
- Each account keeps growing on its own stochastic return sequence (already generated
  for the full `totalYears` during accumulation; the drawdown-years slice was previously
  discarded and replaced with one blended series).
- Withdrawals are sourced in the same order as `projection-engine.ts`: TFSA first, then
  discretionary (tracking realized gain and reducing cost basis), then pension/RA/
  preservation.
- Per-year income tax and CGT (with the R40k exclusion) are computed for reporting and
  summed into a new optional `SimulationRun.lifetimeIncomeTax` field, aggregated as
  `SimulationResult.averageLifetimeIncomeTax`. Both are additive/optional so no existing
  consumer of `SimulationRun`/`SimulationResult` needed changes.
- Tax does **not** force additional liquidation — it remains informational only, mirroring
  the deterministic engine.

`scenario-comparison.ts` wraps its synthetic account as `type: "discretionary"` with
`lumpSumPercentage: 0`, so it is unaffected by fixes #1–#2 and only gains CGT-exclusion
tax reporting from fix #4; its `successRate` (driven purely by portfolio survival) is
unchanged.

---

## Testing

```bash
npx vitest run
# 536/536 tests passed (11 new tests: 7 in projection-engine.test.ts, 6 in simulation-engine.test.ts)

npm run build
# Compiled successfully, no TS errors

npm run test:coverage
# projection-engine.ts: 95.5% lines
# simulation-engine.ts: 99.1% lines
# All files: 96.5% lines (above the 90% threshold)
```

New tests cover, deterministically wherever possible (zero-return/zero-volatility
accounts, or a fixed `Math.random()` cycle to pin the log-normal return draw):
- Lump sum is not applied to TFSA or discretionary balances, in both engines
- Lump sum is applied only to the pension-type share of a mixed portfolio
- A request above one-third is clamped to exactly one-third; a request already within
  the limit passes through unchanged
- CGT is zero when the realized gain is below the R40,000 exclusion
- Only the gain in excess of R40,000 is taxed
- Monte Carlo reports zero average lifetime tax for TFSA-only drawdown and a nonzero,
  analytically-matched value once a discretionary gain exceeds the exclusion

---

## Related Files

- `docs/project-phases/phase-9-site-improvement.md` — 9.1 Critical/High, now checked off
- `docs/history/2026-06-20-phase9-calculation-dedup-and-guards.md` — prior pass on this
  same file set (negative-years guard, CGT inclusion-rate constant, dedup)
