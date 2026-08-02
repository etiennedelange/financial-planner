# What-If Sensitivity Panel — Design Spec

Date: 2026-08-01
Status: Approved, pending implementation plan

## Purpose

Let a user drag sliders for retirement age, monthly contribution, expected
return, and target retirement income, and see how the outcome moves — both an
instant deterministic projection and a debounced Monte Carlo success
probability — without touching their real saved plan until they choose to.

This is the first of two features from the same brainstorming session (the
second is a plain-English AI narrative of the plan, specced separately since
it needs new server-side infrastructure this app doesn't have yet).

## Placement

New panel on `/calculator/projections`, inserted into
`components/pages/projections-page.tsx` between `ProjectionSummary` and
`InsightsPanel`.

## Files

- `components/results/what-if-panel.tsx` — new client component. Follows the
  same self-contained pattern as `components/results/insights-panel.tsx`:
  reads `useCalculatorStore` directly via `useShallow`, no prop drilling from
  the page.
- `lib/calculations/utils/apply-sensitivity-deltas.ts` — new pure function.
  This is calculation-adjacent code, so per CLAUDE.md rule 1 it ships with its
  own `apply-sensitivity-deltas.test.ts`.

No other files are added. No new dependencies (shadcn's `Slider` primitive is
assumed already available or added via the standard shadcn CLI flow).

## Sandbox state

Local `useState` inside `WhatIfPanel`. Never written to
`lib/store/calculator-store.ts`, `expenses-store.ts`, or Supabase — it is
pure client, ephemeral UI state that resets on unmount/navigation and via an
explicit "Reset" button.

```ts
interface SensitivityDeltas {
  retirementAgeOffset: number // years, default 0
  contributionScalePct: number // %, default 0 = no change
  returnDeltaPts: number // percentage points, default 0
  targetMonthlyIncomeOverride: number | null // null = use real value
}
```

All fields default to "no change" — i.e. a freshly opened panel previews
exactly the real plan until the user moves a slider.

**Slider ranges** (starting defaults, adjustable during implementation if UX
review calls for it):

- Retirement age offset: -10 to +15 years (further clamped by the
  `currentAge < age ≤ lifeExpectancy` rule below).
- Contribution scale: -100% to +200% (-100% means every scalable account
  drops to R0).
- Return delta: -5 to +5 percentage points.
- Target monthly income override: ±50% of the real
  `retirementGoals.desiredMonthlyIncome`, rand-denominated on the slider
  (not a percentage label).

## `applySensitivityDeltas`

```ts
function applySensitivityDeltas(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  deltas: SensitivityDeltas
): {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
}
```

Pure transform, no engine/calculation logic — it only reshapes inputs that
get fed into the existing, unmodified `calculateProjection` and
`runMonteCarloSimulation` (via `useMonteCarloWorker`). This keeps the sandbox
mathematically identical to the real projections page; there is no
parallel/duplicate calculation path to drift out of sync (see CLAUDE.md
"Never copy calculation logic").

Behavior:

- `retirementAgeOffset` is added to `personalInfo.retirementAge`, then
  clamped to `currentAge < retirementAge ≤ lifeExpectancy`.
- `targetMonthlyIncomeOverride`, if non-null, replaces
  `retirementGoals.desiredMonthlyIncome` directly (single field, no scaling
  needed).
- `contributionScalePct` scales `monthlyContribution` **only across accounts
  that currently have a nonzero contribution**, proportional to each such
  account's current share of the total nonzero contribution. Accounts
  currently contributing R0 are left untouched — a percentage scale can never
  move a base of zero. Result is clamped at 0 (can't go negative).
- `returnDeltaPts` is added to every account's `expectedReturn`, clamped at a
  0% floor per account.

## Data flow

1. `WhatIfPanel` reads `accounts`, `personalInfo`, `retirementGoals`,
   `assumptions`, `drawdownConfig` from `useCalculatorStore` (`useShallow`).
2. On every `deltas` change, `applySensitivityDeltas(...)` produces scaled
   `accounts`/`personalInfo`/`retirementGoals`.
3. **Instant number** (nest egg at retirement): `calculateProjection(scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, assumptions)` in a `useMemo` keyed on the scaled inputs. This is the same function the real projections page already calls synchronously — no new cost profile.
4. **Debounced number** (success probability): the scaled inputs are wrapped
   in `useDeferredValue` (the same idiom `lib/context/calculator-context.tsx`
   already uses to throttle expensive recomputation) before being passed to
   `useMonteCarloWorker(scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, 1000, assumptions, enabled)`
   — the existing hook, invoked a second time with sandbox inputs. Its
   existing monotonic-id stale-result-drop logic means only the latest
   settled drag position's result ever renders; no new debounce utility is
   introduced.
5. **Apply to plan**: calls `setPersonalInfo`, `setRetirementGoals`, and
   `updateAccount` (looped per scaled account) with the scaled values, then
   resets `deltas` to defaults, since the sandbox now equals the real plan.
   Disabled while all deltas are at their defaults (nothing to apply).

## Layout

`PageCard label="What If"` (per the canonical section-label pattern),
containing a two-column split:

- **Left**: four shadcn `Slider`s, each with a live text label above it
  ("Retirement age: 63", "Monthly contribution: R8,500", "Expected return:
  10.5%", "Target monthly income: R28,000"). "Reset" and "Apply to plan"
  buttons below the sliders.
- **Right**: the two live numbers — projected nest egg at retirement, and
  success probability — plus a small delta line ("+R320k vs your current
  plan"). Shows a loading indicator (reuse whatever pattern `isSimulating`
  drives elsewhere) while the debounced Monte Carlo run is in flight.

Collapses to a single stacked column on mobile/narrow viewports (same
breakpoint convention as the rest of the app).

## Error handling / edge cases

- Zero accounts: panel does not render at all — mirrors the existing
  `deferredAccounts.length === 0` guard in `CalculatorProvider`, since there
  is nothing to project.
- Retirement age offset is clamped as described above; UI disables further
  drag past the clamp rather than allowing an out-of-range value to be set.
- Contribution scale and return delta are both floored at 0 per-account, as
  described above.
- If the debounced Monte Carlo run errors (worker `onerror`), the success
  probability side shows "—" rather than a stale/incorrect number — same
  convention as `useMonteCarloWorker`'s existing `ERROR` action.

## Testing

`lib/calculations/utils/apply-sensitivity-deltas.test.ts`, following the
project's standard `describe` structure (Critical SA scenarios /
Compounding methods / Edge cases):

- All-zero deltas is a no-op (returns equivalent values).
- Negative-clamped contribution scale (large negative `contributionScalePct`)
  floors every affected account at R0, never negative.
- Return delta floors `expectedReturn` at 0% even with a large negative
  `returnDeltaPts`.
- Retirement age offset clamped at both ends (can't go below `currentAge`,
  can't exceed `lifeExpectancy`).
- Multi-account proportional split: two accounts with different
  contribution levels scale proportionally to their existing share.
- R0-contribution account is left untouched by `contributionScalePct` while
  a sibling nonzero account absorbs the full scale.
- Single-account case (no proportional split needed, scale applies 1:1).

No changes are needed to `calculateProjection`, `runMonteCarloSimulation`, or
`useMonteCarloWorker` — this feature is additive, calling existing,
already-tested engine code with different (scaled) inputs.

## Out of scope for this spec

- The AI plain-English narrative feature (separate spec).
- Persisting sandbox state across sessions or scenarios.
- A tornado/ranked-impact view of which lever matters most (considered as
  layout option C, not chosen).
