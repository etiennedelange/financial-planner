# Display Mode Consistency and Lump Sum Bug Fixes (2026-04-27)

## Display Mode in Calculations Breakdown

**Problem:** `calculations-breakdown.tsx` had its own local `formatCurrency` that ignored the user's nominal/real toggle entirely — all values were always shown as future (nominal) amounts.

**Fix:**
- Removed local `formatCurrency`; imported from `lib/utils/currency`
- Added `displayMode` to store reads
- Hoisted `inflationRate` and `yearsToRetirement` to component scope
- Created local `fmt(value, yearsFromNow)` helper capturing `displayMode` and `inflationRate`
- Applied correct `yearsFromNow` per context:
  - `0` — current balance, contributions, SARS constants (rebates, thresholds)
  - `yearsToRetirement` — portfolio at retirement, monthly income, lump sum amounts, lifetime tax totals, payslip values
  - `proj.age - currentAge` — every row in the accumulation, drawdown, and tax projection tables

## Lump Sum Payslip Bug

**Problem:** `monthlyIncomeAtRetirement` in `projection-engine.ts` was passed `portfolioAtRetirement` (the full portfolio before the lump sum is taken). The actual drawdown loop correctly used `remainingPortfolio`, so the payslip overstated income when `lumpSumPercentage > 0`.

**Fix:** Changed `calculateInitialWithdrawal` call to use `remainingPortfolio`.

## Lump Sum Monte Carlo Bug

**Problem:** `simulateSingleRun` in `simulation-engine.ts` had no knowledge of `lumpSumPercentage`. All simulations ran the full portfolio through drawdown, making success rates artificially optimistic when a lump sum was configured.

**Fix:**
- Added `lumpSumPercentage` parameter to `simulateSingleRun`
- After accumulation, `balance = portfolioAtRetirement × (1 - lumpSumPercentage/100)` before the initial withdrawal is calculated
- Fixed weighted return calculation to use `portfolioAtRetirement` for account weight denominators (previously used the post-lump-sum `balance`, which was incorrect)
- `runMonteCarloSimulation` passes `drawdownConfig.lumpSumPercentage ?? 0` through to the run
