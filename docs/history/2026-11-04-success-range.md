---
type: History Entry
title: "2026-11-04 — Success shown as a cautious–central range on the Risk page"
description: "Feature 2 of the investment-types plan: the same simulated futures are run at 1× and 1.3× volatility (required SimulationConfig.volatilityScale, one seed), the Risk page shows a likely X–Y% range with the verdict on the lower bound, success labels are unified in one table, and the scenario memo no longer reruns on volatility keystrokes."
date: 2026-11-04
tags: [monte-carlo, risk, ui]
---

# 2026-11-04 — Success shown as a range

Feature 2 of the [investment types plan](../superpowers/plans/2026-11-01-investment-types-range-stress-test.md).
It builds on [investment types per account](2026-11-04-investment-types-per-account.md).

## Why

One success rate overstated how much is known. For Etienne's plan, a volatility of 10% gave
93% and 16.5% gave 70%. Researched per-type volatilities narrow that, but volatility itself
varies by decade. The worst rolling 10-year ALSI volatility was 1.33× its long-run figure.

## What changed

**Engine.**
- `SimulationConfig.volatilityScale` is **required** (CLAUDE.md: no omitted optionals for a
  real behavioural difference). All 74 call sites state it; existing ones pass 1.
- The engine multiplies every resolved account volatility by the scale. A non-finite scale
  means 1; a negative one clamps to 0.

**Worker.**
- The request carries a list of configs and returns results in the same order.
- `useMonteCarloWorker` sends `[1, CAUTIOUS_VOLATILITY_FACTOR]` with one fresh seed per
  request (`newRangeSeed`). Each input change still samples new futures, as before, but both
  runs see the same futures. The cost is 2 × 1,000 runs, on the Risk page only.
- The context exposes `cautiousSimulationResult` beside `simulationResult` (central).

**Risk page.**
- **Plan Success Rate:** shows "X–Y%" with "Likely range · <label>". The label, card tone,
  page verdict and chart header follow the lower bound. The tooltip explains both figures.
- **Futures That Fall Short:** shows the complementary range.
- **Shortfall age and fan chart:** still use the central run, labelled "long-run volatility"
  where it matters.
- **Methodology card:** explains the two runs.

**Labels unified** (open audit item). `SUCCESS_RATE_BANDS` in `lib/utils/success-rate.ts` is
the only table. `getSuccessRateStyle` and `buildPlanVerdict` both read it. 60–75% now reads
"Fair" / "Your plan may fall short" (it was "Fair" beside "at risk"). 40–60% reads "At Risk" /
"Your plan is at risk" (it was beside "under pressure").

**Scenario memo** (open audit item). The Risk page's `compareScenarios` memo depended on the
whole `assumptions` object, so it reran 3 × 1,000 main-thread simulations on every volatility
keystroke. It now depends on `assumptions.compoundingMethod`, the only field it reads.

## Tests

- `sa-audit-scenarios.test.ts`:
  - cautious success ≤ central for untyped, balanced, global and concentrated plans with the same seed;
  - strictly lower for a plan near the edge;
  - the range collapses at zero volatility;
  - the scale widens the band for typed and untyped accounts;
  - scale 0, negative and NaN behave as documented;
  - the verdict follows the lower bound.
- `success-rate.test.ts`: band ordering, NaN → Critical, `successRange` ordering and
  collapse, `formatSuccessRange`.
- `plan-verdict.test.ts`: the verdict agrees with the band in every band.
- `use-monte-carlo-worker.test.ts`: range reducer shape, the scale list, `newRangeSeed`.
- The golden Monte Carlo file is unchanged: scale 1 reproduces it.

## Verification

- `check`, `typecheck`: 0 errors. Tests: 1,226 pass.
- Line coverage is 100% on `simulation-engine.ts`, `success-rate.ts` and `plan-verdict.ts`.
  `use-monte-carlo-worker.ts` is at 23%: only its reducer and helpers are unit-tested, and the
  worker effect is exercised in the browser.
- Production build OK; shadscan 93/100.
- Browser check of the Risk page with the typed test plan:
  - "85–92%", "Likely range · Good", verdict "Your plan is likely to hold" (from 85%);
  - "Futures That Fall Short" shows 8–15%;
  - a volatility keystroke returned in about 0.3 s with no page errors.
