# Scenario Comparison Methodology Fix

**Date:** 2026-01-15
**Author:** Claude
**Files Changed:**
- `lib/calculations/scenario-comparison.ts`
- `components/dashboard/dashboard-metrics-grid.tsx`
- `components/accounts/account-card.tsx`

## Summary

Fixed several inconsistencies between the main Monte Carlo simulation and the Investment Scenarios comparison, ensuring both use the same methodology and display results consistently.

---

## Issue 1: Inflation Double-Counting in Scenario Comparison

### Problem
The scenario comparison was using **real returns** (nominal - inflation - fees) for Monte Carlo simulations while also inflating withdrawals by inflation. This double-counted inflation, making scenarios appear ~2x harder than they should be.

**Example:**
- Balanced scenario: 12% nominal - 5.5% inflation - 1% fees = 5.5% real return
- Withdrawals inflated by 5.5% annually
- Net effect: Portfolio barely keeps pace, many runs fail

**Result:** Main simulation showed 80% success, but Balanced scenario showed only 47% success with identical parameters.

### Fix
Changed scenario comparison to use **nominal returns** (matching main simulation):

```typescript
// Before (buggy):
const realReturn = scenario.nominalReturn - inflationRate - fees  // 5.5%
// Withdrawals also inflated - double counting!

// After (fixed):
const nominalReturn = scenario.nominalReturn - fees  // 11%
// Withdrawals inflate by 5.5% - matches main simulation
```

---

## Issue 2: Missing Stochastic Accumulation Phase

### Problem
The scenario comparison only applied volatility during the **drawdown phase**, using a deterministic projection for accumulation. The main simulation applies volatility during **both phases**.

**Before:**
- Scenarios: Deterministic accumulation → always reach exact projected nest egg
- Main: Stochastic accumulation → nest egg varies based on return sequence

**Result:** Scenarios showed artificially high success rates because they assumed you'd always reach the projected nest egg.

### Fix
Created `runFullMonteCarloSimulation()` that includes stochastic returns during both phases:

```typescript
function runFullMonteCarloSimulation(
  currentBalance: number,
  monthlyContribution: number,
  contributionEscalation: number,
  desiredMonthlyIncome: number,
  yearsToRetirement: number,
  yearsInRetirement: number,
  expectedReturn: number,
  volatility: number,
  inflation: number,
  iterations: number = 1000
): number {
  // ACCUMULATION PHASE: Stochastic returns, monthly compounding
  // DRAWDOWN PHASE: Stochastic returns, spending phase multipliers
}
```

---

## Issue 3: Misleading Portfolio Depletion Display

### Problem
The dashboard showed "Portfolio Depletion: Age 85" even when 80% of simulations succeeded. The "85" was the **median depletion age among failing runs only**, but it appeared as if the portfolio would deplete at 85 in all cases.

### Fix
Updated `dashboard-metrics-grid.tsx` to show contextually appropriate values:

```typescript
if (successRate >= 50) {
  // Majority succeed - show "Never" as expected outcome
  depletionValue = "Never"
  depletionDescription = `${failureRate}% risk of depletion (median age ${depletionAge})`
} else {
  // Majority fail - show depletion age prominently
  depletionValue = `Age ${depletionAge}`
  depletionDescription = `${yearsUntilDepletion} years from now (${failureRate}% of scenarios)`
}
```

---

## Issue 4: Missing Account Card Fields

### Problem
Account cards did not display contribution escalation rate.

### Fix
Added escalation field to `account-card.tsx`:

```tsx
<div className="text-muted-foreground">Escalation</div>
<div className="font-medium">
  {formatPercentage(account.contributionEscalation)}
</div>
```

---

## Testing

All existing tests pass:
```bash
npm run test -- --run lib/calculations/__tests__/scenario-comparison.test.ts
# 36 tests passed
```

Build completes successfully:
```bash
npm run build
# ✓ Compiled successfully
```

---

## Verification

After these fixes, with identical parameters:
- Main simulation and Balanced scenario should show similar success rates
- Portfolio depletion metric shows "Never" when majority of runs succeed
- Scenario success rates reflect true risk including accumulation phase volatility

---

## Related Files

- `lib/monte-carlo/simulation-engine.ts` - Main simulation (reference implementation)
- `lib/calculations/utils/projection.ts` - Deterministic projection (unchanged)
- `components/results/insights-panel.tsx` - Calls `compareScenarios()`
