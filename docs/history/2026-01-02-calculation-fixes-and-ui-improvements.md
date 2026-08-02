# Project Changes: 2026-01-02

## SA Retirement Calculator - Calculation Fixes & UI Improvements

### Overview
This session focused on fixing calculation accuracy to match Excel FV formula results, resolving UI issues, and implementing UX enhancements for the South African retirement planning calculator.

---

## 1. Calculation Fixes (Excel FV Formula Alignment)

### Problem
Website projections didn't match Excel FV calculations:
- **User's Excel result**: ~R21.6M
- **Website result**: ~R19M (before fixes)

**Test parameters:**
- Annual interest rate: 14%
- Period: 28 years
- Principal: R120,000
- Monthly contribution: R6,500
- TER (fees): 1.9%
- Net return: 12.1%

### Root Causes & Solutions

#### A. Monthly Rate Conversion
**Location:** `lib/calculations/projection-engine.ts`

```typescript
// BEFORE: Compound conversion (mathematically correct for effective annual rate)
const monthlyReturn = Math.pow(1 + netReturn, 1 / 12) - 1

// AFTER: Simple division to match Excel FV and industry convention
const monthlyReturn = netReturn / 12
```

#### B. Contribution Timing
**Location:** `lib/calculations/projection-engine.ts`

```typescript
// BEFORE: Beginning-of-period (Excel FV type=1)
totalBalance += monthlyContribution
const monthGrowth = totalBalance * monthlyReturn
totalBalance += monthGrowth

// AFTER: End-of-period (Excel FV type=0 default)
const monthGrowth = totalBalance * monthlyReturn
totalBalance += monthGrowth
totalBalance += monthlyContribution
```

#### Files Updated with Same Fixes:
- `lib/calculations/projection-engine.ts`
- `lib/calculations/cost-of-delay.ts`
- `lib/calculations/scenario-comparison.ts`
- `lib/calculations/optimal-contribution.ts`
- `components/results/calculations-breakdown.tsx`

---

## 2. Insights Tab Inconsistencies

### Problem A: Scenario Comparison Values Mismatch
The Insights tab showed different projected values than the main Portfolio at Retirement calculation.

**Cause:** Using real returns (subtracting inflation) during accumulation phase instead of nominal returns.

**Fix:** `lib/calculations/scenario-comparison.ts`
```typescript
// Use nominal return for accumulation phase (consistent with main projection)
const nominalReturn = scenario.nominalReturn - fees

// Use real return only for sustainability/drawdown analysis
const realReturn = scenario.nominalReturn - inflationRate - fees
```

### Problem B: JavaScript Operator Precedence Bug
When contribution escalation was set to 0%, the fallback value of 6% was incorrectly applied.

**Cause:** Operator precedence issue with `||` fallback

**Fix:** `components/results/insights-panel.tsx`
```typescript
// BEFORE (buggy - when result is 0, uses 0.06!)
const avgEscalation =
  accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
    accounts.length || 0.06

// AFTER (fixed)
const avgEscalation =
  accounts.length > 0
    ? accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
        accounts.length
    : 0.06
```

---

## 3. Success Rate Gauge UI Issues

### Problem A: Text Visibility
Orange/yellow text was not visible on white backgrounds.

**Fix:** Changed text colors to use darker variants for light mode and lighter for dark mode:
```typescript
// Example color mapping
if (rate >= 50) return {
  bg: "bg-yellow-500",
  text: "text-yellow-700 dark:text-yellow-400"
}
```

### Problem B: Gauge Not Filling at 100%
Complex SVG gauge geometry wasn't rendering correctly at edge cases.

**Solution:** Replaced gauge with simple progress bar in `components/charts/success-gauge.tsx`:
```typescript
<div className="h-3 w-full rounded-full bg-muted overflow-hidden">
  <div
    className={`h-full rounded-full transition-all duration-500 ${colors.bg}`}
    style={{ width: `${clampedRate}%` }}
  />
</div>
```

---

## 4. Auto-Calculate Monte Carlo Simulation

### Problem
Required manual button click to run simulation after each input change.

### Solution
Implemented auto-calculation with 300ms debounce in `app/calculator/page.tsx`:

```typescript
const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

useEffect(() => {
  if (simulationTimeoutRef.current) {
    clearTimeout(simulationTimeoutRef.current)
  }

  if (accounts.length === 0) {
    setSimulationResult(null)
    return
  }

  setIsSimulating(true)

  simulationTimeoutRef.current = setTimeout(() => {
    const result = runMonteCarloSimulation(
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      { numberOfRuns: 1000 },
      assumptions
    )
    setSimulationResult(result)
    setIsSimulating(false)
  }, 300)

  return () => {
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current)
    }
  }
}, [accounts, personalInfo, retirementGoals, assumptions, drawdownConfig])
```

---

## 5. Account Form Dialog Conversion

### Change
Converted inline account add/edit form to a modal popup dialog.

### Files Created/Modified:
- **Created:** `components/ui/dialog.tsx` (shadcn Dialog component using Radix UI)
- **Refactored:** `components/accounts/account-form.tsx` to `AccountFormDialog`
- **Updated:** `components/accounts/account-list.tsx` to use the dialog

### Problem: Dialog Not Showing Existing Account Values
When editing an account, the form showed default values instead of the account's current values.

**Cause:** React Hook Form's `defaultValues` are only set once on component mount.

**Fix:** Added `useEffect` to reset form when dialog opens or account changes:

```typescript
const getDefaultValues = (account?: Account | null): AccountFormData => ({
  name: account?.name || "",
  provider: account?.provider || "",
  type: account?.type || "retirement_annuity",
  currentBalance: account?.currentBalance || 0,
  monthlyContribution: account?.monthlyContribution || 0,
  expectedReturn: account?.expectedReturn ?? SA_DEFAULTS.defaultExpectedReturn,
  annualFees: account?.annualFees ?? SA_DEFAULTS.defaultAnnualFees,
  contributionEscalation: account?.contributionEscalation ?? SA_DEFAULTS.defaultContributionEscalation,
})

useEffect(() => {
  if (open) {
    reset(getDefaultValues(account))
  }
}, [open, account, reset])
```

---

## Files Modified Summary

| File | Changes |
|------|---------|
| `lib/calculations/projection-engine.ts` | Monthly rate conversion, contribution timing |
| `lib/calculations/cost-of-delay.ts` | Same calculation fixes |
| `lib/calculations/scenario-comparison.ts` | Nominal vs real returns fix |
| `lib/calculations/optimal-contribution.ts` | Same calculation fixes |
| `components/results/calculations-breakdown.tsx` | Same calculation fixes |
| `components/results/insights-panel.tsx` | Operator precedence fix |
| `components/charts/success-gauge.tsx` | Replaced gauge with progress bar |
| `app/calculator/page.tsx` | Auto Monte Carlo with debounce |
| `components/ui/dialog.tsx` | New component (Radix UI Dialog) |
| `components/accounts/account-form.tsx` | Converted to dialog, form state fix |
| `components/accounts/account-list.tsx` | Updated to use dialog |

---

## Technical Notes

### Excel FV Formula Reference
```
=FV(rate/periods, periods*years, -pmt, -pv, type)
```
- `rate/periods`: Simple division for monthly rate
- `type=0` (default): End-of-period contributions
- `type=1`: Beginning-of-period contributions

### Key Learning
Industry convention for retirement calculators typically uses:
1. Simple division for monthly rates (nominal annual rate assumption)
2. End-of-period contributions (matching Excel default behavior)

This differs from mathematically "correct" compound conversion but aligns with user expectations and Excel compatibility.
