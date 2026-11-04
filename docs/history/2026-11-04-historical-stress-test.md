---
type: History Entry
title: "2026-11-04 — Historical stress test: a 2008-style first year of retirement"
description: "Feature 3 of the investment-types plan: a deterministic Risk-page card comparing steady returns with each account's worst researched 12-month fall in the first retirement year, built on a required per-year drawdown return override so the stress test reuses the projection engine; shadscan 90/100 with one recorded waiver."
date: 2026-11-04
tags: [risk, calculations, ui]
---

# 2026-11-04 — Historical stress test

Feature 3 of the [investment types plan](../superpowers/plans/2026-11-01-investment-types-range-stress-test.md),
which is now complete. The figures come from the [research record](2026-11-04-investment-type-risk-research.md).
The stress basis (worst rolling 12-month return) was Etienne's decision, recorded there.

## What changed

**Engine (no copied loop).**
- `runDrawdownPhase` takes a **required** `returnOverrides: DrawdownReturnOverrides`
  (`[year][accountIndex]`). A number replaces that account's net return for the year,
  converted geometrically so the year returns exactly that figure. `null` keeps the
  account's own return. NaN is ignored, and values below −100% clamp. Test call sites pass `[]`.
- `calculateProjectionWithDrawdownReturns(…, overrides)` is the single orchestration.
  `calculateProjection` is that function with `[]`.
- `incomeGoalForDrawdownYear` is exported, and `selectIncomeGoalShortfallAge` now uses it,
  so the stress test's "share of goal" reads the same goal the shortfall selector does.

**Per-account stress return.**
- `resolveAccountRisk` gained `stressReturn`. Typed accounts take their type's figure.
- Untyped accounts with a non-zero return take SA equity's −37.6% (`UNTYPED_STRESS_RETURN`).
  That is consistent with untyped accounts taking equity volatility in Monte Carlo, and it is
  the cautious choice.
- An untyped account with a 0% return (the cash marker) does not fall.

**`lib/calculations/stress-test.ts`.**
- `buildFirstYearStress` builds year-0 overrides net of each account's fees, plus a
  per-account description. Subtracting fees double-counts a little for the factsheet figures,
  which are already net of fund fees; that errs in the cautious direction.
- `summariseStressOutcome` reports the shortfall age, the final balance (nominal and in
  today's rands) and the lowest year's income as a share of the goal.
- `calculateStressTest` returns steady and stressed outcomes side by side.

**UI.** `components/results/stress-test-card.tsx` on the Risk page, below the fan chart:
- a plain-English sentence, e.g. "In a 2008-style fall at 65, your goal income lasts to 90,
  the same as with steady returns";
- a steady vs 2008-style table, respecting Today's Value or Future Value;
- an expandable list of the fall used for each account, with its basis.

It is deterministic and computed in a `useMemo`: two projections, no worker.

## Tests

`lib/calculations/stress-test.test.ts`, 19 tests:
- **SA equity plan:** its shortfall comes earlier after the fall.
- **All four equity and fund types:** the stressed shortfall age is never later, and the final
  balance and worst-year share are never higher, than with steady returns.
- **Shocks:** the documented figures are applied net of fees for typed, untyped and cash accounts.
- **Engine equivalence, both compounding methods:** no overrides reproduces `calculateProjection`
  exactly, and so does a `null` override. Under `compound`, an override equal to the account's
  own return changes nothing.
- **Hand-computed −40% year under both methods:** ending = B·0.6 − W·((1+i)^12 − 1)/(12i), i = 0.6^(1/12) − 1.
- **Edge cases:**
  - only the first retirement year is shocked, not accumulation;
  - no income goal; zero balance;
  - an override below −100%; a NaN override;
  - deflation to today's rands; no assumptions.

`account-risk.test.ts`: stress return per type, the untyped figure, and the cash marker.

The golden projection and Monte Carlo files are unchanged.

## Verification

- `check`, `typecheck`: 0 errors. Tests: 1,253 pass.
- Line coverage is 100% on `stress-test.ts` and `projection-engine.ts`.
- Production build OK.
- Browser check of the Risk page with the typed test plan:
  - "goal income lasts to 90, the same as with steady returns";
  - money left at 90 falls from R27.5M to R12.9M in today's rands;
  - the per-account falls are listed;
  - no horizontal scroll at 390px; no page errors.

## shadscan: 90/100 (gate passes; baseline was 93)

My first version of the card scored 88. I fixed two findings it introduced:
- the chevron was missing `data-icon="inline-start"`;
- the per-account falls table had no empty state; it now has one.

**Waived (Etienne, 2026-11-04), recorded in CLAUDE.md; baseline now 90:** `empty-state-present` at
`stress-test-card.tsx` (the steady vs stressed comparison table). That table always has
exactly three fixed rows, so an empty state would be dead code. Satisfying the detector would
mean restructuring the table only to move the score, which CLAUDE.md rules out.
