---
type: History Entry
title: "2026-11-12 — Page freezes after editing Plan inputs (issue #34)"
description: "A hidden Risk page ran 3 × 1,000 Monte Carlo simulations on the main thread on every Plan keystroke (Next keeps visited routes mounted under cacheComponents); compareScenarios now runs in a Web Worker. Also: the Market Assumptions form now validates before writing, and a v3 store migration repairs rates the old form persisted."
date: 2026-11-12
tags: [performance, bug, monte-carlo, validation, store]
---

# 2026-11-12 — Page freezes after editing Plan inputs (issue #34)

Issue: [etiennedelange/financial-planner#34](https://github.com/etiennedelange/financial-planner/issues/34)
"Page freezes occasionally when playing around with inputs on Plan page and switching back
to other tabs".

## Root cause

1. `next.config` sets `cacheComponents: true`. Next 16 then keeps recently visited routes
   mounted inside a hidden React `<Activity>` instead of unmounting them
   (`node_modules/next/dist/docs/.../cacheComponents.md`, "Navigation with Activity").
   Hidden routes still re-render when the store slices they read change; only their
   effects are torn down.
2. `RiskPage` computed `compareScenarios(...)` in a `useMemo`: 3 × 1,000 Monte Carlo runs,
   synchronously, on the main thread, keyed on `personalInfo`, `retirementGoals` and
   `drawdownConfig`.
3. The Plan forms write to the store on every keystroke.

So once Risk had been opened, every Plan keystroke re-ran 3,000 simulations in the hidden
Risk page. The switch to another tab then had to wait for the backlog. "Occasionally"
because it needs Risk to have been visited and still be in Next's hidden-route cache.

### Measured (Playwright, dev server, 4 accounts, typing six characters into Annual Income)

| Session | Monte Carlo CPU while typing | Main-thread long tasks |
|---|---|---|
| Risk never visited | 0 ms | — |
| Risk visited, before fix | 660 ms (2,764 ms at 4× CPU throttle) | ~115 ms per keystroke (~450–600 ms throttled; 3,518 ms total) |
| Risk visited, after fix (4× throttle) | 0 ms | 838 ms total, the same as never visiting Risk (896 ms) |

The CPU profile before the fix attributed the time to
`RiskPage → compareScenarios → runFullMonteCarloSimulation → simulateSingleRun`, even with
Plan or Charts on screen.

## Fix

> **Superseded detail (same day):** the separate `scenario-comparison.worker.ts` entry below was
> crossed with `simulation.worker.ts` in the production build and has been merged into it. See
> [2026-11-12-single-worker-entry.md](2026-11-12-single-worker-entry.md).

- **`compareScenarios` runs in a Web Worker.** New `lib/monte-carlo/scenario-comparison.worker.ts`
  (calls the existing `compareScenarios`, no logic of its own),
  `scenario-worker-client.ts` (same contract as `range-worker-client.ts`: lazy worker,
  increasing run ids, superseded replies dropped, missing result reported as an error) and
  `use-scenario-comparison-worker.ts`. `RiskPage` memoises the plain params object and
  passes it to the hook.
- The run lives in an effect, so a hidden Risk page posts nothing at all: React tears its
  effects down while hidden and re-runs once with the latest inputs when it is shown.
- The previous result stays on screen while a new comparison runs (as for the fan chart).

### Second bug found while reproducing: Market Assumptions accepted anything

Unlike the other Plan forms, `assumptions-form.tsx` wrote watched values to the store
without `schema.safeParse` and showed no validation errors. A cleared field stored `NaN`
(persisted as `null`); during testing the store reached `equityReturn: 150000` and
`bondReturn: 3000`. It did not cause the freeze, but invalid inflation flows into every
projection.

- The watch handler now validates first and writes nothing if any field is invalid
  (matching `personal-info-form.tsx`). `FieldError` messages show under each field.
- The bounds live in new `lib/utils/assumption-rates.ts` (`ASSUMPTION_RATE_BOUNDS`), used by
  both the zod schema and the input `min`/`max`.
- **Store version 2 → 3.** `migrate` resets any non-finite or out-of-range persisted rate
  (`assumptions.equity/bond/cashReturn`, `assumptions.inflationRate`,
  `retirementGoals.inflationRate`) to the SA default via `sanitizeAssumptionRate`. Replaced,
  not clamped: a cleared field has no nearest value, and pinning 150000% to 30% would keep an
  extreme assumption silently. `migrate` stays idempotent and runs every step for any older
  version, so v1 payloads still get the monetary clamp (comment in
  `legacy-scope-migration.ts` updated).
- Not covered: a signed-in user's Supabase scenario row written by the old form. `loadPlan`
  does not go through `migrate`. Auth is still behind `NEXT_PUBLIC_AUTH_ENABLED`, so no
  production rows are expected.

## Tests and verification

- `scenario-worker-client.test.ts`: lifecycle, superseded replies, missing result, worker
  error, and the worker module itself answering with `compareScenarios` (deterministic fields
  identical to the main-thread call).
- `use-scenario-comparison-worker.test.tsx`: reducer, and the hook with a stub `Worker`:
  nothing posted for `null`, one post per params change, result delivered, error reported,
  worker terminated on unmount.
- `assumption-rates.test.ts`: in-range values kept, NaN/null/strings/infinities and
  out-of-range values replaced, bounds inclusive.
- `calculator-store.test.ts`: v2 → v3 migration (null and out-of-range reset, valid
  boundaries kept, missing assumptions, v1 payload gets both steps).
- `assumptions-form.test.tsx`: valid input reaches the store; a cleared or out-of-range field
  never does and shows its error; an invalid field holds back the other edits. With the old
  form, 3 of the 4 fail.
- New code at 100% statements, branches and functions; `calculator-store.ts` branches 82.2%.
- `npm run check` 0 errors; `npm run typecheck` clean; 79 files / 1,374 tests pass;
  `npm run build` passes (with the example `.env`); shadscan 90/100 (unchanged).
- Browser: the Risk scenario cards render from the worker (~1.1 s after load); a v2 payload
  holding `null` inflation and 150000% equity loads as version 3 with 5.5% and 11%; clearing
  inflation on Plan shows "Enter an inflation rate" and leaves the stored 5.5% unchanged.
