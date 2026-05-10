# Section 11F Excess Contribution Credit (2026-05-10)

## What changed

Implemented carry-forward credit tracking for SA pension/RA/preservation contributions that exceed the annual Section 11F deduction limit (`min(income × 27.5%, R430k)`).

## Why

Previously the calculator detected over-limit contributions (`isOverLimit`) but did nothing with them. High earners contributing above R430k/year were having their retirement lump sum and annuity income taxed as if no disallowed contributions existed — overstating their retirement tax liability. The Section 11F credit is a meaningful real-world benefit (potentially hundreds of thousands of Rands in tax reduction at retirement) that should be reflected in projections.

## Key design decisions

- **Income escalated with inflation each year** in the accumulation loop (`effectiveIncome = annualIncome × (1 + inflationRate)^year`). This keeps the deduction limit growing in nominal terms alongside escalating contributions — a static income would create a false and growing excess for users well below the R430k cap.
- **Credit reduces taxable lump sum, not tax directly**. `taxableLumpSum = grossLumpSum - credit`. Tax is then calculated on the reduced amount. This matches SA law (the credit is a deduction from the taxable amount, not a direct rebate).
- **Credit does NOT offset CGT or TFSA income** — only pension/RA/preservation annuity income, per SA legislation.
- **Full gross lump sum used as offset target** (not just the pension-type fraction). Simplification since the engine applies the lump sum proportionally; documented as a known limitation.
- **`calculateLumpSumCommutation` backward-compatible** — `accumulatedExcessCredit` defaults to 0, all existing call sites unaffected.

## Files changed

- `lib/calculations/retirement-tax.ts` — new `calculateExcessContributionCredit()`, updated `calculateLumpSumCommutation()`
- `lib/calculations/projection-engine.ts` — accumulation loop tracks `yearlyPensionContributions`, accumulates credit; lump sum call passes credit; drawdown applies `creditRemaining` annually
- `types/projections.ts` — new fields on `LumpSumCommutationResult`, `YearlyProjection`, `ProjectionResult`
- `components/results/calculations-breakdown.tsx` — Section 11F credit panel in RA Optimisation accordion (over-limit state)
- `lib/calculations/retirement-tax.test.ts` + `lib/calculations/__tests__/projection-engine.test.ts` — 16 new tests
