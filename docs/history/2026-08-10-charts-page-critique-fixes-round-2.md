# Charts page: second critique pass — truthful tooltips, keyboard focus, gallery hierarchy, red deltas

**Date:** 2026-08-10 (evening)
**Scope:** `/calculator/charts` + shared `components/ui/chart.tsx` + new shared utils
**Trigger:** Second Impeccable critique scored the page 23/40. Prior pass (10:50Z) fixed the dead
MC chart, honest copy, success-rate hierarchy, and contrast; this pass found the tooltips were
**actively lying**, chart surfaces were keyboard-focusable with **no visible focus**, and the
gallery had zero hierarchy.

## What the critique found

1. **P1 — Tooltips were broken, differently per chart.** `ChartTooltipContent` fed
   `labelFormatter` the series label (`itemConfig.label`) instead of the raw x-axis value, so
   headers read **"Age Portfolio Balance"** / **"Age undefined"**. The MC tooltip listed three
   *unlabeled* currency amounts (median vs. bands indistinguishable). The scenario success rate
   rendered as **"R 100"** instead of "100%" — the formatter checked `name === "success"` while the
   Bar was named `"Success rate"`. On a tool whose brand is correctness, the per-point readout lied
   on two of six charts.
2. **P1 — Chart SVGs were keyboard traps.** Recharts 3 defaults `accessibilityLayer: true`, which
   renders `role="application"` + `tabIndex={0}` on the surface. `chart.tsx` stripped the outline
   (`[&_.recharts-surface]:outline-none`), so keyboard users tabbed onto an invisible, apparently
   inert element. (Verified this pass: the layer genuinely *does* navigate the tooltip with arrow
   keys — the defect was only the missing focus indicator, not the layer.)
3. **P1 — No hierarchy across the gallery.** Six equal-weight cards, no reading order, no page-level
   verdict. Users couldn't tell which chart answered "does my plan hold?".
4. **P2 — Amber for negative deltas conflicted with DESIGN.md** (red reserved for negative deltas).
5. **P2 — Duplicated "Charts" title + false "curate" promise** (the latter was already fixed by the
   prior pass; the duplicated title remained).

## Changes

### Shared tooltip pipeline — new `lib/utils/chart-tooltip.ts` (+ tests)
- `resolveTooltipLabelValue` — a numeric x-axis value (e.g. an age) now passes through raw to
  `labelFormatter`; string category labels still resolve against the config. Fixes the
  "Age undefined" / "Age Portfolio Balance" headers on portfolio, income, and MC charts via the
  shared component — no per-chart change needed.
- `formatPercentileTooltip` — MC tooltip rows now read `Median: R 4 340 000` /
  `Likely range: ...` / `Possible range: ...`. Also fixed `chartConfig` keys (`band75`/`band90` →
  `p75`/`p90`) so the labels actually match the drawn dataKeys.
- `formatScenarioTooltip` — keyed off `dataKey` (not display `name`), so the success series renders
  as a percentage and the nest egg as currency. Fixes the "R 100" bug.
- `getPayloadConfigFromPayload` moved here from `chart.tsx` so the logic is unit-testable.
- `components/ui/chart.tsx` now imports these; its local copy of the resolver is gone (export, never
  duplicate).
- `components/charts/monte-carlo-chart.tsx` + `scenario-comparison-chart.tsx` use the new
  formatters.
- **`lib/utils/chart-tooltip.test.ts`** (new) — 14 tests covering numeric/string/absent labels,
  named MC bands, scenario %-vs-currency, and payload config resolution.

### Keyboard focus — `components/ui/chart.tsx`
- Removed `[&_.recharts-surface]:outline-none` and added
  `[&_.recharts-surface:focus-visible]:outline-2` + `:outline-offset-2` + `:outline-primary` (2px
  teal ring). Keyboard users now tab onto a visible focus ring and can arrow-key the tooltip (the
  recharts accessibility layer was verified working — focusing the surface and pressing arrows moves
  the tooltip live; disabling it would have regressed genuine keyboard data access).

### Gallery hierarchy — `components/pages/charts-page.tsx`
- New **page-level verdict strip** via `lib/utils/plan-verdict.ts` (+ tests): "Your plan holds" /
  "Income runs out at age N" / "Your plan is at risk", tonally colored (chart-2 / chart-4 / warning /
  destructive). Depletion before life expectancy (90) always wins the verdict.
- Cards reordered by decision impact: Will It Last? → Income Through Retirement → Portfolio Growth →
  Cost of Delay → Investment Scenarios → Sensitivity to Assumptions.
- Duplicated in-content "Charts" title removed (topbar owns the single H1); intro paragraph tightened
  to `max-w-prose` (fixes the ~90ch line length).

### Red deltas
- `sensitivity-tornado-chart.tsx` and `cost-of-delay-chart.tsx`: negative bars use
  `--destructive` (Signal Red) instead of `--warning` (amber), honoring DESIGN.md's
  red-for-negative-delta rule.

### Polish
- Scenario chart subtitle now names the recommended strategy ("· Aggressive recommended") so the
  teal bar is never color-only encoding.
- MC bands toned down (p90 whisper 0.06→0.04, p75 0.16→0.14) and median stroke 2→2.5 so the
  headline reads against the band.

## Verification

- `npm run typecheck` — clean
- `npm run test` — 862/862 passed (22 new tests: 14 tooltip + 8 verdict)
- `npm run test:coverage` — `chart-tooltip.ts` 96.15%, `plan-verdict.ts` 92.85% (both > 90%)
- `npm run build` — succeeds
- Lint — no new errors introduced (2 pre-existing `rules-of-hooks` errors in MC/portfolio charts
  are an early-return-then-useMemo pattern present in HEAD)
- Browser-verified (seeded, 3 accounts):
  - MC tooltip reads `Age 41 / Possible range: R 10 704 214 / Likely range: R 8 839 399 /
    Median: R 7 216 199`
  - Scenario tooltip success shows a percentage, not "R 100"; subtitle names "Aggressive recommended"
  - Verdict strip shows "Your plan holds"; cards ordered MC → Income → Portfolio → Cost → Scenarios → Sensitivity
  - Tornado/cost bars render `--destructive` for negatives
  - Real keyboard: Tab onto a chart surface → visible 2px teal outline; Arrow keys move the tooltip
