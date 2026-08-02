# Phase 9.1 Critical: Calculation Correctness & Deduplication

**Date:** 2026-06-20
**Author:** Claude
**Files Changed:**
- `lib/calculations/projection-engine.ts`
- `lib/calculations/scenario-comparison.ts`
- `lib/monte-carlo/simulation-engine.ts`
- `lib/constants/limits.ts`
- `lib/calculations/__tests__/projection-engine.test.ts`

## Summary

Addressed the four "Critical" items in `docs/project-phases/phase-9-site-improvement.md` section 9.1.

---

## 1. Negative years guard

`calculateProjection` computed `yearsToRetirement` and `yearsInRetirement` directly from
`PersonalInfo` ages with no validation. If called with inverted ages (e.g.
`retirementAge < currentAge`), the accumulation/drawdown loops would either not run or
behave unpredictably. The input forms already guard against this with Zod, but the
engine itself is also called directly from tests, debug tooling, and exports.

Extracted the existing "no accounts" degenerate-result literal into a shared
`buildEmptyProjectionResult()` helper, and added an early return using it when
`yearsToRetirement < 0 || yearsInRetirement < 0`. `shortfallAmount` is clamped to 0 in
that case (a negative `yearsInRetirement` would otherwise produce a negative shortfall).

Zero years (e.g. already at retirement age) remains valid and unaffected — only
negative values short-circuit.

---

## 2. CGT inclusion rate to constants

`projection-engine.ts` hardcoded `0.40` as the CGT inclusion rate for individuals when
calculating taxable gains on discretionary account withdrawals. Moved to
`SA_TAX_LIMITS.cgtInclusionRateIndividual` in `lib/constants/limits.ts`, consistent with
how every other SA tax constant in that file is defined.

---

## 3. `calculateMonthlyReturn()` deduplication

The function existed in three places with identical logic:
- `lib/calculations/utils/projection.ts` (canonical, exported, documented, tested via `projectFinalSavings`)
- `lib/calculations/projection-engine.ts` (private copy)
- `lib/monte-carlo/simulation-engine.ts` (inlined ternary, not even a named function)

Removed both duplicates; both files now import `calculateMonthlyReturn` from
`lib/calculations/utils/projection.ts`.

---

## 4. Monte Carlo duplication in scenario comparison

`scenario-comparison.ts` had its own `runFullMonteCarloSimulation()` that reimplemented
the full accumulation + drawdown loop (with its own Box-Muller sampler,
`generateRandomReturn()`) instead of using `runMonteCarloSimulation()` from
`simulation-engine.ts` — despite already importing it under an alias (`runMonteCarlo`)
that was never called. This meant the "Investment Scenarios" comparison and the main
Monte Carlo simulation could silently drift apart in methodology over time (this had
already happened once — see `2026-01-15-scenario-comparison-methodology-fix.md`).

Replaced the local reimplementation: `runFullMonteCarloSimulation()` now packages the
scenario's aggregate inputs (current savings, monthly contribution, escalation, nominal
return, volatility, compounding method) into a single synthetic `Account` and calls the
shared `runMonteCarloSimulation()` directly. The synthetic drawdown config forces
`strategy: "fixed_amount_inflation_adjusted"` with no lump sum, which reproduces the
function's prior behavior exactly: it always tests whether the scenario can fund the
user's actual desired income, regardless of their configured drawdown strategy
elsewhere in the app.

Removed the now-unused `generateRandomReturn()` local sampler — the shared engine uses
the same log-normal Box-Muller distribution via `lib/monte-carlo/random-returns.ts`.

Exact success-probability values will differ slightly run-to-run from before (different
RNG call sequence), but this is expected for a Monte Carlo simulation; behavior and
distribution shape are unchanged. All existing `scenario-comparison.test.ts` assertions
operate on ranges/properties rather than exact stochastic values and continue to pass.

---

## Testing

```bash
npx vitest run
# 523/523 tests passed (520 existing + 3 new negative-years guard tests)

npm run build
# ✓ Compiled successfully, no TS errors

npx vitest run --coverage <touched files>
# projection-engine.ts: 95.0% lines
# scenario-comparison.ts: 96.2% lines
# simulation-engine.ts: 98.7% lines
```

---

## Related Files

- `docs/project-phases/phase-9-site-improvement.md` — section 9.1 Critical, now checked off
- `docs/history/2026-01-15-scenario-comparison-methodology-fix.md` — prior methodology alignment this change builds on
