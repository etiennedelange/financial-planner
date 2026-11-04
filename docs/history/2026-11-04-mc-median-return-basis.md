---
type: History Entry
title: "2026-11-04 — Monte Carlo expected return is the typical (median) return"
description: "Decision 0 of the investment-types plan: returnsFromShocks drops the −σ²/2 drag so the deterministic projection is the middle of the Monte Carlo range; tests, golden file and methodology copy updated; success rates rise 8–18 points in the golden matrix."
date: 2026-11-04
tags: [monte-carlo, calculations, decision]
---

# 2026-11-04 — Monte Carlo expected return is the typical (median) return

Decision 0 of the [investment types, range and stress test plan](../superpowers/plans/2026-11-01-investment-types-range-stress-test.md).
Etienne chose the typical (median) return.

## What changed

`returnsFromShocks` (`lib/monte-carlo/random-returns.ts`), the only place the formula lives:

| | Before | After |
|---|---|---|
| Log mean | `ln(1 + r) − σ²/2` | `ln(1 + r)` |
| What `r` means | arithmetic mean of yearly returns | median (compound, CAGR) return |
| Deterministic projection is the… | mean path; the median landed ~34% below after 30 years at σ = 16.5% | median path (exact with no cash flows, close with them) |
| Arithmetic mean of draws | `r` | `(1 + r)·e^(σ²/2) − 1` (≈ 11.5% at r = 10%, σ = 16.5%) |

## Why

SA fund and index long-run returns are quoted as compound (CAGR) figures, so a user who
types a fund's 10-year return means the typical year, not the arithmetic mean. It also makes
the Risk page easier to explain: half the simulated futures beat the projection, half fall
short. The trade-off is that the simulation is more optimistic than before for the same input.

`calculateEffectiveAnnualReturn` still centres draws on the projection's effective growth
under both compounding methods; unchanged.

## Tests

- `lib/monte-carlo/__tests__/random-returns.test.ts`: the arithmetic-mean check became a
  median check; new tests pin the mean at `(1 + r)·e^(σ²/2) − 1` and a zero shock at exactly `r`;
  the seeded-sequence test drops the drag term.
- `lib/calculations/__tests__/sa-audit-scenarios.test.ts`: under both compounding methods, the
  **median** final balance (4,000 runs) equals the projection within 5% (3σ), and the mean is
  above it (theory: e^(25·0.16²/2) ≈ 1.38×).
- `tests/integration/cross-tab-consistency.test.ts`: the median at retirement is within 20% of
  the projection, and the mean is above it.
- `lib/monte-carlo/__tests__/simulation-engine.test.ts`: the CGT test's hand-computed return
  drops the drag term.

## Golden file

`lib/calculations/__tests__/__golden__/monte-carlo.json` regenerated after review. Every
change is in the expected direction, and no scenario changes ordering:

| Scenario (inside band) | Success before → after |
|---|---|
| mid-career, fixed % / fixed amount | 39.5 / 40 → 56 |
| mid-career, variable % | 87 → 96 |
| mid-career, guardrails | 78.5 → 90.5 |
| underfunded, fixed % / fixed amount | 16.5 → 34 |
| underfunded, variable % | 81 → 92.5 |
| underfunded, guardrails | 68 → 82.5 |

Average final balances rose about 2–3×, consistent with removing e^(n·σ²/2) over 50–60 years.

## Copy

- `components/results/monte-carlo-methodology.tsx`: formula and a plain-English line ("half
  the simulated futures do better than your projection and half do worse").
- `docs/FINANCIAL_LOGIC_REFERENCE.md` §7.
