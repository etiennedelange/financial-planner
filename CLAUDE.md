# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## ⚠️ Critical Rule: Test-Driven Development

**ALL calculation code changes MUST include unit tests. No calculation code should be committed without tests.**

See [Testing & Validation](#testing--validation) section below for requirements.

## Project Overview

South African retirement planning calculator with Monte Carlo simulations, multi-account portfolio management, and SA-specific tax treatment. Built with Next.js, TypeScript, shadcn/ui, and Supabase.

## Development Commands

```bash
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run lint             # Run ESLint
npm run test             # Run tests (Vitest)
npm run test:ui          # Open Vitest UI in browser
npm run test:coverage    # Generate coverage report
npm run test:watch       # Run tests in watch mode
```

## Development Environment

Devcontainer-based setup with Node 20 LTS. Ports:
- 3000: Next.js application
- 54321: Supabase API
- 54323: Supabase Studio

## South African Financial Defaults

These are critical domain values for calculations:
- Inflation: 5.5% p.a.
- Equity return: 10-12% p.a. (nominal)
- Bond return: 7-9% p.a. (nominal)
- Equity volatility: 15-18% std dev
- Safe withdrawal rate: 3-5%
- Life expectancy: 90 years

### Tax Limits (2024/2025)
- Pension/RA deduction: 27.5% of income, max R350,000 p.a.
- TFSA: R36,000 annual, R500,000 lifetime

## Account Types

Supported retirement account types:
- Pension Funds
- Retirement Annuities (RAs)
- Preservation Funds
- Tax-Free Savings Accounts (TFSA)
- Discretionary Investment Accounts

## Key Features

- Monte Carlo simulations (1,000-10,000 runs)
- Multiple account management with individual tracking
- Drawdown strategies (4% rule, dynamic withdrawal)
- What-if scenario analysis
- PDF/CSV export

## Testing & Validation

**MANDATORY:** All calculation changes MUST include unit tests. No exceptions.

### Testing Requirements

**When adding/modifying calculation code:**
1. ✅ **Write tests FIRST** (or alongside implementation)
2. ✅ **Add tests to corresponding `.test.ts` file** (create if doesn't exist)
3. ✅ **Cover edge cases:** zero values, R0 contributions, 0% escalation, negative years
4. ✅ **Test both compounding methods:** nominal and compound
5. ✅ **Verify against known values:** use Excel FV or manual calculations
6. ✅ **Maintain >90% coverage** for calculation files

**Example test file location:**
- `lib/calculations/utils/projection.ts` → `lib/calculations/utils/projection.test.ts`
- `lib/monte-carlo/simulation-engine.ts` → `lib/monte-carlo/simulation-engine.test.ts`

### Testing Strategy
- **Unit Tests:** Individual calculation functions (Vitest) - **REQUIRED**
- **Integration Tests:** Cross-tab consistency - **RECOMMENDED**
- **Manual Validation:** SA retirement validator agent for complex scenarios - **RECOMMENDED**

### Before Committing Calculation Changes
1. ✅ **Write/update unit tests for changed functions** (MANDATORY)
2. ✅ **Run `npm run test`** - all tests must pass
3. ✅ **Run `npm run test:coverage`** - ensure >90% coverage on modified files
4. ✅ **Run `npm run build`** - verify no TypeScript errors
5. ✅ **Check Debug Window** - verify correct compounding method and values
6. ⚠️ **Optional but recommended:** Use SA retirement validator agent for complex scenarios

### Key Calculation Files
- `lib/calculations/utils/projection.ts` - **Single source of truth** for `projectFinalSavings`
- `lib/calculations/projection-engine.ts` - Main deterministic projection
- `lib/monte-carlo/simulation-engine.ts` - Monte Carlo simulations
- All calculations must respect `assumptions.compoundingMethod` setting

### Test Structure Template

Follow this pattern for calculation tests (see `projection.test.ts` as reference):

```typescript
describe('functionName', () => {
  describe('Critical SA scenarios', () => {
    it('should handle TFSA at R500k limit (R0 contributions)', () => {
      // Test accounts with existing balance but no new contributions
    })

    it('should handle old pension fund (R0 contributions, 0% escalation)', () => {
      // Test accounts no longer receiving contributions
    })
  })

  describe('Compounding methods', () => {
    it('nominal method: should match Excel FV formula', () => {})
    it('compound method: should use actuarial compounding', () => {})
  })

  describe('Edge cases', () => {
    it('should handle zero years', () => {})
    it('should handle zero balance with contributions', () => {})
    it('should handle zero balance and zero contributions', () => {})
  })
})
```

### Common Pitfalls
- ❌ Don't duplicate `projectFinalSavings` - import from shared utility
- ❌ Don't hardcode `monthlyReturn = annualReturn / 12` - use compounding method
- ❌ Don't forget to include `assumptions` in useMemo dependencies
- ❌ Don't use local formatCurrency - import from `lib/utils/currency`
- ❌ **Don't modify calculation code without adding tests**
- ❌ **Don't skip edge case testing** (R0 contributions, 0% escalation, etc.)

### Debug Window
The Debug Window (`components/debug/debug-window.tsx`) is the source of truth for verifying:
- Which compounding method is active
- Actual monthly return being used in calculations
- Weighted portfolio metrics
- Display mode (real vs nominal)

Always check the Debug Window after making calculation changes to ensure all tabs show consistent values.

## Documentation

- **Phase Planning:** `history/project-phases.md`
- **Testing Plan:** `history/testing-and-validation-plan.md`
- **Calculation Changes:** Document in `history/` with date-prefixed markdown files
