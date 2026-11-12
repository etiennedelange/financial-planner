---
type: History Entry
title: "2026-11-12 — Risk simulation stuck on 'Waiting for simulation' (two worker entries crossed)"
description: "After the issue #34 fix added a second Web Worker entry, the production Turbopack build crossed the two workers when both started on the Risk page: each could run the other's code, so the success rate or scenario cards never arrived. Merged into one worker entry that handles both request kinds, with a test that fails if a second entry appears."
date: 2026-11-12
tags: [bug, monte-carlo, performance, build]
---

# 2026-11-12 — One worker entry: the Risk simulation stuck on "Waiting for simulation"

## Symptom

After [the issue #34 fix](2026-11-12-page-freeze-scenario-worker.md) shipped, the Risk page
sometimes showed "--" with "Waiting for simulation" under every Monte Carlo figure. That
state means the success-range worker reported an error, so no result arrived and nothing
was running.

## Root cause

The #34 fix added a second worker entry, `scenario-comparison.worker.ts`, next to
`simulation.worker.ts`. Both hooks start their worker on the Risk page at about the same
time. In the production build (`next build` + `next start`; the dev server was not
affected) the two were crossed:

- Both Turbopack workers start from the same bootstrap script,
  `turbopack-worker-<hash>.js`, with different `#params=` chunk lists. Each list named the
  correct entry chunk.
- Even so, a worker created for one entry sometimes ran the other entry's code. Seen in
  the browser:
  - the scenario worker threw `Cannot read properties of undefined (reading 'map')` from
    the range worker's chunk (its `configs.map`, given a scenario request);
  - with raw `new Worker(...)` calls and no app code, the range worker's URL answered a
    scenario request with the scenario reply shape.
- When the range worker got the scenario code, it crashed on its request and the page
  showed "Waiting for simulation", as reported. The other way round, the scenario cards
  never appeared.

The exact trigger inside Turbopack's worker runtime was not isolated. Workers built from a
plain static script, differing only in the URL fragment, each saw their own fragment, so it
is not simply the browser ignoring the fragment.

## Fix

- **One worker entry.** `simulation.worker.ts` handles both request kinds through an
  exported `handleWorkerMessage`. A request tagged `kind: "scenarios"` goes to
  `compareScenarios`; the existing range request (untagged, unchanged) goes to
  `runMonteCarloSimulation`. `scenario-comparison.worker.ts` is deleted.
- `useScenarioComparisonWorker` now creates its worker from `simulation.worker.ts`;
  `createScenarioWorkerClient` tags its requests `kind: "scenarios"`. Each hook still owns
  its own worker instance. Because every instance runs identical code, a crossed load can
  no longer give a worker the wrong handler.
- Guard: `simulation.worker.test.ts` scans `app/`, `components/` and `lib/` for
  `new Worker(new URL(...))` and fails unless every one names `simulation.worker.ts`. The
  header of `simulation.worker.ts` explains why.

## Tests and verification

- `simulation.worker.test.ts`:
  - a range request returns one result per config, equal to direct seeded engine calls;
  - a `kind: "scenarios"` request returns `compareScenarios`' result and no `results`;
  - the single-entry guard (on `main` before this fix it finds two entries, so it fails).
- `scenario-worker-client.test.ts` / `use-scenario-comparison-worker.test.tsx`: requests
  carry `kind: "scenarios"`; the worker module test now loads `simulation.worker.ts`.
- `npm run check` 0 errors; `npm run typecheck` clean; 80 files / 1,377 tests pass.
- Production build (`next build` + `next start`, Playwright):
  - before: every Risk load logged "Scenario comparison worker error" and the crossed
    worker's `.map` TypeError;
  - after: both workers load the same chunk, and there are no worker or page errors;
  - in 15 rounds of editing Plan, sometimes visiting another tab, then opening Risk, the
    success rate appeared in 15/15;
  - the scenario cards render about 0.7 s after load.
