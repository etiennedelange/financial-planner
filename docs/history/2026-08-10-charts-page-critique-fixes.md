# Charts page: design-critique fixes (MC live on route, honest copy, success-rate hierarchy, contrast)

**Date:** 2026-08-10
**Scope:** `/calculator/charts` + shared simulation plumbing + global tokens
**Trigger:** Impeccable design critique scored the page 27/40 and surfaced 3 P1 + 2 P2 issues.

## What the critique found

1. **P1 — "Will It Last?" was routinely dead on direct load.** The Monte Carlo worker in
   `calculator-context.tsx` was gated to `pathname === "/calculator/overview"`, so a fresh visit or
   reload of `/calculator/charts` (or `/calculator/projections`) yielded `simulationResult = null`.
   The placeholder then said **"Add accounts and run simulation" even when accounts exist** — the
   one chart users came to see showed nothing and the message lied.
2. **P1 — False "curate" promise.** The page intro said *"Curate which of these appear on the main
   pages"* but no curation control exists anywhere; a false affordance in a tool whose brand is
   correctness.
3. **P1 — Buried, unconditionally-green success rate.** The rate lived in a 12px footnote and the
   `CheckCircle2` was hardcoded `text-chart-2` regardless of value — a 23%-success plan got the same
   green check as 100%.
4. **P2 — Sub-AA contrast on both themes.** Dark `--muted-foreground` (`220 12% 50%`, `#707a8f`)
   measured 4.37:1 against the card surface; light (`220 12% 48%`, `#6c7689`) measured 4.38:1 against
   the page background. Both below the 4.5:1 AA floor DESIGN.md mandates. The MC success line also
   ran at `text-muted-foreground/70` (~3:1).
5. **P2 — Structural a11y:** duplicate H1s ("Charts" in both the sticky top bar and page content),
   and the 10–90 percentile band was drawn but never named in the description.

## Changes

### Simulation plumbing
- **`lib/context/calculator-context.tsx`** — MC worker now runs on overview, charts, AND projections
  (`simEnabled`), so any route that renders the simulation gets live data on direct load. Exposed a
  new `simulationError` field on the context (wired to the worker's `hasError`).
- **`lib/monte-carlo/use-monte-carlo-worker.ts`** — reducer gains a `hasError` state
  (`ERROR` sets it, `START`/`DONE` clear it); result is preserved across an error so a transient
  failure never blanks a good chart. `simReducer` + `initialSimState` exported.
- **`lib/monte-carlo/use-monte-carlo-worker.test.ts`** (new) — 4 reducer tests covering start /
  done / error-keeps-result / error-cleared-on-start.

### Charts page (`components/pages/charts-page.tsx`)
- Intro rewritten: *"Every visualization your plan can produce. Review each one, then jump back to
  Overview or Projections to act on what you see."* — the curation promise is gone. Capped to
  `max-w-2xl` (fixes the ~155-char line length).
- Page title demoted from `<h1>` to a styled `<div>` (top-bar owns the single H1).
- `MonteCarloChart` now receives `hasError` + `hasAccounts`.

### Monte Carlo chart (`components/charts/monte-carlo-chart.tsx`)
- Empty states split into four honest branches: running (spinner) / worker error (`AlertTriangle`,
  "Simulation didn't complete — try again.") / no accounts (Wallet + "Add accounts" CTA) / pending.
  The misleading "Add accounts and run simulation" message is gone.
- Success rate promoted from a 12px footnote to a `text-2xl` mono figure; checkmark + figure colour
  driven by `getSuccessRateStyle(successRate)` (≥75 `chart-2` green, 60–75 `warning`, <60
  `destructive`) instead of hardcoded teal.
- Description now names the drawn band: "Median balance with 25–75th and 10–90th percentile ranges".

### Global tokens (`app/globals.css`)
- Dark `--muted-foreground`: `220 12% 50%` → `220 12% 54%` (`#7c8598`) — 5.09:1 on card, 4.65:1 on
  muted, 4.97:1 on page.
- Light `--muted-foreground`: `220 12% 48%` → `220 12% 44%` (`#636c7e`) — 5.05:1 on page, 4.62:1 on
  muted, 5.28:1 on card.
- Verified programmatically: both tokens clear 4.5:1 on every surface they render against.

### Single H1 per page
- `components/layout/top-bar.tsx` keeps its `<h1>` (it is the only heading on 5 of 7 routes), with a
  comment telling content pages not to duplicate it.
- `components/pages/projections-page.tsx` content `<h1>` demoted to a styled `<div>` (same as charts).

## Design-system notes

- **`role="application"` on charts is not a defect to remove.** Recharts 3 enables its
  `accessibilityLayer` by default, which is what renders that role alongside `tabIndex={0}`,
  arrow-key data navigation, and a live-region tooltip — i.e. the exact "keyboard-reachable exact
  values" the critique asked for. Disabling it would regress keyboard access. Verified in the
  installed `node_modules/recharts` source (`RootSurface.js`, `CartesianChart.js`,
  `rootPropsSlice.js` all default `accessibilityLayer: true`).
- The `SuccessGauge` component (`components/charts/success-gauge.tsx`) remains dead code (imported
  nowhere) — flagged in the critique; parked, not deleted.

## Verification

- `npm run typecheck` — clean
- `npm run test` — 810/810 passed (incl. 4 new `simReducer` tests)
- `npm run build` — succeeds
- `npm run test:coverage` — 93.9% overall (above thresholds)
- Browser-verified at desktop (1440px) + mobile (390px) and both themes: the MC card now populates
  on direct load ("100% success · 1,000 simulations · excellent"), exactly one H1, no horizontal
  overflow, intro capped, `--muted-foreground` tokens live in both themes.
