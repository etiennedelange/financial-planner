# 2026-07-26 — Phase 10: Calculation Simplification (complete)

Companion to [2026-07-26-audit-batch-1-fixes.md](2026-07-26-audit-batch-1-fixes.md), which
covers the audit that started the session. This document records the architectural changes.

**Outcome:** 585 → 698 tests, all deterministic. Type errors 44 → 0. Both engines pinned by
committed golden harnesses. `projection-engine.ts` at 100% statements/branches/functions.

---

## The thread running through all of it

Every defect this session had the same shape: **something that looked like protection but
wasn't**.

- Tests that passed while asserting nothing (`if (surplus > 0) expect(shortfall).toBe(0)`
  restating the implementation).
- 100% line coverage on a file with a live regression.
- A clamp (`Math.max(0, …)`) that would hide a negative balance rather than surface it.
- Type-checked fixtures that weren't — `next build` skips test files, so 44 errors
  accumulated while CI stayed green.
- A `randomSeed` field declared in the type and never read.

The countermeasure adopted throughout was **mutation testing**: injecting a deliberate bug
and confirming something fails. It caught things a passing suite could not, twice finding
real gaps (an untested depletion path, and a fix applied to the wrong surface).

---

## What changed

### One withdrawal function, not four

`calculateInitialWithdrawal` existed three times — privately in `projection-engine.ts`,
copied verbatim into `debug-window.tsx`, and as `calculateSimulationWithdrawal` in
`simulation-engine.ts` **with different semantics**. The deterministic projection and the
Monte Carlo success rate therefore modelled different plans from identical inputs.

Now exported once from `lib/calculations/utils/drawdown-withdrawal.ts` with a required
`WithdrawalBaseline` argument (`'strategy'` | `'desiredIncomeFloor'`). The difference
between the two engines is real and documented — a success rate measured against a
percentage-of-portfolio withdrawal would approach 100% and be meaningless — so it is now
**named** rather than expressed as an omitted optional parameter.

Behaviour change: Monte Carlo now honours `minimumWithdrawal`/`maximumWithdrawal` at year 0,
matching what it already did from year 1. `guardrails | desired-above-max` success rate
moved 93.2-94.3% → 95.8-96.4%.

### Money units cannot be mixed

25 hand-rolled `Math.pow(1 + inflation, n)` expressions across 10 files, using five
different exponent expressions, and two components passing a *percentage* where everything
in `lib/` passed a decimal. Both recent P0 bugs were a wrong exponent.

All now route through `lib/calculations/utils/money-time.ts`, enforced by an ESLint rule.
`calculateReplacementRatio<B>(Rands<B>, Rands<B>)` makes the shipped bug a **compile error**.

The brand is deliberately **invariant** (`{ readonly [BASIS]: (basis: B) => B }`). A
covariant brand lets TypeScript infer `B` as the whole union, so both bases satisfy it and
the mismatch compiles silently — that was the first attempt and it did nothing.

Tests are deliberately **exempt** from the lint rule: a test verifying the engine's
escalation must compute its expected value independently, or a bug inside `escalate()`
becomes invisible.

### Monte Carlo seeded

`SimulationConfig.randomSeed` was declared and never read. Wiring it (mulberry32, one
generator threaded through all runs) fixed three things at once: suite flakiness (1-in-12 →
0-in-20), Monte Carlo's exclusion from the golden harness, and the need to verify MC changes
statistically rather than exactly.

### Engine split into phases

`calculateProjection` was 630 lines with two loops sharing mutable locals. Now
`runAccumulationPhase()` and `runDrawdownPhase()`, each returning an explicit typed result,
plus five named selectors deriving the summary metrics from `yearlyProjections`.

71 lines of dead code removed along the way — `totalContribution`, `weightedReturn`,
`weightedFees`, `avgEscalation`, `netReturn` and three helper functions, all leftovers from
an earlier design that averaged the portfolio before the engine began projecting each
account individually.

### Negative-balance guard

Evidence first: instrumented across 360 scenario combinations, **zero** pre-clamp negatives.

**Deviation from plan, deliberate:** the plan said clamp only at the display layer. That
would make `YearlyProjection.endingBalance` negative-capable and ripple into every consumer
for a state that cannot legitimately occur — and buys nothing once a guard raises *before*
the clamp. So the clamp stays and `assertNonNegativeBalance` runs first.

---

## Settled: shortfall semantics

**Shortfall means the portfolio depletes before death**, not cumulative income gap. The
audit's C1 magnitudes (R91.2m) measure a different metric than this project wants.

Knowingly accepted: `fixed_percentage`, `variable_percentage` and `guardrails` withdraw a
percentage of the live balance and ignore the entered desired income after year 0, so they
rarely deplete and correctly report no shortfall while paying materially less than asked.
Measured: R93,948/month desired vs R52,657/month actual → shortfall R0, surplus R63.0m.

Step 4 preserved this exactly, splitting `selectRawIncomeGap` (arithmetic) from
`selectShortfallAmount` (the survival rule) so the two are separable *if* the labelling
question is revisited — without changing anything today.

---

## Open

- **Labelling** — on three of four strategies the desired-income input is decorative after
  year 0. "Shortfall R0" reads as "goal met" when the goal was never attempted. UX decision.
- **Store branch coverage** — 72.5% / 76.31% against the 85% threshold (Phase 1.5 P1).
- **One unexplained test failure** during Step 4, not reproduced in 24 subsequent runs and
  never captured. Most plausibly a transient from the dev server watching files during a
  rewrite — recorded rather than dismissed.

## How to verify any future change here

```bash
npm run test           # 698 tests
npm run typecheck      # REQUIRED — next build does not typecheck test files
npm run build
npm run lint

# Golden harnesses — regenerate ONLY after reviewing the diff:
UPDATE_GOLDEN=1 npx vitest run lib/calculations/__tests__/golden-projection.test.ts
UPDATE_GOLDEN=1 npx vitest run lib/calculations/__tests__/golden-monte-carlo.test.ts
```
