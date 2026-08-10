# 2026-08-09 — Charts Page: Monte Carlo De-emphasised, All Visualisations Centralised

## Motivation

A UX review of the Overview surfaced two problems:

1. **Two charts plotting the same thing.** Overview carried `PortfolioGrowthChart` (deterministic
   line) and `MonteCarloChart` (percentile fan) side by side — both are portfolio-balance-over-time,
   same axis, same story. The MC fan added a band of uncertainty but answered a question the
   "Plan Success Rate" metric card already answered.
2. **The sim took precedence over the Overview.** The 260px Monte Carlo card occupied half the
   primary grid while its headline number already lived in the metrics grid and Key Insights.

The design decision: **charts become a curated gallery, not a dashboard fixture.** A dedicated
`/calculator/charts` page hosts every visualisation the plan can produce; the main pages get
decluttered and can later be curated back to specific charts.

## Changes

### New route: `/calculator/charts`
- `app/calculator/charts/page.tsx` (client, dynamic import to match other pages)
- `components/pages/charts-page.tsx` — hosts six chart cards in a 2-col grid:
  1. Portfolio growth (existing component)
  2. Monte Carlo → reworked "Will It Last?" median+band
  3. Income through retirement (income vs inflation-adjusted target)
  4. Sensitivity tornado (nest egg Δ per lever)
  5. Investment scenarios (conservative/balanced/aggressive nest egg + success)
  6. Cost of delay (1/2/5 year delay)
- Empty state when no accounts: link to Accounts page.

### Overview de-cluttered
- Removed the chart grid entirely.
- Added `components/dashboard/simulation-run-status.tsx` — a quiet single-line strip under the
  metrics grid that proves the sim ran: scenario count + success rate + "View charts →" link.
  States: add-accounts prompt, simulating, done. No chart, no prominence.

### Monte Carlo reworked: "Will It Last?"
- `components/charts/monte-carlo-chart.tsx` now renders a median line inside a tight 25–75th
  percentile band, with the 10–90th range as a whisper. No `gradientText`, no competing surfaces.
- The run evidence is a muted header line: `✓ 1,000 simulations · 78% success rate`.

### New calculation utils (single source of truth, unit-tested)
- `lib/calculations/utils/income-sustainability.ts` — builds the drawdown-phase income-vs-target
  series from the projection. Handles nominal (escalated target) and real (deflated income, target
  at today's value) display modes. `buildIncomeSustainabilitySeries` returns points + depletion age.
- `lib/calculations/utils/sensitivity-tornado.ts` — computes the nest egg at retirement delta for
  each lever (contributions ±20%, expected return ±1pt, retirement age ±2yrs) by reusing the shared
  `applySensitivityDeltas` + `calculateProjection` engine — the chart can never drift out of step
  with what the plan actually computes. Returns `TornadoBar[]` with rand + percent deltas.

### New chart components (presentation only — call the shared calc utils)
- `income-sustainability-chart.tsx` — AreaChart with income line + dashed target line, retirement
  marker, depletion-age annotation.
- `sensitivity-tornado-chart.tsx` — horizontal BarChart, positive bars teal (chart-2), negative
  bars warning, baseline reference at 0.
- `scenario-comparison-chart.tsx` — dual-axis BarChart (nest egg left, success % right), recommended
  scenario highlighted teal.
- `cost-of-delay-chart.tsx` — BarChart of 1/2/5-year delay cost in warning red.

### Navigation
- Sidebar, bottom nav, top-bar page titles, and the ⌘K command palette all gained the Charts item.

## Testing

- New utils tested (`lib/calculations/utils/*.test.ts`): 16 tests covering nominal/real modes,
  drawdown filtering, depletion reporting, zero-accounts/zero-baseline edge cases, lever directions,
  and percent-delta sign consistency.
- `npm run test` — 806/806 passing.
- `npm run test:coverage` — above thresholds (statements ~95.8%, lines ~96.9%, branches ~87.4%).
- `npm run typecheck` — clean.
- `npm run build` — succeeds, `/calculator/charts` registered.

## Notes for curation

The Charts page is deliberately a *gallery*, not a verdict. Moving a chart back onto a main page
later means importing the component into `components/pages/*` — each takes the same data the page
already has from `useCalculator()` + `useCalculatorStore()`. The `simulation-run-status.tsx` strip
is the place to attach a "View charts →" affordance from any main page.
