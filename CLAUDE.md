# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

**Critical for Accuracy:** All calculation changes must include tests and validation.

### Testing Strategy
- **Unit Tests:** Individual calculation functions (Vitest)
- **Integration Tests:** Cross-tab consistency
- **Manual Validation:** SA retirement validator agent for complex scenarios

### Before Committing Calculation Changes
1. Add/update unit tests for changed functions
2. Run `npm run test:coverage` - ensure >90% coverage
3. Run `npm run build` - verify no TypeScript errors
4. Use SA retirement validator agent to verify results
5. Check Debug Window shows correct compounding method and values

### Key Calculation Files
- `lib/calculations/utils/projection.ts` - **Single source of truth** for `projectFinalSavings`
- `lib/calculations/projection-engine.ts` - Main deterministic projection
- `lib/monte-carlo/simulation-engine.ts` - Monte Carlo simulations
- All calculations must respect `assumptions.compoundingMethod` setting

### Common Pitfalls
- ❌ Don't duplicate `projectFinalSavings` - import from shared utility
- ❌ Don't hardcode `monthlyReturn = annualReturn / 12` - use compounding method
- ❌ Don't forget to include `assumptions` in useMemo dependencies
- ❌ Don't use local formatCurrency - import from `lib/utils/currency`

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
