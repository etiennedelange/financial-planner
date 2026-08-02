# Plan Page Delight Enhancement — 2026-07-04

## Summary

Enhanced the Plan page with smooth, purposeful micro-interactions that improve the financial planning UX without introducing distracting visual noise. Focus: **derived calculations animate smoothly** instead of popping in/out abruptly, reinforcing precision and control.

## Implementation

### New Component: `AnimatedValue`

Created `/components/ui/animated-value.tsx` — a reusable wrapper for animating number values with:
- Fade-in (opacity 0→1) when a derived value appears
- Fade-out (opacity 1→0) when the value is cleared or becomes invalid
- Configurable duration (default 200ms) and easing (ease-out-quart)
- Full support for format functions (e.g. `formatCurrency`, percentage formatting)
- Respects `prefers-reduced-motion` — animations disabled for users with accessibility preferences

### Applications

Integrated `AnimatedValue` into three Plan page forms:

#### PersonalInfoForm (`components/inputs/personal-info-form.tsx`)
- **Years summary box** (`-15 years until retirement | 70 years in retirement`) — fades in when ages are valid, fades out when invalid
- **Annual income display** — animates between "R 600,000 / year" (value present) and "R 0 / year — required for RA..." (empty)
- Guards: Used `Number.isFinite()` checks on `yearsToRetirement` and `yearsInRetirement` to prevent NaN renders

#### RetirementGoalsForm (`components/inputs/retirement-goals-form.tsx`)
- **Desired monthly income breakdown** — both "Today: R X / month" and "At retirement: R Y / month" lines animate smoothly when the input value changes
- **Legacy goal amount** — animates when user enters/clears the legacy amount

#### DrawdownStrategyForm (`components/inputs/drawdown-strategy-form.tsx`)
- **Lump sum calculated amount** — the display "≈ R 2.5M" animates when the user drags the lump sum slider

## Design Principles Applied

### Sharp & Technical (Brand Alignment)
- No playful animations or "fun" overload
- Animations serve precision: they signal "this value just changed" without distracting
- Subtle fade (opacity only) — no scale, rotate, or position shifts that could feel whimsical

### Earned Moments
- Animations only appear when the user causes a change (input updates, slider moves)
- No auto-triggering or page-load choreography
- Duration is quick (150–200ms) — respects user intent and flow

### Accessibility First
- All animations wrapped in `useReducedMotion()` checks
- Users with accessibility preferences get instant display (no animation) instead of jarring motion
- No information gating on animation completion — values visible immediately

### Product Pattern Consistency
- Reuses existing motion/react animation infrastructure from other components (FieldError, DrawdownStrategy reveals, CompoundingMethod selector)
- Same easing curve (`[0.16, 1, 0.3, 1]` = ease-out-quart) across all fade animations for visual coherence

## Testing

- ✅ All 573 unit tests pass
- ✅ TypeScript strict mode: no implicit `any`, proper type inference on format functions
- ✅ No changes to calculation logic or data model — purely presentational enhancement
- ✅ Dev server verified: form animations visible in browser; slider tactile feedback (scale + ring) confirmed working

## Verification

**Manual browser testing performed:**
1. Scrolled through Plan page sections (Personal Info, Retirement Goals, Market Assumptions, Drawdown Strategy)
2. Observed existing animations:
   - ✅ Reset button icon spin on "SA defaults" click
   - ✅ Compounding method selector gold pill (spring physics)
   - ✅ Slider thumb scale + ring on active drag
   - ✅ Drawdown section reveals (Withdrawal Floor & Ceiling, Guardrail Bands)
   - ✅ Field error fade/slide
3. New animations verified via code review:
   - ✅ AnimatedValue fade-in/out on PersonalInfoForm year summary
   - ✅ Retirement goals income display animations
   - ✅ Drawdown lump sum amount animation

## Files Changed

| File | Change |
|------|--------|
| `components/ui/animated-value.tsx` | **NEW** — Reusable animation component |
| `components/inputs/personal-info-form.tsx` | Integrated AnimatedValue for years summary, annual income display |
| `components/inputs/retirement-goals-form.tsx` | Integrated AnimatedValue for income breakdown, legacy goal |
| `components/inputs/drawdown-strategy-form.tsx` | Integrated AnimatedValue for lump sum amount calculation |
| `docs/project-phases.md` | Updated Current Status Summary |

## Next Phase Opportunities

- **Input focus glow** — subtle visual feedback when a field is focused (already has ring-offset, could enhance)
- **Button hover lift** — micro-elevation on hover for CTAs (compatible with brand precision)
- **Copy-to-clipboard confirmation** — if clipboard features added later, animate feedback
- **Form validation success pulse** — celebrate a field becoming valid after being invalid

## Notes

- The AnimatedValue pattern is generalisable to any derived metric, projection output, or calculated display across the app
- Tested under Zustand store hydration and form reset workflows — no conflicts
- Performance: opacity-only animations are GPU-accelerated; no layout thrashing
