---
type: History Entry
title: "2026-11-04 — Coverage gaps closed: worker lifecycle, currency edge cases, tooltips; global branch coverage back above 85%"
description: "The Monte Carlo worker lifecycle moved into a tested framework-free client; currency formatting got tests that found five display bugs (fixed); tooltip edge cases covered. npm run test:coverage passes its 85% global branch threshold again (82.8% → 85.87%)."
date: 2026-11-04
tags: [tests, monte-carlo, ui]
---

# 2026-11-04 — Coverage gaps closed

Closes three items from §9.2 of [phase 9](../project-phases/phase-9-site-improvement.md):
- worker lifecycle untested;
- `currency.ts` edge cases;
- global branch coverage below its 85% threshold.

Branch coverage was 82.41% at `e7d4978` and 82.8% after that day's feature work.

## Monte Carlo worker lifecycle

There is no `@testing-library/react` in the project, so the hook could not be rendered in a
test. Rather than add a dependency, the lifecycle moved out of React into
`lib/monte-carlo/range-worker-client.ts`:
- `createRangeWorkerClient(createWorker, onResult, onError)` creates the worker lazily on the
  first run and reuses it.
- Each run gets an increasing id, and replies for superseded runs are dropped, so a slow old
  result can't overwrite a new one.
- A worker error is reported, and so is a reply without both results. The old hook would have
  passed `undefined` as the cautious result.
- `dispose()` terminates the worker.
- `buildRangeRequest` (pure) builds one config per volatility scale, all on one seed.
  `newRangeSeed`, `RANGE_VOLATILITY_SCALES` and `SimulationRange` moved here too, and are
  re-exported from the hook.
- `useMonteCarloWorker` now only wires the client to its reducer.

**Tests:** `range-worker-client.test.ts`, 14 tests with a fake Worker. They cover lazy
creation and reuse, fresh seeds, dispose and re-create, latest-run delivery, superseded
replies dropped, one or zero or missing results reported as errors, and worker errors. The
request also runs end to end in the real engine, with cautious success never above central.

## Currency formatting: tests found five bugs

| Input | Before | After |
|---|---|---|
| `formatCurrency(-0.4)` | `-R 0` | `R 0` |
| `formatCurrency(NaN)`, `Infinity` | `RNaN`, `R∞` | `—` (`NO_VALUE`) |
| `formatCurrency(-2.5e6, { compact })` | `R-2.5M` | `-R2.5M`, sign first like the full format |
| `formatCurrencyCompact(-2.5e6)` | `R-2500000` | `-R2.5M` |
| compact rounding at a unit boundary, e.g. `999.6`, `999 600`, `999 960 000` | `R1000`, `R1000K`, `R1000.0M` | `R1k`/`R1K`, `R1.0M`, `R1.0B` |

The only live caller of `formatCurrencyCompact` (the what-if panel) passes `Math.abs(...)`,
so its negative bug was latent. The others could reach the screen.

**Tests:** `currency.test.ts`, 33 tests. They cover grouping, the sign, real-mode deflation
in both call shapes, decimals and rounding, compact units and boundaries, non-finite input,
zero, very large values, and `toRealValue`. With the original `currency.ts` (plus the new
`NO_VALUE` export), 13 of them fail.

## Tooltips

`chart-tooltip.test.ts` gained 11 edge-case tests: missing payload items, string-field
redirects, an unconfigured key falling back, a null nested payload, an explicit `labelKey`,
default keys, and non-numeric or missing values.

## Verification

- Tests: 1,312 pass. `check`, `typecheck` and `build` are clean; shadscan 90/100.
- `npm run test:coverage`: branches 85.87% (passes), lines 93.47%. `currency.ts` is at 100%
  lines; `range-worker-client.ts` is fully covered.
