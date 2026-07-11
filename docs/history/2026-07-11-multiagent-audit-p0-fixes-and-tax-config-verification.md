# Multi-Agent Audit: P0 Fixes + Tax Config Primary-Source Verification

**Date:** 2026-07-11
**Author:** Claude
**Files Changed:**
- `lib/calculations/projection-engine.ts`
- `lib/calculations/__tests__/projection-engine.test.ts`
- `docs/FINANCIAL_LOGIC_REFERENCE.md`

## Summary

Ran a team of 8 specialist auditor subagents (mathematics, reference-validator, tax,
software, edge-case, financial, sa-retirement-calc-validator, devil's-advocate) against
the full calculation engine, cross-talking where findings overlapped. Fixed the two
confirmed P0 calculation bugs below, and definitively resolved a disputed-constants
question the team could not close on its own (no agent has live web access).

---

## 1. (Critical) `inflationAdjustedWithdrawal` deflated from the wrong base year

`projection-engine.ts` divided the nominal withdrawal by `(1+inflation)^year`, where
`year` is the 0-indexed drawdown-loop counter, instead of `(1+inflation)^(yearsToRetirement+year)`.
Since `year` resets to 0 at the start of drawdown, this only stripped in-retirement
inflation and left the entire pre-retirement accumulation period's inflation baked in —
for the default 30-year accumulation horizon at 5.5% inflation, the "today's Rands"
withdrawal figure shown to users (and CSV-exported) was overstated by roughly 5x in the
first drawdown year. The adjacent medical-aid escalation line (`:483`, two lines away)
already used the correct exponent, and `docs/FINANCIAL_LOGIC_REFERENCE.md` documented
the buggy formula verbatim — both fixed here.

Fix: `inflationAdjustedWithdrawal: totalWithdrawal / Math.pow(1 + inflationRate, yearsToRetirement + year)`.

New test (`Inflation adjustments > deflates withdrawals to today's Rands from today, not
from the retirement date`) asserts the exact today's-Rands relationship
(`withdrawals / (1+inflation)^i` for array index `i`, since every projection-year index
is exactly `i` years from today) across accumulation and drawdown years alike.

## 2. (Critical) `shortfallAmount` was structurally zero for 3 of 4 withdrawal strategies

`calculateInitialWithdrawal` returns the desired income verbatim (mod min/max clamp) for
`fixed_amount_inflation_adjusted`, `variable_percentage`, and `guardrails` — only
`fixed_percentage` derives its withdrawal from the live portfolio. The old shortfall
calc compared `desiredMonthlyAtRetirement` against `monthlyIncomeAtRetirement`, which for
those three strategies is definitionally equal to the desired amount, so
`shortfallAmount` was `0` even when the portfolio fully depleted years before life
expectancy and real withdrawals dropped to R0. This reached users directly via
`sticky-results-bar.tsx`, which renders a reassuring "R0 shortfall" on a plan that is
actually failing.

Fix: sum the per-year gap between the inflation-adjusted desired income and the *actual*
withdrawal recorded in each drawdown-year's `yearlyProjections` entry (which is already
capped at the live portfolio balance, and drops to 0 in fully-depleted years):

```typescript
const shortfallAmount = yearlyProjections
  .slice(yearsToRetirement)
  .reduce((sum, yp, drawdownYear) => {
    const desiredAnnualThisYear =
      desiredMonthlyAtRetirement * 12 * Math.pow(1 + inflationRate, drawdownYear)
    return sum + Math.max(0, desiredAnnualThisYear - yp.withdrawals)
  }, 0)
```

This captures both portfolio depletion and guardrail/variable-percentage cuts below the
desired income, for all four strategies.

New tests (`Shortfall/Surplus calculation > should calculate shortfall when portfolio
insufficient under %s strategy`, parameterized over the three previously-broken
strategies) assert `shortfallAmount > 0` and `portfolioDepletionAge !== null` for a
portfolio that cannot possibly sustain the configured income.

## 3. Disputed tax-year constants — verified correct, no change made

Three of the eight auditors (tax-auditor, reference-validator, sa-retirement-calc-validator)
independently flagged `RETIREMENT_CONTRIBUTION_LIMITS_CONFIG.pensionRaMaxDeduction`
(R430,000), `TFSA_LIMITS_CONFIG.annualLimit` (R46,000), and `CGT_ANNUAL_EXCLUSION_CONFIG.individual`
(R50,000) as likely-wrong reversions of previously-validated lower figures (R350k/R36k/R40k),
based on the repo's own history docs and the size of the jump from long-stable values. The
devil's-advocate pass correctly identified this as a risk of groupthink/training-data
anchoring — none of the agents have live web access, so "3 of 8 agreed" was shared bias,
not independent confirmation — and recommended blocking on the actual primary source
before changing anything either direction.

Fetched the primary source directly: `https://www.sars.gov.za/wp-content/uploads/Docs/Budget/Budget2026/Budget-tax-guide-2026-web-version.pdf`
(the exact PDF already cited at `tax-year.config.ts:9`). Every value currently in the
config — income tax brackets, rebates, tax thresholds, both lump-sum tables, the 27.5%/R430,000
retirement fund deduction cap, the R46,000 TFSA annual limit, the R50,000 CGT annual
exclusion, and the R376/R376/R254 medical scheme fee tax credits — matches the SARS
Budget 2026 Tax Guide exactly. **No revert was needed; the config was already correct.**
Budget 2026 genuinely included unusually large increases to several SARS limits that had
been stable for years (the guide's own "Budget Highlights" section calls out the bracket/rebate
inflation adjustment and the TFSA limit increase specifically), which is what triggered
every agent's stale-training-data intuition.

Confirmed as a genuine (separate, pre-existing) gap while cross-referencing the guide: SARS
has a distinct, harsher "Retirement Fund Lump Sum **Withdrawal** Benefits" table (tax-free
only to R27,500, then 18/27/36% with different thresholds) for pre-retirement withdrawals,
which is separate from the "Retirement Fund Lump Sum Benefits" (at-retirement/death) table
already in `RETIREMENT_LUMP_SUM_CONFIG`. Only the at-retirement table is modeled. Not
addressed in this pass — tracked as a follow-up if the app ever models pre-retirement
withdrawals.

---

## Testing

```bash
npx vitest run lib/calculations/__tests__/projection-engine.test.ts
# 71/71 tests passed (3 new)

npm run test
# 576/577 passed — the 1 failure (random-returns.test.ts sample-mean check) is a
# pre-existing flaky/unseeded-RNG test, unrelated to this change; passes in isolation

npm run build
# Compiled successfully, no TS errors
```

## Related Files

- `docs/project-phases.md` — dated entry added to "Current Status Summary"
