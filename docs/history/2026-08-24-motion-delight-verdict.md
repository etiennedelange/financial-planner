# Motion Delight — "The Answer Lands"

**Date:** 2026-08-24
**Scope:** Overview dashboard + simulation run status + shared number primitive
**Skill:** `/impeccable delight` with Motion for React (`motion/react`, already v12.40 in the project)

## Thesis

1,000 Monte Carlo scenarios reduce to one number. When the worker delivers its verdict, the
answer should land like an instrument settling into place — the success rate counts up with the
tool's own critically-damped spring (the dial sweeping to its reading), the run-status check draws
its stroke, and every other number in the dashboard rolls between values with the same precise
physics. Nothing else in the app gets motion: waiting stays honest (spinner + `…`), charts stay
`isAnimationActive={false}` (deliberate), inputs keep their existing 200 ms crossfades.

## What changed

### New: `components/ui/rolling-value.tsx`
A number that fades in on first appearance (200 ms, `cubic-bezier(0.16, 1, 0.3, 1)`) and then
rolls between values with the existing `SpringNumber` spring (stiffness 140, damping 26, mass 0.5 —
critically damped, no overshoot: precise, not playful). Optional `initial` prop: default fades in
already settled; `initial={0}` counts up from zero — reserved for the one earned count-up in the
app, the Plan Success Rate verdict.

### `components/ui/spring-number.tsx`
Added optional `initial` prop (value the spring starts at on mount; defaults to `value`, so
existing callers like `portfolio-impact-strip` behave identically). Reduced-motion path reworked:
the target now lands via `spring.jump(value)` in the effect instead of `setDisplay(value)` — the
markup stays byte-identical to the spring path, so SSR hydration matches for reduced-motion users
(see Hydration bug below), and the React Compiler lint stays quiet (no setState in effect).

### `components/dashboard/dashboard-metric-card.tsx` + `dashboard-metrics-grid.tsx`
Metric cards accept an optional numeric variant (`numericValue` + `format` + `initial`) rendered
through `RollingValue`. Wired for the five numeric cards (Total Portfolio, Portfolio at Retirement,
Monthly Income, Monthly Contributions, Years to Retirement — fade on first load, roll on change)
and Plan Success Rate (`initial={0}` — counts up on first load, rolls between verdicts after).
Portfolio Depletion stays a plain string ("Never" / "Age 78" — not a number worth rolling).

### `components/dashboard/simulation-run-status.tsx`
The verdict row: on completion the checkmark now draws itself in — an inline motion SVG
(`pathLength` 0 → 1, circle 250 ms then check 200 ms) instead of a static `CheckCircle2`. The row
fades in 150 ms. The draw re-runs on every completion because the row remounts from the loader
branch.

## Deliberately not touched

- **`StickyResultsBar`** — confirmed dead code (removed from the app in the redesign; only
  referenced in `docs/superpowers/specs/2026-06-07-ui-redesign-design.md`). The rollover continuity
  lives in the metric grid instead. Phase 11's knip pass already has it in scope.
- **Waiting state** — spinner + `…` stays; simulation runs are genuinely fast (worker), and
  faking progress would violate the skill's "never fake work" rule.
- **Charts** — all remain `isAnimationActive={false}`; the data is the animation.
- **Forms / inputs** — keep their existing `AnimatedValue` crossfades.

## Bugs caught during verification

### Hydration mismatch under `prefers-reduced-motion`
`useReducedMotion()` returns `false` on the server, so any render branch on it breaks hydration
for reduced-motion users (server renders the motion markup, client renders the static branch).
First version of `RollingValue` and `VerdictCheck` both did this; the overview threw the React
hydration-mismatch error under emulated reduced motion. Fixed by the established codebase pattern
(`AnimatedValue`): never branch markup on reduced motion — gate only durations (0 ms) and values
(`spring.jump`). Verified: 0 hydration errors under `emulateMedia({ reducedMotion: 'reduce' })`.

## Verification

- **Count-up:** live timeline sampling showed `--` → `…` → `0%` → `1%` → `2%` → `3%` — the
  spring passes through intermediate values; it does not snap.
- **Reduced motion:** same sampling with `prefers-reduced-motion: reduce` showed `…` → `3%` with
  no intermediates and 0 console hydration errors; the check renders fully drawn (duration 0).
- **Rollover:** new component test `components/ui/rolling-value.test.tsx` (4 tests) proves
  first-paint-settled, count-from-`initial`, value→value rollover (caught mid-flight at 195 of 200
  in the throttled test environment — the spring is running, not snapping), and format-function
  swaps. First UI component tests in the repo.
- **Mobile:** 390 px viewport — all 7 metric cards render, no horizontal overflow, bottom nav
  intact.
- **Gates:** `npm run typecheck` clean, `npm run lint` 0 errors (9 pre-existing warnings
  untouched), `npm run test` 994/994 (57 files), `npm run build` compiles, `npm run shadscan:gate`
  **93/100 (A)** — verified identical to HEAD via `git stash` (the documented "98/100 baseline" in
  CLAUDE.md is stale; 93 predates this change).

## Design system note (DESIGN.md)

Added a Motion section to DESIGN.md documenting the language: one authored moment (the verdict),
the spring constants, the duration budget, and the reduced-motion policy.