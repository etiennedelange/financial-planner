---
type: History Entry
title: "2026-11-04 — Overview redesigned: verdict first"
description: "Overview page rebuilt around one verdict sentence plus a market-risk caveat, timeline, today figures and next best step; derivation moved to tested overview-summary.ts; grid, Key Insights and RiskLink deleted."
date: 2026-11-04
tags: [ui, overview, calculations]
---

# 2026-11-04 — Overview redesigned: verdict first

Direction "A · Verdict first" from the Overview redesign canvas.

## Why

The Overview gave the same answer three times ("Goal Income Until" tile, On Track badge,
Income Replacement badge), showed six equal-weight tiles with truncated labels, and repeated
the steady-returns caveat in a tile, a banner and an insight.

## What changed

| Area | Change |
|---|---|
| `lib/calculations/utils/overview-summary.ts` (new) | `calculateOverviewSummary` — years to retirement, goal-income-until age (`incomeGoalShortfallAge`, else life expectancy), years of goal income and years below goal, today's-rand income and portfolio (`deflateToToday`), income replacement on the retirement-date basis (`escalateToRetirement`), on-track verdict, RA deduction room. Pure; non-finite inputs degrade to 0. The on-track rule (`incomeGoalShortfallAge === null`) and the replacement basis are unchanged from the old `KeyInsightsSummary`. |
| `components/dashboard/overview-verdict-card.tsx` (new) | Hero: "Your plan pays R X a month from age 65 to age N" (or "…but falls below your goal from age N"), % of goal plus the other money basis, and a "Market risk not included" row linking to `/calculator/risk`. Overview stays deterministic only — no Monte Carlo numbers. Side panel: portfolio at retirement and goal income until. Headline follows `displayMode`; the secondary line always shows the other basis. |
| `components/dashboard/retirement-timeline.tsx` (new) | Proportional saving / goal income / below-goal bar, ages under each boundary. |
| `components/dashboard/overview-today-stats.tsx`, `next-best-step-card.tsx` (new) | Saved today, contributing, time to retirement; RA deduction limit as one action (hidden at R0 income). |
| `components/pages/overview-page.tsx` | Composes the above with the existing `PlanNarrativeCard`; `GettingStarted` when there are no accounts or no projection. Takes `displayMode` and `accountCount` (was `hasAccounts`). |
| Deleted | `dashboard-metrics-grid.tsx`, `key-insights-summary.tsx`, `risk-link.tsx` (its caveat now sits in the verdict card). `dashboard-metric-card.tsx` stays: the Risk page uses it. |

Merged with `main` after PR #29 (SA calc audit), which made the Overview deterministic-only and
redefined on track as "pays the goal income every year"; this redesign follows both.

Compounding method does not apply: the summary only moves amounts through time with
inflation (`money-time.ts`); it calculates no returns.

## Verification

- `overview-summary.test.ts`: 16 tests (SA scenarios incl. shortfall from the first retirement
  year, 0% inflation, zero years, inverted ages, zero balance, no goal, out-of-window shortfall
  age, non-finite inputs); 100% statement/branch coverage. Expected today's-rand values checked against `=x/1.055^26`.
- Full suite 1280/1280 (after merging `main`), `pnpm typecheck` clean, `vp check` 0 errors (no
  warnings in new files), `pnpm build` clean (with placeholder Supabase env), shadscan 90/100 —
  the same as `main` at the merge base.
- Browser: dev server with one account, Overview at 1440px dark + light and 390px dark.
