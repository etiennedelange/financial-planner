---
type: History Entry
title: "2026-11-04 — Balance charts now respect Today's Value"
description: "Both balance charts (Risk fan chart, Charts growth chart) ignored the Today's Value setting and always plotted nominal rands; the series builders now take a required display basis and deflate each birthday balance. User's plan: fan chart top band fell from ~R1.8B to ~R91M."
date: 2026-11-04
tags: [charts, bug, ui]
---

# 2026-11-04 — Balance charts respect Today's Value

## Finding

`MonteCarloChart` (Risk) and `PortfolioGrowthChart` (Charts) never received the display
mode, so they always plotted future (nominal) rands. The income chart beside them, the
metric cards and the tables all converted to today's rands. On Etienne's plan in Today's
Value mode, the fan chart's axis ran to about R1.8B, while the real final balance was about
R27M.

## Fix

- `buildBalanceSeries` and `buildPercentileSeries` (`lib/utils/chart-series.ts`) take a
  **required** `DisplayBasis` (`displayMode`, `inflationRate` as a decimal, `currentAge`),
  so a chart cannot leave it out.
- Each point is a balance on a birthday, deflated by `age − currentAge` years. Flows
  (contributions, withdrawals) use the start-of-year basis the tables use
  (`yearsFromNowAtRowStart`).
- Both charts take `displayMode` and `inflationRate`, which the Risk and Charts pages pass.
  Their subtitles add "(today's value)" in real mode.

## Tests and verification

- `chart-series.test.ts`:
  - in real mode the value at the retirement line is `portfolioAtRetirement` in today's rands;
  - at zero volatility, the Monte Carlo and deterministic real series agree at every age;
  - per-point deflation, with today's balance unchanged;
  - flows on the start-of-year basis;
  - 0% inflation makes real equal nominal.
- With the conversion turned off, 3 of them fail.
- Tests: 1,270 pass on `main` plus this change. `check` and `typecheck` are clean.
- Browser check, the user's plan in Today's Value mode at 16.5% volatility:
  - the growth chart reads R16,158,876 at 65, which is R65.0M ÷ 1.055²⁶;
  - the fan chart's median is R17.2M at 65 and R18.5M at 100, and its p90 ends at about R91M;
  - both subtitles say "(today's value)", and there were no page errors.
