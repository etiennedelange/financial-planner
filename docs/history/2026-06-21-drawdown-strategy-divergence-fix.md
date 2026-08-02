# Drawdown Strategy Divergence After Year 1

**Date:** 2026-06-21
**Author:** Claude
**Files Changed:**
- `lib/calculations/utils/drawdown-withdrawal.ts` (new)
- `lib/calculations/utils/drawdown-withdrawal.test.ts` (new)
- `lib/calculations/projection-engine.ts`
- `lib/monte-carlo/simulation-engine.ts`
- `lib/store/calculator-store.ts`
- `components/inputs/drawdown-strategy-form.tsx`
- `lib/calculations/__tests__/projection-engine.test.ts`
- `lib/monte-carlo/__tests__/simulation-engine.test.ts`
- `types/inputs.ts` (comment fix only)
- `docs/FINANCIAL_LOGIC_REFERENCE.md`
- `docs/project-phases/future-enhancements.md`

## Bug

Flagged as a High Priority item in `future-enhancements.md` on 2026-06-21 (same day): all
four `DrawdownStrategy` values (`fixed_percentage`, `fixed_amount_inflation_adjusted`,
`variable_percentage`, `guardrails`) only differed in how the *first* drawdown-year
withdrawal was computed (`calculateInitialWithdrawal`). From year 1 onward, both
`projection-engine.ts` and `simulation-engine.ts` simply inflated the prior year's
withdrawal by CPI:

```typescript
annualWithdrawal *= (1 + inflationRate)
```

So Fixed Percentage, Variable Percentage, and Guardrails all collapsed onto the exact
same path as Fixed Amount (Inflation Adjusted) once drawdown began — defeating the
purpose of choosing a strategy at all. `upperGuardrail`/`lowerGuardrail` existed on
`DrawdownConfig` but were never read anywhere in the calculation code, and were only
editable from the debug window, not the main UI.

## Root Cause

The year-0 anchor and the year-1+ recurrence were never separated as two distinct
concerns — the recurrence step was written once, generically, before guardrail/min-max
logic existed, and never revisited when those fields were added to the type.

## Fix

New shared utility `calculateNextWithdrawal()` in
`lib/calculations/utils/drawdown-withdrawal.ts`, called from both engines for year ≥ 1,
replacing the blind CPI-inflation line:

- **`fixed_percentage`**: recomputed as `currentBalance × initialWithdrawalRate` every
  year (pure percentage-of-portfolio). The deterministic engine has no desired-income
  floor — unbounded by design (§15 of FINANCIAL_LOGIC_REFERENCE.md). Monte Carlo passes
  an optional `desiredMonthlyIncomeToday` parameter and takes the **greater** of the two,
  preserving the pre-existing MC design rule (FINANCIAL_LOGIC_REFERENCE.md rule #15: test
  whether the user's actual income goal is achievable, not just whether the percentage
  withdrawal survives).
- **`fixed_amount_inflation_adjusted`**: unchanged — flat CPI escalation of the prior
  withdrawal. This is the only strategy where that was ever the intended behavior.
- **`variable_percentage`**: redefined for year 1+ as percentage-of-portfolio
  (`currentBalance × rate`), clamped to the inflation-adjusted `minimumWithdrawal`/
  `maximumWithdrawal` band *every year*, not just at t=0. (Re-clamping the old year-0
  basis — inflated desired income — every year would have been a no-op, since desired
  income and the min/max band both escalate at the same CPI rate; the clamp decision
  would never change after t=0. Redefining the basis to track the live balance is what
  actually makes this strategy respond to portfolio performance, which is the entire
  point of calling it "variable.")
- **`guardrails`**: implements the standard Guyton-Klinger decision rule — compare
  `previousWithdrawal / currentBalance` against `±guardrail%` bands around the target
  rate; cut 10% above the upper band (capital preservation), raise 10% below the lower
  band (prosperity rule), otherwise inflate by CPI as normal. Result is then clamped to
  the same inflation-adjusted min/max as Variable Percentage. `upperGuardrail`/
  `lowerGuardrail` default to 20% (the standard Guyton-Klinger band width) when unset.

Full formulas documented in `docs/FINANCIAL_LOGIC_REFERENCE.md` §15.

### UI

`upperGuardrail`/`lowerGuardrail` and `minimumWithdrawal`/`maximumWithdrawal` are now
editable in `drawdown-strategy-form.tsx` (previously debug-window-only):
- "Withdrawal Floor & Ceiling" inputs, shown for Variable Percentage and Guardrails.
- "Guardrail Bands" sliders (5–50%, step 5), shown only for Guardrails.

`calculator-store.ts` now seeds `upperGuardrail: 20, lowerGuardrail: 20` in
`defaultSettings.drawdownConfig` so the guardrail logic has sane values even before a
user touches the new sliders.

### Type comment fix

`types/inputs.ts` had stale, backwards comments on `upperGuardrail`/`lowerGuardrail`
("% above which to increase withdrawal" / "% below which to decrease withdrawal") written
before any guardrail logic existed. Corrected to match the actual (and standard)
Guyton-Klinger semantics: upper band breach → cut 10%, lower band breach → raise 10%.

## Testing

- `lib/calculations/utils/drawdown-withdrawal.test.ts` — 14 new unit tests covering all
  four strategies directly: balance-tracking, CPI inflation, min/max clamping at
  multiple years, guardrail band triggers in both directions, default band fallback,
  combined clamp+guardrail interaction.
- `projection-engine.test.ts` — new `describe('Drawdown strategy divergence after year 1')`
  block: deterministic single-account scenario with hand-derived expected withdrawal
  amounts at year 0 and year 1, asserting the four strategies diverge.
- `simulation-engine.test.ts` — new `describe('Drawdown strategy divergence after year 1')`
  block, using `equityVolatility: 0` to force deterministic returns (removes the need to
  mock `Math.random`), covering a guardrails-cut scenario and a fixed-percentage
  balance-tracking scenario.

```bash
npm run test
# 563/563 tests passed

npm run test:coverage
# drawdown-withdrawal.ts: 100%
# projection-engine.ts: 96.61%
# simulation-engine.ts: 99.27%

npm run build
# ✓ Compiled successfully, no TS errors
```

UI changes were not verified in a live browser this session — the chrome-devtools MCP
browser could not launch (no X server / headless display available in this sandbox).
Verified instead by code review of `drawdown-strategy-form.tsx` against the
`DrawdownConfig` type contract and the store's `setDrawdownConfig` partial-update pattern
used by every other field in the form.

## Related Files

- `docs/project-phases/future-enhancements.md` — High Priority bullet removed (resolved)
- `docs/FINANCIAL_LOGIC_REFERENCE.md` §15, §16 rule #18 — formulas and cross-reference
