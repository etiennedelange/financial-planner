---
type: History Entry
title: "2026-11-01 — Multi-agent audit fixes: on-track definition, headline income, MC bias, withdrawal order, s11F carry-forward"
description: "Five issues from an 8-agent audit of the SA calculation branch fixed with tests; withdrawal-order trade-off measured; main vs branch compared on the user's exact plan."
date: 2026-11-01
tags: [calculations, monte-carlo, tax, audit]
---

# 2026-11-01 — Multi-agent audit fixes

The `audit` skill ran seven specialist agents (mathematics, SA validation, edge cases, tax,
financial assumptions, software, design system) plus a contrarian pass over the uncommitted
work from [2026-10-31](2026-10-31-sa-retirement-calc-audit.md) and
[the Risk page](2026-10-31-risk-page.md). The verdict was "not safe to merge" because of the
five issues below. Every 2026/27 and 2016/17 SARS figure was confirmed. About 30,000 fuzzed
plans produced no NaN or negative balances within UI input ranges.

## Fixes

| # | Issue (found by) | Fix |
|---|---|---|
| 1 | Overview said "On Track" for every default plan: a fixed-percentage strategy never depletes, so a plan paying ~10% of its goal showed "On Track: Yes / Age 90+". This regressed when the Monte Carlo success rate left Overview (financial auditor) | New `incomeGoalShortfallAge` (`selectIncomeGoalShortfallAge`): the first age the income paid is below the goal (desired income escalated × spending multiplier). Used by Key Insights, the "Goal Income Until" card, the what-if readout, the printed verdict and the AI narrative (schema field optional for older clients) |
| 2 | The headline gross income was the strategy target, not what the living annuity band pays. A R1M pension showed R30k/month while only R14,583 is legal, and net could exceed gross (SA validator, contrarian) | `selectMonthlyGrossIncomeAtRetirement` reads the first drawdown row, like net income |
| 3 | Monte Carlo under the default `nominal` method converted each random annual return with R/12, which is convex: mean growth was 12.1% against the projection's 10.47% (μ=10%, σ=16%). Already present in accumulation; the 2026-10-31 drawdown change spread it into retirement (mathematics auditor) | Returns are centred on `calculateEffectiveAnnualReturn` and converted geometrically. The simulated mean now equals the projection under both methods; a test catches the old behaviour (ratio 1.42 vs ≤1.05) |
| 4 | The withdrawal order spent the TFSA second: it wasted the tax-free threshold and emptied the reserve before the 17.5% ceiling bound (financial auditor, contrarian) | Order: 2.5% minimum → annuity up to the tax-free room (age threshold × scale + unused s11F credit) → discretionary → annuity to 17.5% → TFSA last. `runDrawdownYear` takes `pensionTaxFreeRoom` as a required argument |
| 5 | s11F excess was summed year by year, so later unused room never absorbed it; indexing the cap made this material (tax auditor and SA validator, independently) | Carry-forward: `credit = excess(credit + contributions − limit)` each year (s11F(3)) |

### The withdrawal order is a trade-off

Measured with every other fix applied, 3 × 1,000 seeded Monte Carlo runs per cell:

| Plan | Order | MC success | Lifetime net income (today's R) | Left at 90 (today's R) |
|---|---|---|---|---|
| Golden mid-career | old (TFSA 2nd) | 44.4% | 8.31M | 8.91M |
| | B (TFSA before step 4) | 44.8% | 8.49M | 9.26M |
| | **A (TFSA last, shipped)** | **49.1%** | 7.64M | 8.95M (3.72M in TFSA) |
| Golden underfunded | old / B / A | 25.4 / 26.0 / **29.2%** | 8.68 / 8.79 / **9.48M** | goal short at 85 / 86 / **never** |
| User's plan | old / B / A | 70.0 / 70.0 / **73.5%** | 4.33 / 4.32 / 4.19M | 19.80 / 19.81 / 19.91M |

Order A is the most robust in every case, and it fixes the underfunded plan. For comfortably
funded plans it leaves the TFSA idle while taxed annuity income is drawn: 2–10% less
lifetime net income than B. A is shipped because protecting plans at risk matters most. B is
the documented alternative. The engine also does not tax a living annuity left at death,
which flatters order B.

## main vs this branch: the user's exact plan

Inputs are from the user's debug report:
- Age 39, retiring at 65, life expectancy 90, R1.1M income.
- R35k/month goal, 5.5% inflation, fixed inflation-adjusted strategy, R3,500/month medical aid.
- Accounts: RA R165k (+R5k/m, 10% escalation, 1.9% fees); pension fund R1.75M (+R15k/m, 5%,
  1.5%); TFSA R80k (+R3k/m, 6%, 1.8%). All at 10.5% expected return.
- Compound method, equity volatility 16.5%.

Monte Carlo figures are 5 seeds × 1,000 runs in both trees.

| | main | branch (historical relief) |
|---|---|---|
| Portfolio at 65 | R65.01M | R65.01M |
| Gross / net income per month at 65 | R140,810 / R107,912 | R140,810 / R107,912 |
| First-year tax | R0 (TFSA paid all R1.69M) | R0 (annuity paid; s11F credit) |
| s11F credit at 65 | R6.06M | R2.75M (carry-forward + indexed cap) |
| Lifetime income tax (nominal) | R26.07M, 33.7% average | R24.08M, 27.3% average |
| Net income per month at 89, today's R | **−R1,268** | R7,860 |
| Money runs out / income below goal | never / — | never / never |
| Left at 90, today's R | R21.89M | R19.91M |
| Monte Carlo success | 91.9% | 73.7% |
| MC median first-short age | 84–85 | 79–80 |

Tax relief sensitivity on the branch (lifetime tax / net at 89, today's R): full R12.12M /
R14,077; historical R24.08M / R7,860; none R32.29M / R3,896. Under `nominal`: main 96.1% vs
branch 78.0% success.

Notes on the table:
- `main`'s net income at 89 is negative. Unindexed tax plus medical aid exceed the gross income.
- The branch's late-life net income is low mainly because medical aid escalates at 9% from
  today for 50 years: R3,500 becomes about R17,900/month in today's money. This is open below.
- The success-rate gap was attributed on 2026-10-31: correlation −11.1, 17.5% ceiling −7.2,
  TFSA cap −2.5, timing −0.6. The new order adds +3.5. Splitting the same money into more
  accounts took `main` to 100%; the branch does not change.

## Verification

- `npm run test`: 1,139 pass. New tests: carry-forward (absorbed and frozen-cap cases), order
  (tax-free room, TFSA reserve, ceiling and room interaction, bad input), MC mean equals the
  projection under both methods (mutation-checked against the old conversion), headline gross
  equals the paid row (3 cases), goal-shortfall selector and the auditor's default plan,
  narrative and schema.
- `npm run check` (0 errors), `npm run typecheck`, build, `docs:check`, shadscan.
- The integration test "similar median" was rewritten. Under the model's convention (expected
  return = average), the projection is the mean path and the median sits below it. The old
  20% tolerance only passed because the nominal bias inflated every path.
- Golden files were regenerated after review. `portfolioAtRetirement` is unchanged in all 96
  scenarios. Changes are explained by fixes 2, 3 and 4.

## Still open (audit findings not addressed here)

- **Medical aid at 9% from today for decades** dominates late-life net income (5× in real
  terms over 50 years). It is deducted from net only and never affects depletion.
- **Expected return as an arithmetic average:** the MC median path runs below the projection.
  Treating it as a compound (median) return is a modelling decision still to make.
- **Historical relief rests on one decade.** A longer SARS history and neutral labels remain
  to be done.
- **Investment scenarios** use a different model with hard-coded returns and a "Recommended"
  badge (FAIS concern).
- **Success is all-or-nothing;** "Fair" and "at risk" labels disagree.
- **Spending phases** are keyed to years retired and hidden from Overview.
- **Risk page** re-runs `compareScenarios` on every volatility keystroke.
- **Optimal contribution** reports "achievable" at a 0% withdrawal rate.
- **Edge cases:** negative inflation, depletion age 0, net return below −100%.
- **Docs:** two-pot R240k de minimis wording, provident vested rights wording, LA band source
  (cite National Treasury 2 June 2020).
- **Tax figures** are duplicated outside `tax-year.config.ts`.
