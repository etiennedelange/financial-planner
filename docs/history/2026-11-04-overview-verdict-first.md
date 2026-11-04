---
type: History Entry
title: "2026-11-04 — Overview redesigned: verdict first"
description: "Overview page rebuilt around one verdict sentence plus a market-risk check, timeline, today figures and next best step; derivation moved to tested overview-summary.ts and four dashboard components deleted."
date: 2026-11-04
tags: [ui, overview, calculations]
---

# 2026-11-04 — Overview redesigned: verdict first

Direction "A · Verdict first" from the Overview redesign canvas.

## Why

The Overview gave the same answer three times (on-track badge, income-replacement badge,
depletion tile), showed seven equal-weight tiles with truncated labels, and printed the
steady-return figures with no market-risk caveat beside them. The success rate and
depletion age lived in tiles 6 and 7; the Monte Carlo result was a 12px status line.

## What changed

| Area | Change |
|---|---|
| `lib/calculations/utils/overview-summary.ts` (new) | `calculateOverviewSummary` — years to retirement, income end age (depletion age, else life expectancy), shortfall years, today's-rand income and portfolio (`deflateToToday`), income replacement on the retirement-date basis (`escalateToRetirement`), on-track verdict, RA deduction room. Pure; non-finite inputs degrade to 0. The on-track rule (MC ≥ `ON_TRACK_SUCCESS_RATE` = 70, else steady-return depletion) and the replacement basis are unchanged from the old `KeyInsightsSummary`. |
| `components/dashboard/overview-verdict-card.tsx` (new) | Hero: "Your plan pays R X a month from age 65 to age N" (or "…but runs out at age N"), % of goal plus the other money basis, and a market-risk row: running → passes (≥70%) → runs short → "Market risk not included" when no simulation result. Side panel: portfolio at retirement and income-lasts-until. Headline follows `displayMode`; the secondary line always shows the other basis. |
| `components/dashboard/retirement-timeline.tsx` (new) | Proportional saving / income / shortfall bar, ages under each boundary. |
| `components/dashboard/overview-today-stats.tsx`, `next-best-step-card.tsx` (new) | Saved today, contributing, time to retirement; RA deduction limit as one action (hidden at R0 income). |
| `components/pages/overview-page.tsx` | Composes the above with the existing `PlanNarrativeCard`; `GettingStarted` when there are no accounts or no projection. Takes `displayMode` and `accountCount` (was `hasAccounts`). |
| Deleted | `dashboard-metrics-grid.tsx`, `dashboard-metric-card.tsx`, `key-insights-summary.tsx`, `simulation-run-status.tsx` — only the Overview used them. |

Compounding method does not apply: the summary only moves amounts through time with
inflation (`money-time.ts`); it calculates no returns.

## Verification

- `overview-summary.test.ts`: 19 tests (SA scenarios, MC verdict incl. threshold, 0% inflation,
  zero years, inverted ages, zero balance, no goal, non-finite inputs); 100% statement/branch
  coverage. Expected today's-rand values checked against `=x/1.055^26`.
- Full suite 1045/1045, `pnpm typecheck` clean, `vp check` 0 errors (no warnings in new
  files), `pnpm build` clean (with placeholder Supabase env), shadscan 93/100 unchanged.
- Browser: dev server with one account, Overview at 1440px dark + light and 390px dark.
