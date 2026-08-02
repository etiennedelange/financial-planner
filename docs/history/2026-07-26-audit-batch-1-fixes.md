# 2026-07-26 — Multi-Agent Audit of `75f68f7` + Batch 1 Fixes

Scope of the audit: commit `75f68f7` ("enhance replacement ratio calculations and add
invariant tests for projection logic") on `feature/redesign`. Auditors run:
`mathematics-auditor`, `sa-retirement-calc-validator`, `edge-case-hunter`,
`tax-auditor`, then `devil-advocate` as a contrarian pass over their findings.

## What was fixed (Batch 1)

All three changes below are independent of the outstanding shortfall-semantics
decision (see "Deferred" below). 609/609 tests pass; production build clean.

### 1. Replacement ratio divided future rands by today's rands — FIXED
`components/debug/debug-window.tsx`

`initialWithdrawalAnnual` is nominal at the retirement date; `personalInfo.annualIncome`
is a present-day salary. Dividing one by the other overstated the ratio by exactly
`(1 + inflation)^yearsToRetirement`.

- Default scenario (35 → 65, 5.5% inflation): displayed **150.4%**, true **30.2%** — a 4.98x overstatement.
- Fix: escalate the salary to the retirement date before dividing.
- Verified two ways (escalate denominator vs. deflate numerator); both yield 30.2%.

The engine already established this convention — `projection-engine.ts` escalates the
same field by inflation for the s11F deduction.

### 2. Debug window promised income from already-commuted capital — FIXED
`components/debug/debug-window.tsx`

The window computed its own initial withdrawal from the **pre-commutation** portfolio
via a duplicated local helper, while the engine uses the post-commutation
`remainingPortfolio`. With a 30% lump sum this promised income out of capital the
retiree had already withdrawn and paid lump-sum tax on — three screens showed
97.0% / 67.9% / 44% for one scenario.

- Fix: prefer `projection.monthlyIncomeAtRetirement * 12` (engine-derived, post-commutation).
- The local helper is retained **only** as a fallback for when no projection exists yet.

### 3. `calculateReplacementRatio` leaked NaN into the UI — FIXED
`lib/calculations/retirement-tax.ts`

The guard was `if (preRetirementIncome <= 0) return 0`. `NaN <= 0` evaluates to `false`,
so NaN passed straight through and rendered as the literal string `"NaN%"` at three
call sites.

- Fix: `Number.isFinite` checks on **both** arguments.
- Tests added under `calculateReplacementRatio > Non-finite inputs` (TDD: 4 failing tests first).
- Coverage on `retirement-tax.ts`: 92.85% stmts / 93.87% branch — above the 90% bar.

Stale JSDoc on the function was also corrected: it claimed the numerator was "after tax"
while the body does a gross-to-gross division. It now documents the same-money-basis
requirement explicitly.

### 4. Depletion during the final year was never recorded — FIXED
`lib/calculations/projection-engine.ts`

The depletion guard runs at the **start** of each drawdown year. A portfolio that
empties *during* the final year was therefore never observed — there is no subsequent
iteration. The engine emitted contradictory output: `endingBalance: 0`,
`surplusAmount: 0`, `shortfallAmount: R6,009,722` and `portfolioDepletionAge: null`
simultaneously — "you ran out" and "you never ran out" at once.

Fix: a second check after the withdrawal, gated on the withdrawal having been **clamped**
by the available balance. The clamp matters — a retiree who draws full income every year
and lands on exactly R0 at life expectancy has a perfectly funded plan, not a depletion,
and must not be flagged.

Verified on the fixture above (55 → 65 → 90, R4.5m preservation fund, R55k/month desired,
`fixed_amount_inflation_adjusted`):

| Field | Before | After |
|---|---|---|
| `portfolioDepletionAge` | `null` | **89** |
| `shortfallAmount` | R6,009,722 | R6,009,722 (unchanged) |
| `surplusAmount` | R0 | R0 (unchanged) |

`fixed_percentage` on the same inputs is entirely unchanged. Coverage on
`projection-engine.ts`: 96.39% stmts / 95.06% branch.

## Product decision taken (2026-07-26)

**`shortfallAmount` semantics are settled and the logic is not to be changed.**

The owner's definition: *you enter the income you want to retire on (e.g. R30k/month);
if the portfolio depletes before you die, that is a shortfall.* Under that definition the
guard at `projection-engine.ts:585` broadly implements the intent, and much of the audit's
C1 finding does not apply — its "true shortfall" magnitudes (R91.2m etc.) are cumulative
*income gap*, a different metric from the one this project wants.

Consequence accepted knowingly: for `fixed_percentage`, `variable_percentage` and
`guardrails`, the engine withdraws a percentage of the live balance and does not attempt
to pay the desired income after year 0 (`projection-engine.ts:429-436` omits
`desiredMonthlyIncomeToday`, so `drawdown-withdrawal.ts:46` returns a pure
percentage-of-portfolio). Those strategies therefore rarely deplete and correctly report
no shortfall — while paying materially less than the entered figure. Measured example:
R93,948/month desired vs R52,657/month actual, reported as shortfall R0, surplus R63.0m.
This is a labelling/UX question, not a calculation defect, and is deliberately left open.

## Deferred — not actioned

### `shortfallAmount` suppression (CRITICAL per audit, WON'T FIX — see decision above)
`lib/calculations/projection-engine.ts:585` — `finalSurplus > 0 ? 0 : shortfallAmount`

`shortfallAmount` is a flow (cumulative unmet spending); `finalBalance` is a stock at one
instant. A positive stock at T does not imply zero flow deficit over [0,T).

Under `fixed_percentage`, `B(t+1) = 0.96·B(t)·(1+r)` is geometric and strictly positive,
so the terminal balance is *always* positive and the shortfall is *always* zeroed.
Measured: `fixed_percentage` R0 vs true R91,235,766; `guardrails` R0 vs true R64,357,244;
`variable_percentage` R0 vs true R64,357,244. Only `fixed_amount_inflation_adjusted` still
reports a shortfall.

**This is a regression of the P0 fix recorded on 2026-07-11** ("`shortfallAmount`
structurally-zero bug"), reintroduced by a different mechanism.

Two contributing defects must be fixed together — deleting the guard alone makes it worse:

1. **Phantom shortfall (the legitimate bug the guard was working around).**
   `projection-engine.ts:441` applies `getSpendingPhaseMultiplier` (0.8 in retirement
   years 16–25) to actual withdrawals, but the shortfall sum at `:577-579` compares them
   against the **un-multiplied** desired income — manufacturing a ~20% shortfall for nine
   years on a fully funded plan.
2. **Strategy decoupling.** `projection-engine.ts:429-436` calls `calculateNextWithdrawal`
   without `desiredMonthlyIncomeToday`, so `drawdown-withdrawal.ts:46` returns a pure
   percentage-of-balance. Three of four strategies are structurally decoupled from desired
   income after year 0; comparing them against an escalating target produces a large gap
   by construction.

**Open decision:** when a retiree on `fixed_percentage` receives R997/month against a
R30,000 goal but never runs out of money — is that a shortfall? If yes, one metric. If no,
split into `underspendAmount` (strategy delivers less than wanted) and `depletionShortfall`
(ran out of money). Never derive one from the other's sign.

Note: `simulation-engine.ts` *does* pass `desiredMonthlyIncomeToday`, so Monte Carlo may
already answer this differently. Read it before deciding.

### Test suite cannot catch this class of regression (HIGH, unfixed)
`projection-engine.test.ts` previously asserted `expect(shortfallAmount).toBeGreaterThan(0)`
on the R10,000-balance fixture and passed. Commit `75f68f7` rewrote it into
`if (surplus > 0) expect(shortfall).toBe(0)` — a verbatim restatement of line 585 that
cannot fail while that line exists. **The test that would have caught the regression was
retired by the change it should have blocked.**

New invariants are largely non-functional: INV-001/003 assert the guard against itself;
INV-002/006 have unreachable bodies (0 assertions execute) and `expect(null).toBeDefined()`
passes on the engine's no-depletion sentinel; INV-005/008 are masked by `Math.max(0, …)`
at `:522`; INV-017 tests a field that is identically zero everywhere; INV-009 recomputes
the implementation in the test body; INV-004's `2×` bound is an invented constant that
fails on a sound projection when `lifeExpectancy` is raised to 110.

Recommendation: several of these should be **deleted rather than repaired** — they inflate
19 tests into roughly 4 real checks, which is worse than having 4.

### Gross-vs-net replacement ratio (MEDIUM, accepted for now)
Gross-to-gross understates the true net-to-net ratio by ~6pp, because SA retirees receive
the secondary (R9,765) and tertiary (R3,249) rebates that working-age taxpayers do not.
Direction is conservative and it is swamped by the (now-fixed) nominal/real error. Fixing
properly means threading `age` through the function. Logged, not actioned.

## Verified clean

`tax-auditor` validated `lib/constants/tax-year.config.ts` against the SARS Budget 2026 Tax
Guide PDF: `TAX_YEAR = '2026/2027'` is current, all seven brackets, rebates, thresholds,
lump-sum table, s11F cap, TFSA limit and medical credits match, and every `baseTax` recomputes
consistently. Removing the hardcoded `0.75` effective-rate assumption was a genuine improvement.

## Not audited

Monte Carlo methodology, two-pot component modelling, CGT on discretionary, and the other
113 commits on `feature/redesign` (audit was deliberately scoped to `75f68f7`).
