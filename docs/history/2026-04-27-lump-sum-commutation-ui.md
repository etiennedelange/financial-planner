# Lump Sum Commutation UI & Slider Performance Fix (2026-04-27)

## What Changed

### Lump Sum Commutation (Phase 6 — Enhanced Tax)

**Problem:** `calculateLumpSumCommutation()` existed in `lib/calculations/retirement-tax.ts` but was never wired into the projection engine or exposed in the UI.

**Changes:**

- `types/inputs.ts` — added `lumpSumPercentage: number` to `DrawdownConfig`
- `types/projections.ts` — added `LumpSumCommutationResult` interface; added `lumpSumCommutation` field to `ProjectionResult`
- `lib/calculations/projection-engine.ts` — calls `calculateLumpSumCommutation()` before the drawdown loop; deducts lump sum from portfolio; seeds `totalLumpSumTax`; initial withdrawal rate applies to remaining portfolio; returns full `lumpSumCommutation` breakdown
- `lib/store/calculator-store.ts` — default `lumpSumPercentage: 0`
- `components/inputs/assumptions-form.tsx` — 0–33% slider (SA one-third regulatory cap) with tooltip explaining tax-free threshold and annuitisation requirement
- `components/results/calculations-breakdown.tsx` — amber panel in tax analysis accordion showing gross amount, tax, net received, remaining portfolio, effective rate, and tier thresholds (R0–R550k @ 0%, R550k–R770k @ 18%, R770k–R1.155M @ 27%, above @ 36%); empty state hint when no lump sum configured; fixed stale "2024/2025" label to "2026/2027"

### Slider Performance Fix

**Problem:** Every slider tick called `setDrawdownConfig` → Zustand store update → all subscribers re-render synchronously → CPU spike.

**Fix (assumptions-form.tsx):**
- Local `useState` for `localWithdrawalRate` and `localLumpSum`
- `onValueChange` updates local state only (free — no store write)
- `onValueCommit` (fires on mouse/touch release) writes to store
- `useEffect` syncs local state when store changes externally (e.g. reset to defaults)

**Fix (calculator-client.tsx):**
- `calculateProjection` was called inline on every render without memoization
- Moved into `useMemo` keyed to the already-available `useDeferredValue` inputs, matching the pattern used for Monte Carlo
