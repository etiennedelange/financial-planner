---
type: History Entry
title: "2026-11-04 — Balance charts plotted each year a year early; Overview says \"steady returns only\""
description: "Both balance charts plotted each year's ending balance at the age during that year, so the value at the retirement line was the balance a year after retiring (R66.3M vs R65.0M on the user's plan); the ending-balance column in two tables was deflated a year short. Fixed with shared, tested series builders. Overview wording now says steady returns only."
date: 2026-11-04
tags: [charts, bug, ui]
---

# 2026-11-04 — Balance charts a year early

## Reported

With volatility at 0, the Risk page fan chart showed R66.3M at 65 while the deterministic
engine reported R65.0M at retirement. The user suspected annual versus monthly stepping.

## Finding

The engines agree exactly. At zero volatility, Monte Carlo and the deterministic projection
give R65.009M at retirement under compound and R69.096M under nominal. Monte Carlo also
compounds monthly within each year; only its random draw is annual.

The gap was a **labelling off-by-one in both balance charts**. Each engine records a year's
*ending* balance against the age the person is *during* that year:
- deterministic row `age`;
- Monte Carlo `yearlyBalances[i]`, which is the end of year i + 1.

Both charts plotted that value at that age. So "65" showed the balance after the first
retirement year (R66.344M), and "64" showed the balance at retirement (R65.009M). The two
charts agreed with each other, but not with the "portfolio at retirement, age 65" headline.

The same root cause affected the ending-balance column of the Projections breakdown table
(`calculations-breakdown.tsx`) and the print report (`print-client.tsx`). In Today's Value
mode they deflated the year-end balance by `age − currentAge` years instead of one more,
about 5.5% too high.

## Fix

- `lib/utils/chart-series.ts`:
  - `buildBalanceSeries` (deterministic) and `buildPercentileSeries` (Monte Carlo) plot each
    year-end balance at the age just reached (age + 1);
  - both start at today's balance at the current age;
  - both charts use them, so the value at the retirement line is `portfolioAtRetirement`.
- `MonteCarloChart` takes a required `startingBalance`; the Risk page passes the total balance.
- The growth chart captions now end at life expectancy.
- The two tables call shared helpers instead of writing `age - currentAge` inline:
  - `yearsFromNowAtRowStart` for the starting balance and for flows during the year;
  - `yearsFromNowAtRowEnd`, one year more, for the ending balance.

## Wording

On the Overview, "Goal Income Until" now reads "Steady returns only · market ups and downs can
bring this forward (see Risk)". Key Insights' On Track line carries the same qualifier.
Monte Carlo figures still stay off the Overview, as decided on 2026-10-31.

## Tests and verification

- `lib/utils/chart-series.test.ts`:
  - the deterministic chart's value at 65 equals `portfolioAtRetirement`;
  - the zero-volatility Monte Carlo series equals the deterministic series at every age;
  - series shape, empty input, and a non-finite starting balance;
  - **table deflation, under both compounding methods:** each row's ending balance in today's
    rands equals the next row's starting balance in today's rands, every year except the
    lump-sum boundary;
  - the last accumulation row's ending balance equals the at-retirement figure in today's rands;
  - the old start-of-year basis is exactly one year of inflation too high.
- **The tests catch the bug:** with the helper temporarily reverted to the old formula, 5 of
  the 12 tests fail; restored, all pass.
- Tests: 1,265 pass. Check, typecheck and build are clean; shadscan 90/100.
- Browser check, the user's plan at zero volatility. Both chart tables read R1,995,000 at
  39, R65,009,240 at 65, R66,344,021 at 66 and R545.7M at 100. No page errors.
