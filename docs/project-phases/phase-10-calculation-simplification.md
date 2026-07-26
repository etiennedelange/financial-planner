# Phase 10: Calculation Simplification ✅ COMPLETE

**Goal:** Reduce the margin of error in the calculation layer by removing the structural
conditions that allow errors — duplicated logic, untyped money units, and derived metrics
that can contradict the data they are derived from. This phase is about making whole
classes of bug *unrepresentable*, not about fixing individual bugs.

**Origin:** 2026-07-26 multi-agent audit of commit `75f68f7` (see
[history/2026-07-26-audit-batch-1-fixes.md](../history/2026-07-26-audit-batch-1-fixes.md)).
Two of the three P0-class bugs found in the last month were the *same shape* — a
hand-rolled inflation exponent that disagreed with a sibling call site. That recurrence is
what motivates this phase.

**Scope note:** this phase deliberately does **not** change any financial semantics.
Every step must be output-preserving except where a step explicitly reconciles a
divergence, in which case the reconciled value must be justified and recorded. The
shortfall semantics decision of 2026-07-26 (shortfall = portfolio depletes before death)
is settled and is **not** reopened here.

---

## Sequencing constraint (read before starting)

**RESOLVED 2026-07-26.** Steps 3–5 were gated on Phase 1.5 P0, because they refactor a
630-line engine whose suite could not tell you if you broke it. That gate is now lifted:

- Steps 1, 2 and 2.5 are complete.
- Phase 1.5 P0 is complete — the invariant suite was rewritten and verified falsifiable by
  mutation testing (12 injected bugs, 12 killed).
- Both engines are pinned by golden harnesses (96 deterministic + 24 Monte Carlo
  scenarios), each verified to fail on a 0.01% perturbation.

Steps 3–5 may now proceed.

Every step below must be verified with a **golden-output diff**: capture
`calculateProjection` and `runMonteCarloSimulation` output for a fixed matrix of scenarios
before the change, and assert byte-equality after. Where a step is intentionally not
output-preserving, the diff must be reviewed line by line and the delta recorded here.

---

## Step 1: One withdrawal function, not four ✅ DONE

**Why first:** this was not merely duplication — two of the implementations *disagreed*, so
the deterministic projection and the Monte Carlo success rate modelled different plans from
identical inputs.

### State before this step

| Where | Function | Notes |
|---|---|---|
| `lib/calculations/projection-engine.ts:101` | `calculateInitialWithdrawal` | module-private, **not exported** |
| `components/debug/debug-window.tsx:155` | (verbatim copy) | copied *because* the engine's is private |
| `lib/monte-carlo/simulation-engine.ts:40` | `calculateSimulationWithdrawal` | **different semantics** |
| `lib/calculations/utils/drawdown-withdrawal.ts:33` | `calculateNextWithdrawal` | year 1+; optional param changes meaning by caller |

### The divergence (before)

Deterministic engine vs Monte Carlo, same inputs:

| Strategy | `projection-engine.ts` | `simulation-engine.ts` |
|---|---|---|
| `fixed_percentage` | `portfolio × rate` | `max(portfolio × rate, desiredAnnual)` |
| `fixed_amount_inflation_adjusted` | `desiredAnnual` | `desiredAnnual` (agrees) |
| `variable_percentage` | clamped to inflated min/max | bare `desiredAnnual`, **no clamp** |
| `guardrails` | clamped to inflated min/max | bare `desiredAnnual`, **no clamp** |

`calculateNextWithdrawal` adds a fourth behaviour: its optional `desiredMonthlyIncomeToday`
parameter is passed by Monte Carlo (`simulation-engine.ts:203`) and omitted by the
deterministic engine (`projection-engine.ts:429-436`), so the same function returns a pure
percentage-of-portfolio for one caller and `max(percentage, desired)` for the other.

### Not all of the divergence was a bug

`simulation-engine.ts:30-39` documents the `fixed_percentage` difference as deliberate:

> The success rate should reflect whether the user can achieve their desired retirement
> income goal. [...] The strategy affects HOW withdrawals are adjusted over time, but the
> baseline must reflect the user's income goal for the success rate to be meaningful.

This is sound. Forcing Monte Carlo onto the deterministic engine's pure
percentage-of-portfolio would drive the success rate toward 100% for `fixed_percentage`
in all cases — a percentage of a shrinking balance never depletes — destroying the metric.

**The target is therefore not "make them identical." It is "one implementation of the
strategy mathematics, with the difference between callers explicit and named."** The
defect is that the difference is currently expressed as an *omitted optional argument*,
so the same function silently means two things depending on who calls it.

### Target state

A single exported function in `lib/calculations/utils/drawdown-withdrawal.ts`:

- Year 0 is just year *N* with no previous withdrawal — there is no reason for a separate
  "initial" function. Collapse both into one.
- Replace the optional `desiredMonthlyIncomeToday` with a **required, named** baseline
  argument, so both call sites declare their intent:
  - `'strategy'` — pure strategy mathematics (deterministic projection: "what does this
    strategy pay?")
  - `'desiredIncomeFloor'` — strategy mathematics, never below the desired income
    (Monte Carlo: "can the user achieve their goal?")
- Delete the `debug-window.tsx` copy entirely. (Its *use* was already removed on
  2026-07-26; the dead function remains.)

### Genuine bug found while scoping this step

Monte Carlo ignores `minimumWithdrawal` / `maximumWithdrawal` at **year 0** for
`variable_percentage` and `guardrails` (returns a bare `desiredAnnual`), but *does* clamp
them from year 1 onward via `clampToInflatedBounds` in `calculateNextWithdrawal`. Monte
Carlo is therefore inconsistent with itself across the year boundary, which points to an
oversight rather than a design choice — and unlike the `fixed_percentage` case there is no
comment defending it.

Unifying will apply the clamp at year 0. **This is not output-preserving for Monte Carlo**
and must be measured, reviewed and recorded below before it is accepted.

### Outcome (2026-07-26) ✅ DONE

`calculateInitialWithdrawal` now lives once, exported from
`lib/calculations/utils/drawdown-withdrawal.ts`, taking a required `WithdrawalBaseline`
argument. The private copy in `projection-engine.ts`, the diverging
`calculateSimulationWithdrawal` in `simulation-engine.ts`, and the verbatim copy in
`debug-window.tsx` are all deleted. Three implementations → one.

**Deterministic engine: byte-identical.** Golden diff across a 72-scenario matrix
(3 personas × 4 strategies × 3 min/max bands × 2 lump-sum settings) — **0 of 72 changed**.

**Monte Carlo: changed as predicted, only where the year-0 band clamp was missing.**
Measured over 2 000 runs × 3 repeats per cell (MC is unseeded — `randomSeed` is declared
in `SimulationConfig` but never used — so cells are reported as three repeats to make
run-to-run noise visible; noise is ~1–3pp):

| Scenario | Before | After | Δ |
|---|---|---|---|
| `fixed_percentage` (all bands) | 41–45% | 42–44% | ~0 (within noise) ✓ intended |
| `variable_percentage` \| desired-inside-band | 88.9–89.9% | 89.4–90.1% | +0.4pp (noise) |
| `variable_percentage` \| desired-below-min | 10.5–11.4% | 9.5–10.5% | −1.1pp |
| `variable_percentage` \| desired-above-max | 97.5–98.2% | 98.1–98.4% | +0.3pp |
| `guardrails` \| desired-below-min | 10.1–11.7% | 9.4–10.9% | −1.2pp |
| `guardrails` \| desired-above-max | 93.2–94.3% | 95.8–96.4% | **+2.4pp** (ranges disjoint) |

Interpretation, and why this is the correct direction:

- `fixed_percentage` is unchanged because `'desiredIncomeFloor'` reproduces the old
  `max(target, desired)` exactly — the deliberate design documented at
  `simulation-engine.ts:30-39` is preserved.
- `desired-below-min` falls because clamping *up* to the floor raises the withdrawal.
- `desired-above-max` rises because clamping *down* to the ceiling lowers it.
- `guardrails` moves most because it anchors each year to the previous withdrawal, so a
  year-0 correction propagates across the whole horizon; `variable_percentage` re-clamps
  every year anyway, so its year-0 correction washes out. This asymmetry is itself
  evidence the mechanism is understood rather than coincidental.

**Accepted:** Monte Carlo now honours the user's `minimumWithdrawal` / `maximumWithdrawal`
at year 0, matching what it already did from year 1 onward.

### Success criteria

- [x] One exported withdrawal function; three duplicate implementations deleted
- [x] `debug-window.tsx` has no local calculation logic
- [x] The deterministic/Monte Carlo difference is explicit and named
      (`WithdrawalBaseline`) rather than an omitted optional argument
- [x] Golden-output diff reviewed; Monte Carlo delta explained and recorded above
- [x] Prior duplication guard extended in CLAUDE.md — generalised from "don't duplicate
      `projectFinalSavings`" to "never copy calculation logic, export it", plus guards
      against UI-owned calculation logic and semantics-changing optional parameters

### Tooling note — resolved in Step 2

The scratch harness used for Step 1 has been replaced by a committed one:
`lib/calculations/__tests__/golden-projection.test.ts`, pinning 96 scenarios against
`__tests__/__golden__/projection.json` with real assertions that name the offending
scenario on failure. Regenerate deliberately with `UPDATE_GOLDEN=1`, only after reviewing
the diff.

It was verified to be *sensitive*, not merely present: perturbing a live return by 0.01%
fails it. (Perturbing `projection-engine.ts:164` does **not** — that `netReturn` local is
dead code, never read; the engine uses the per-account value built at `:311`. Worth
deleting during Step 3.)

Monte Carlo remains excluded because it is unseeded — see "Known issue" below.

---

## Step 2: Make money units impossible to mix ✅ DONE

**Why:** the highest-leverage change for margin of error. Both recent P0 bugs were this
class:

- 2026-07-26 — replacement ratio divided a nominal at-retirement rand by a present-day
  rand (5× overstatement)
- 2026-07-11 — `inflationAdjustedWithdrawal` used `^year` instead of
  `^(yearsToRetirement + year)`

### Current state

21 hand-rolled `Math.pow(1 + inflation…, …)` expressions across 10 files, using five
different exponent expressions: `yearsToRetirement`, `yearsToRetirement + year`,
`yearsSinceToday`, `yearsFromNow`, `drawdownYear`.

The **rate unit is also inconsistent**: `components/dashboard/key-insights-summary.tsx:43`
and `components/inputs/retirement-goals-form.tsx:83` pass `inflationRate / 100`, while
everything under `lib/` passes a pre-divided decimal. The same expression therefore takes
its argument in two different units depending on the file.

### Target state

Preferred — branded types so the mistake cannot compile:

```ts
type Rands<Basis extends 'today' | 'atRetirement' | `year${number}`> = number & { __basis: Basis }
```

`initialWithdrawalAnnual / annualIncome` then fails to type-check unless both share a basis.

Cheaper 80% if branding proves too invasive: a single `lib/calculations/utils/money-time.ts`
exporting `escalate(amount, years, rate)` / `deflate(amount, years, rate)` / `atYear(...)`,
plus an ESLint rule banning raw `Math.pow(1 + inflation` outside that module. Even
untyped, one reviewable place beats 21.

Normalise the rate unit at the store boundary: convert percent → decimal once, and never
divide by 100 again below the UI layer.

### Outcome (2026-07-26) ✅ DONE

**Golden-output diff byte-identical** across all 96 scenarios — this step changed no
financial behaviour whatsoever.

Delivered:

1. **`lib/calculations/utils/money-time.ts`** — `escalate()`, `deflate()`,
   `inflationFactor()`, `percentToRate()`, plus basis-tagged `Rands<B>` types and
   `todayRands` / `retirementRands` / `escalateToRetirement` / `deflateToToday`.
   All guard non-finite input: a broken rate returns the amount unchanged rather than
   poisoning it, and `deflate` returns 0 instead of `Infinity` when the growth factor
   collapses to zero.
2. **All 25 call sites migrated.** Zero raw inflation exponentiations remain in
   production code.
3. **ESLint rule** (`no-restricted-syntax`, two AST selectors) blocking
   `Math.pow(1 + …inflation…, n)` and `(1 + …inflation…) ** n` outside `money-time.ts`.
   Verified by injecting a violation and confirming it errors.
4. **Rate units normalised.** `key-insights-summary.tsx` and `retirement-goals-form.tsx`
   were passing a *percentage* into the exponent while everything under `lib/` passed a
   decimal; both now go through `percentToRate()`.
5. **Compile-time enforcement of the original bug.**
   `calculateReplacementRatio<B extends MoneyBasis>(Rands<B>, Rands<B>)` now rejects the
   exact mistake shipped in `75f68f7`. Pinned by
   `lib/calculations/__tests__/money-basis.type-test.ts`, a compile-time-only test.

   Note for future maintainers: the brand is deliberately **invariant** —
   `{ readonly [BASIS]: (basis: B) => B }`, not `{ readonly [BASIS]: B }`. A covariant
   brand lets TypeScript infer `B` as the whole `MoneyBasis` union, so both bases satisfy
   it and the mismatch compiles happily. That was the first attempt and it silently did
   nothing.

**The lint rule immediately found 4 sites the manual audit missed.** `medical-costs.ts`
uses `medicalInflation` / `generalInflation`, which the original `Math.pow(1 + inflation`
grep did not match. The count was never 21 — it was 25.

**Tests are deliberately exempt from the lint rule.** A test verifying the engine's
escalation must compute its expected value independently; calling the same `escalate()`
the engine calls would make a bug inside `escalate()` invisible and reduce the test to a
restatement of the implementation — the exact Phase 1.5 failure mode. Hand-rolled
arithmetic in a test is an independent oracle, not a smell.

### Success criteria

- [x] Zero raw inflation exponentiations outside `money-time.ts` (production code)
- [x] Lint rule enforcing it, verified to fire
- [x] Rate unit normalised at the boundary; no `/ 100` below the component layer
- [x] Golden-output diff byte-identical
- [x] Bonus: replacement-ratio bug now unrepresentable at compile time

---

## Step 2.5: Seed Monte Carlo ✅ DONE

**Why:** `SimulationConfig.randomSeed` was declared in `types/simulation.ts` but never read
by the engine. That single gap caused three separate problems — a flaky integration test, a
Monte Carlo engine that could not be pinned by the golden harness, and a Step 1 verification
that had to tease a real semantic change out of ~1-3pp of sampling noise across 2000-run
repeats.

**Implementation.** Monte Carlo had exactly one randomness entry point
(`simulation-engine.ts`, the `generateReturnSequence` call), which made this clean:

- `createSeededRandom(seed)` in `random-returns.ts` — mulberry32; tiny, dependency-free,
  period 2^32. Explicitly **not** cryptographically secure.
- `randomNormal` and `generateReturnSequence` take an optional `RandomSource`, defaulting
  to `Math.random`, so unseeded behaviour is byte-for-byte unchanged.
- `runMonteCarloSimulation` builds a seeded source when `config.randomSeed` is supplied and
  threads it through every run. One generator across all runs, so runs stay independent of
  one another while the sequence as a whole is reproducible.

**Results:**

| | Before | After |
|---|---|---|
| Full-suite flakiness | 1 failure in 12 runs | **0 in 20** |
| Monte Carlo in golden harness | impossible | **24 scenarios pinned** |
| MC verification method | statistical, 3 repeats × 2000 runs | exact equality |

`lib/calculations/__tests__/golden-monte-carlo.test.ts` pins 24 scenarios against
`__golden__/monte-carlo.json`, and asserts reproducibility as a precondition before
comparing — a golden file is meaningless if the generator is not deterministic. Verified
sensitive: perturbing volatility by 0.01% fails it.

**Two latent test bugs found and fixed while doing this:**

1. `simulation-engine.test.ts` had a `vi.spyOn(Math, 'random')` restored by an **inline**
   `mockRestore()` at the end of the test body. When that test failed, cleanup was skipped
   and `Math.random` stayed mocked for every subsequent test in the file — which is exactly
   how it presented: one genuine failure cascaded into a second, unrelated one. Now
   restored via `afterEach(() => vi.restoreAllMocks())`.
2. The CGT-exclusion test drives `Math.random` itself via that spy to build a hand-computed
   oracle, so it is deliberately left **unseeded** — seeding it would make the engine bypass
   the spy and invalidate the oracle. Same principle as the lint-rule exemption in Step 2:
   a test's independent arithmetic is an oracle, not a smell.

**Note on assertion design.** An initial reproducibility test asserted that a seeded run
produced ~100 distinct final balances; it saw 38 and failed. The code was right and the
assertion was wrong: 63 of 100 runs deplete and are clamped to exactly 0 by `Math.max(0, …)`,
collapsing into a single value. It now asserts on an accumulation-phase balance, which is
unclamped and therefore measures independence rather than the clamp — 100 of 100 distinct.

### Success criteria

- [x] `randomSeed` wired through and honoured
- [x] Same seed ⇒ identical output; different seed ⇒ different output; no seed ⇒ unchanged
- [x] Flaky integration test fixed (0 failures in 20 full-suite runs)
- [x] Monte Carlo covered by a committed golden harness, verified sensitive
- [x] Runs remain independent within a seeded simulation

---

## Step 3: Split `calculateProjection` into two phases ✅ DONE

**Was:** one 630-line function with two loops sharing mutable locals (`totalBalance`,
`annualWithdrawal`, `portfolioDepletionAge`), so accumulation-phase state could leak into
drawdown.

**Now:** `runAccumulationPhase()` and `runDrawdownPhase()`, each returning an explicit
typed result (`AccumulationResult` / `DrawdownResult`). `calculateProjection` orchestrates:
accumulate → commute the lump sum → draw down → aggregate. Both phases are exported so
they can be tested directly.

**Golden diff byte-identical** across all 96 deterministic + 24 Monte Carlo scenarios.
Done in three verified stages (dead code → accumulation → drawdown), checking the golden
harness after each so any breakage was localised.

### Dead code removed

The `netReturn` local flagged during Step 2 turned out to be the tip of a larger block.
`totalContribution`, `weightedReturn`, `weightedFees`, `avgEscalation` and `netReturn` were
all computed and never read — leftovers from an earlier design that averaged the portfolio
before the engine began projecting each account individually. Their only consumers were
each other, which in turn orphaned three helper functions (`calculateWeightedReturn`,
`calculateWeightedFees`, `calculateAverageEscalation`). **71 lines deleted**, golden
byte-identical.

### Phase-boundary contract tests

`projection-phases.test.ts` pins the boundary directly — impossible before the split:

- accumulation never records a withdrawal, income tax or net income (the single strongest
  guard against the phases bleeding into each other)
- accumulation is pure: two calls are equal, and it does not mutate the caller's accounts
- `portfolioAtRetirement` equals the sum of the per-account balances it returns
- drawdown never records a contribution, and its totals reconcile with its own rows

### Coverage

`projection-engine.ts`: **100% statements, 100% branches, 100% functions** (was
96.72 / 96.05 / 88.57).

### Mutation testing found a real, untested code path

Five mutations were injected at the phase boundary; four were killed immediately. The
survivor was instructive: deleting the **start-of-year** depletion-age assignment left the
entire 673-test suite green, while deleting the post-withdrawal one (added 2026-07-26) was
caught at once.

Investigation showed this was **not** an equivalent mutant. Exhausting a portfolio mid-year
always clamps that year's withdrawal, so the post-withdrawal check fires first — except in
one case it structurally cannot: a portfolio that arrives at retirement already empty. That
year opens at zero, the loop emits a zeroed row and `continue`s, and the post-withdrawal
check never runs. Verified reachable (a zero-balance account correctly reports
`depletionAge: 65`), then covered. The mutant now dies.

Worth recording as a pattern: a surviving mutant is either an equivalent mutant or a
genuine coverage gap, and the difference is only established by tracing the path — not by
assuming.

## Step 4: Derive summary metrics instead of computing them inline ✅ DONE

**Golden diff byte-identical** across all 96 deterministic + 24 Monte Carlo scenarios —
which is the proof that no semantics changed.

`selectAverageEffectiveTaxRate`, `selectMonthlyNetIncomeAtRetirement`,
`selectRawIncomeGap`, `selectSurplusAmount` and `selectShortfallAmount` are now named,
exported selectors instead of ~40 lines of arithmetic inlined at the end of
`calculateProjection`. The orchestrator's final phase reads as five named derivations.

### Shortfall semantics deliberately untouched

Deriving the metrics as selectors necessarily *moves* the shortfall computation, and the
rule that a surviving portfolio reports no shortfall is a settled product decision
(shortfall = "the money ran out before I died", not "cumulative income gap").

That rule is reproduced **exactly** in `selectShortfallAmount`, with the reasoning recorded
at the function and at the top of the selector block so it reads as a decision rather than
an accident. The split into `selectRawIncomeGap` (the raw arithmetic) and
`selectShortfallAmount` (the survival rule applied to it) makes the two separable *if* the
labelling question is ever revisited — without changing anything today.

### Testability, which was the point

`projection-selectors.test.ts` drives each selector directly with the exact row shapes that
matter, including boundaries a full projection rarely reaches: no drawdown row at the
retirement index, an over-withdrawal that must not offset a shortfall elsewhere,
accumulation rows that must not count as gaps, and a surplus of exactly zero.

### Verified by mutation testing — 6 of 6 killed

| Mutation | Result |
|---|---|
| tax rate: drop the x100 | killed |
| net income: forget the /12 | killed |
| income gap: let negative gaps offset positives | killed |
| income gap: stop escalating the target each year | killed |
| shortfall: invert the survival rule | killed |
| surplus: drop the zero floor | killed |

---

## Step 5: Stop clamping errors away ✅ DONE

**Golden diff byte-identical** across all 96 deterministic + 24 Monte Carlo scenarios.

### What the problem actually was

`Math.max(0, …)` on `endingBalance` and per-account balances protects rendering, but on its
own it also *hides* a defect: if the engine's arithmetic ever produced a negative balance,
the clamp would quietly turn it into 0. Two of the old invariant tests were unfalsifiable
for precisely this reason — they asserted `endingBalance >= 0`, which the clamp guarantees
regardless of whether the logic is correct.

### Evidence first

Before changing anything, the engine was instrumented to record any *pre-clamp* negative
across **360 scenario combinations** (5 opening balances x 3 contribution levels x
4 strategies x 2 lump-sum settings x 3 income targets). Result: **zero occurrences**. The
clamps are pure insurance today, which is what made this change safe and output-preserving.

### Deviation from the original plan — deliberate

The plan for this step said "clamping retained only at the display layer", i.e. let the
engine emit negative values and clamp downstream. **That was not done, on purpose.**

Making `YearlyProjection.endingBalance` negative-capable changes the data contract for
every consumer — charts, tables, CSV export, the debug window — and would need each to
handle a state that cannot legitimately occur. It buys no additional detection: once a
guard raises *before* the clamp, the clamp is no longer hiding anything.

So: **the clamp stays, and a guard runs first.**

### Implementation

`lib/calculations/utils/invariant-guards.ts` — `assertNonNegativeBalance(value, context)`
throws with the offending value and its location (`"account acc-1 at age 82"`). Wired into
both clamp sites in the drawdown loop.

Two deliberate non-throws, each with a reason:
- **`NaN`** passes through. NaN is a distinct defect with its own guards (`money-time.ts`,
  `calculateReplacementRatio`); reporting it as a negative balance would send whoever is
  debugging down the wrong path.
- **`-0`** passes through. It arises from ordinary float arithmetic and means zero.
  (`value < 0` is false for both, which is why the check is written that way.)

### Verified by mutation testing

| Mutation | Detected by | Notes |
|---|---|---|
| Remove per-account `Math.min(remaining, acc.balance)` cap | **guard fired** | account over-drawn -> negative balance |
| Remove `Math.min(desired, currentTotal)` withdrawal cap | **golden harness** | guard correctly silent — this changes withdrawal *amounts* without producing a negative balance |

The second row is the important one: the guard staying quiet there is correct scoping, not
a gap. Both defects are caught, each by the appropriate mechanism.

## Explicitly out of scope

- **Shortfall semantics.** Settled 2026-07-26: shortfall = the portfolio depletes before
  death. Not reopened.
- **The desired-income labelling question.** On `fixed_percentage`, `variable_percentage`
  and `guardrails` the engine ignores the entered desired income after year 0, so those
  strategies report no shortfall while paying less than the figure the user typed. This is
  a UX/labelling decision, tracked separately, not a calculation defect.
- **Gross vs net replacement ratio.** ~6pp conservative understatement from the SA over-65
  rebates. Logged in the audit history, not actioned.
