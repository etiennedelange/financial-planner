# Testing & Validation Plan

**Created:** 2026-01-05
**Status:** Planning
**Phase:** 1.5 - Testing & Validation Framework

---

## Overview

This document outlines the comprehensive testing strategy to ensure calculation accuracy and cross-tab consistency in the SA Retirement Calculator. The plan addresses the current issue where duplicate calculation functions and lack of automated tests can lead to inconsistencies across different tabs.

---

## Current Issues

### 1. **Code Duplication**
- `projectFinalSavings` function is duplicated in 3 files:
  - `lib/calculations/optimal-contribution.ts`
  - `lib/calculations/cost-of-delay.ts`
  - `lib/calculations/scenario-comparison.ts`
- Risk: Changes to one file may not be reflected in others
- Solution: Create single source of truth

### 2. **Lack of Automated Testing**
- No unit tests for calculation functions
- No integration tests for cross-tab consistency
- Manual validation only (time-consuming and error-prone)

### 3. **Debug Window Gaps**
- Doesn't show which compounding method is active
- No calculation checksums for verification
- Hard to verify which formula was actually used

---

## Implementation Plan

### **Task 1: Consolidate `projectFinalSavings` Function** ⚡ CRITICAL

**Priority:** P0 (Highest)
**Estimated Time:** 30 minutes
**Impact:** Prevents calculation drift between different tabs

#### Steps:

1. Create new file: `lib/calculations/utils/projection.ts`

```typescript
import type { CompoundingMethod } from "@/types"

/**
 * Project final savings using monthly compounding
 * Single source of truth for all accumulation calculations
 *
 * @param currentSavings - Starting balance
 * @param monthlyContribution - Fixed monthly contribution amount
 * @param years - Number of years to project
 * @param contributionGrowth - Annual contribution escalation rate (decimal)
 * @param annualReturn - Annual return rate (decimal, net of fees)
 * @param compoundingMethod - 'nominal' for Excel FV compatibility, 'compound' for actuarial accuracy
 * @returns Projected balance after specified years
 */
export function projectFinalSavings(
  currentSavings: number,
  monthlyContribution: number,
  years: number,
  contributionGrowth: number,
  annualReturn: number,
  compoundingMethod: CompoundingMethod
): number {
  if (years <= 0) return currentSavings

  let totalSavings = currentSavings

  // Calculate monthly return based on compounding method
  const monthlyReturn = compoundingMethod === 'compound'
    ? Math.pow(1 + annualReturn, 1 / 12) - 1  // Actuarially correct: (1.12)^(1/12) - 1
    : annualReturn / 12  // Excel-compatible nominal: 12% / 12 = 1%

  for (let year = 0; year < years; year++) {
    for (let month = 0; month < 12; month++) {
      // Apply growth first (end-of-period contributions, matches Excel FV type=0)
      totalSavings *= 1 + monthlyReturn

      // Then add contribution (smooth escalation)
      const monthlyContributionAdjusted =
        monthlyContribution * Math.pow(1 + contributionGrowth, year + month / 12)
      totalSavings += monthlyContributionAdjusted
    }
  }

  return totalSavings
}

/**
 * Calculate monthly return from annual return
 * Exported for testing and debug purposes
 */
export function calculateMonthlyReturn(
  annualReturn: number,
  method: CompoundingMethod
): number {
  return method === 'compound'
    ? Math.pow(1 + annualReturn, 1 / 12) - 1
    : annualReturn / 12
}
```

2. Update all three files to import from shared utility:

```typescript
// lib/calculations/optimal-contribution.ts
import { projectFinalSavings } from "./utils/projection"

// Remove local projectFinalSavings function
// All calls remain the same
```

3. Verify build succeeds:
```bash
npm run build
```

4. Test with SA retirement validator agent

#### Success Criteria:
- ✅ All calculation files use same `projectFinalSavings`
- ✅ Build passes without errors
- ✅ Calculations produce identical results
- ✅ Debug window shows consistent values across tabs

---

### **Task 2: Enhance Debug Window** ⚡ CRITICAL

**Priority:** P0
**Estimated Time:** 20 minutes
**Impact:** Makes debugging and validation much easier

#### Steps:

1. Update `components/debug/debug-window.tsx` to show calculation details:

```typescript
// Add to debug output
const debugData = {
  // ... existing fields

  calculationDetails: {
    compoundingMethod: assumptions.compoundingMethod,
    compoundingMethodLabel: assumptions.compoundingMethod === 'nominal'
      ? 'Nominal (Excel-compatible)'
      : 'Compound (Actuarially correct)',

    // Show the actual formula being used
    monthlyReturnFormula: assumptions.compoundingMethod === 'compound'
      ? `(1 + ${weightedReturn.toFixed(4)})^(1/12) - 1 = ${calculateMonthlyReturn(weightedReturn, 'compound').toFixed(6)}`
      : `${weightedReturn.toFixed(4)} / 12 = ${(weightedReturn / 12).toFixed(6)}`,

    monthlyReturnValue: calculateMonthlyReturn(weightedReturn, assumptions.compoundingMethod),

    displayMode: displayMode,
    displayModeLabel: displayMode === 'real' ? "Today's Value (Real)" : "Future Value (Nominal)",

    // Calculation checksums for verification
    checksums: {
      totalAccounts: accounts.length,
      totalBalance: accounts.reduce((sum, acc) => sum + acc.currentBalance, 0),
      totalMonthlyContributions: accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0),
      weightedReturn: weightedReturn,
      weightedFees: weightedFees,
      netReturn: weightedReturn - weightedFees,
    },

    // Timestamp for debugging
    calculatedAt: new Date().toISOString(),
  }
}
```

2. Add visual indicator in debug window UI:

```tsx
<div className="rounded-lg border-2 border-primary/50 bg-primary/5 p-3">
  <div className="font-semibold text-primary">Calculation Method</div>
  <div className="mt-1 font-mono text-sm">
    {debugData.calculationDetails.compoundingMethodLabel}
  </div>
  <div className="mt-1 text-xs text-muted-foreground">
    Monthly return: {debugData.calculationDetails.monthlyReturnFormula}
  </div>
</div>
```

#### Success Criteria:
- ✅ Debug window clearly shows compounding method
- ✅ Displays actual monthly return calculation
- ✅ Shows display mode (real vs nominal)
- ✅ Includes calculation checksums

---

### **Task 3: Unit Tests for Core Calculations** 🔴 HIGH PRIORITY

**Priority:** P1
**Estimated Time:** 2-3 hours
**Impact:** Catches regressions and validates accuracy

#### Setup:

**Testing Stack (2026 Best Practices):**
- **Vitest** - Modern, fast test runner (Vite-native, Jest-compatible API)
- **React Testing Library** - Component testing with user-centric approach
- **@vitest/ui** - Browser-based UI for test results
- **@vitest/coverage-v8** - Native V8 coverage (faster than Istanbul)

1. Install testing dependencies:
```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

2. Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['lib/**/*.ts', 'components/**/*.tsx'],
      exclude: ['**/*.test.ts', '**/*.test.tsx', '**/types.ts'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
```

3. Create `tests/setup.ts`:
```typescript
import '@testing-library/jest-dom'
import { expect, afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Cleanup after each test
afterEach(() => {
  cleanup()
})
```

#### Test Files to Create:

**1. `lib/calculations/utils/__tests__/projection.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { projectFinalSavings, calculateMonthlyReturn } from '../projection'

describe('projectFinalSavings', () => {
  describe('Excel FV compatibility', () => {
    it('should match Excel FV with nominal method', () => {
      // Excel FV(1%,360,-1000,-100000,0) = R694,700
      const result = projectFinalSavings(
        100000,  // current savings
        1000,    // monthly contribution
        30,      // years
        0,       // no escalation
        0.12,    // 12% annual return
        'nominal'
      )

      expect(result).toBeCloseTo(694700, -2) // Within R100
    })

    it('should differ from nominal when using compound method', () => {
      const nominal = projectFinalSavings(100000, 1000, 30, 0, 0.12, 'nominal')
      const compound = projectFinalSavings(100000, 1000, 30, 0, 0.12, 'compound')

      // Compound should be lower (more accurate)
      expect(compound).toBeLessThan(nominal)

      // Difference should be approximately 0.6-0.7% per year over 30 years
      const percentDiff = ((nominal - compound) / nominal) * 100
      expect(percentDiff).toBeGreaterThan(15) // At least 15% lower
      expect(percentDiff).toBeLessThan(25) // But not more than 25% lower
    })
  })

  describe('edge cases', () => {
    it('should handle zero years', () => {
      const result = projectFinalSavings(100000, 1000, 0, 0, 0.12, 'nominal')
      expect(result).toBe(100000)
    })

    it('should handle zero starting balance', () => {
      const result = projectFinalSavings(0, 1000, 10, 0, 0.12, 'nominal')
      expect(result).toBeGreaterThan(0)
    })

    it('should handle zero contribution', () => {
      const result = projectFinalSavings(100000, 0, 10, 0, 0.12, 'nominal')
      expect(result).toBeGreaterThan(100000)
    })
  })

  describe('contribution escalation', () => {
    it('should increase contributions annually', () => {
      const noEscalation = projectFinalSavings(0, 1000, 10, 0, 0.12, 'nominal')
      const withEscalation = projectFinalSavings(0, 1000, 10, 0.06, 0.12, 'nominal')

      expect(withEscalation).toBeGreaterThan(noEscalation)
    })
  })
})

describe('calculateMonthlyReturn', () => {
  it('should use simple division for nominal method', () => {
    const result = calculateMonthlyReturn(0.12, 'nominal')
    expect(result).toBe(0.01) // 12% / 12 = 1%
  })

  it('should use compound formula for compound method', () => {
    const result = calculateMonthlyReturn(0.12, 'compound')
    expect(result).toBeCloseTo(0.009488793, 6) // (1.12)^(1/12) - 1
  })
})
```

**2. `lib/calculations/__tests__/optimal-contribution.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateOptimalContribution } from '../optimal-contribution'

describe('calculateOptimalContribution', () => {
  const baseParams = {
    currentSavings: 100000,
    personalInfo: {
      currentAge: 35,
      retirementAge: 65,
      lifeExpectancy: 90,
      annualIncome: 600000,
    },
    retirementGoals: {
      desiredMonthlyIncome: 30000,
      inflationRate: 5.5,
      legacyAmount: 0,
    },
    drawdownConfig: {
      strategy: 'fixed_percentage' as const,
      initialWithdrawalRate: 4,
      minimumWithdrawal: 15000,
      maximumWithdrawal: 60000,
    },
    expectedReturn: 0.12,
    fees: 0.01,
    contributionEscalation: 0.06,
  }

  it('should require lower contribution with compound method', () => {
    const nominal = calculateOptimalContribution({
      ...baseParams,
      compoundingMethod: 'nominal',
    })

    const compound = calculateOptimalContribution({
      ...baseParams,
      compoundingMethod: 'compound',
    })

    // Compound is more accurate, so should require slightly higher contribution
    // (because nominal overstates returns)
    expect(compound.optimalMonthlyContribution)
      .toBeGreaterThan(nominal.optimalMonthlyContribution)
  })

  it('should return zero contribution if already have enough', () => {
    const result = calculateOptimalContribution({
      ...baseParams,
      currentSavings: 10000000, // R10M should be enough
      compoundingMethod: 'nominal',
    })

    expect(result.optimalMonthlyContribution).toBe(0)
  })
})
```

**3. `components/debug/__tests__/debug-window.test.tsx`**

```typescript
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DebugWindow } from '../debug-window'

describe('DebugWindow', () => {
  it('should display compounding method', () => {
    // Setup store with nominal method
    const { container } = render(<DebugWindow projection={...} />)

    expect(container.textContent).toContain('Nominal (Excel-compatible)')
  })

  it('should show monthly return calculation', () => {
    const { container } = render(<DebugWindow projection={...} />)

    // Should show the formula used
    expect(container.textContent).toMatch(/0\.\d+ \/ 12/)
  })
})
```

#### Success Criteria:
- ✅ All tests pass
- ✅ Test coverage > 90% for calculation functions
- ✅ Tests validate both compounding methods
- ✅ Tests catch known Excel FV results

---

### **Task 4: Cross-Tab Consistency Tests** 🔴 HIGH PRIORITY

**Priority:** P1
**Estimated Time:** 1-2 hours
**Impact:** Ensures all tabs show consistent values

#### Test File:

**`tests/integration/cross-tab-consistency.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { calculateProjection } from '@/lib/calculations/projection-engine'
import { calculateOptimalContribution } from '@/lib/calculations/optimal-contribution'
import { compareScenarios } from '@/lib/calculations/scenario-comparison'
import { runMonteCarloSimulation } from '@/lib/monte-carlo/simulation-engine'

describe('Cross-tab consistency', () => {
  const testAccounts = [
    {
      id: '1',
      name: 'Test RA',
      type: 'retirement_annuity' as const,
      currentBalance: 100000,
      monthlyContribution: 3000,
      expectedReturn: 12,
      annualFees: 1,
      contributionEscalation: 6,
    }
  ]

  const testPersonalInfo = {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  }

  const testRetirementGoals = {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  }

  const testDrawdownConfig = {
    strategy: 'fixed_percentage' as const,
    initialWithdrawalRate: 4,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
  }

  const testAssumptions = {
    equityReturn: 12,
    bondReturn: 8,
    cashReturn: 6,
    equityVolatility: 16,
    bondVolatility: 8,
    inflationRate: 5.5,
    compoundingMethod: 'nominal' as const,
  }

  it('projection and insights should agree on nest egg at retirement', () => {
    const projection = calculateProjection(
      testAccounts,
      testPersonalInfo,
      testRetirementGoals,
      testDrawdownConfig,
      testAssumptions
    )

    const optimal = calculateOptimalContribution({
      currentSavings: 100000,
      personalInfo: testPersonalInfo,
      retirementGoals: testRetirementGoals,
      drawdownConfig: testDrawdownConfig,
      expectedReturn: 0.12,
      fees: 0.01,
      contributionEscalation: 0.06,
      compoundingMethod: 'nominal',
    })

    // Both should calculate similar nest eggs
    // (may not be exactly equal due to different contribution paths)
    const diff = Math.abs(projection.portfolioAtRetirement - optimal.projectedNestEgg)
    const percentDiff = (diff / projection.portfolioAtRetirement) * 100

    expect(percentDiff).toBeLessThan(5) // Within 5%
  })

  it('monte carlo should use same parameters as deterministic projection', () => {
    const projection = calculateProjection(
      testAccounts,
      testPersonalInfo,
      testRetirementGoals,
      testDrawdownConfig,
      testAssumptions
    )

    const simulation = runMonteCarloSimulation(
      testAccounts,
      testPersonalInfo,
      testRetirementGoals,
      testDrawdownConfig,
      { numberOfRuns: 100 },
      testAssumptions
    )

    // Monte Carlo median should be reasonably close to deterministic
    const medianFinalBalance = simulation.percentiles[50]
    const percentDiff = Math.abs(
      (medianFinalBalance - projection.surplusAmount) / projection.surplusAmount
    ) * 100

    expect(percentDiff).toBeLessThan(20) // Within 20% due to randomness
  })
})
```

#### Success Criteria:
- ✅ All cross-tab tests pass
- ✅ Debug window matches projection summary
- ✅ Insights tab matches main calculations
- ✅ Monte Carlo uses same compounding method

---

### **Task 5: Display Mode Tests** 🟡 MEDIUM PRIORITY

**Priority:** P2
**Estimated Time:** 1 hour

Create snapshot tests for display mode toggles to ensure all currency values update correctly.

---

### **Task 6: Validation Script** 🟡 MEDIUM PRIORITY

**Priority:** P2
**Estimated Time:** 1 hour

Create automated script to validate debug output and catch inconsistencies.

---

## Testing Commands

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest --coverage",
    "test:watch": "vitest --watch"
  }
}
```

---

## Validation Workflow

### Before Committing:
1. Run unit tests: `npm test`
2. Check coverage: `npm run test:coverage`
3. Run build: `npm run build`
4. Manual validation with SA retirement validator agent

### After Major Changes:
1. Run full test suite
2. Test with debug window open
3. Verify all tabs show consistent values
4. Check with multiple compounding methods
5. Validate with known Excel FV scenarios

---

## Success Metrics

- ✅ **No duplicate calculation functions**
- ✅ **>90% test coverage on core calculations**
- ✅ **All cross-tab consistency tests pass**
- ✅ **Debug window shows compounding method and checksums**
- ✅ **CI/CD pipeline runs tests automatically**
- ✅ **Documentation updated with testing approach**

---

## Next Steps

1. **Week 1:** Complete P0 tasks (consolidation + debug window)
2. **Week 2:** Complete P1 tasks (unit tests + integration tests)
3. **Week 3:** Complete P2 tasks (display mode tests + validation script)
4. **Ongoing:** Maintain tests as new features are added

---

## Notes

- Use SA retirement validator agent for complex scenarios
- Consider property-based testing for mathematical invariants
- Keep test data realistic (SA-specific values)
- Document any test failures and resolutions
