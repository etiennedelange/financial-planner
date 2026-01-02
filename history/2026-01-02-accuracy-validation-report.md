# Retirement Calculator Accuracy Validation Report

**Date:** 2026-01-02
**Validator:** sa-retirement-calc-validator agent

## Executive Summary

The calculator demonstrates **sound actuarial principles** with appropriate SA-specific defaults. All core calculations are accurate and the Excel FV convention is correctly implemented.

---

## Validation Results

| Category | Status | Notes |
|----------|--------|-------|
| Monte Carlo Simulation | PASS with warnings | No asset correlation; no seed implementation |
| SA Tax Calculations | PASS | Tax tables correct; validation not enforced on input |
| Projection Calculations | PASS | Excel FV convention correctly implemented |
| SA Financial Assumptions | PASS | All defaults within appropriate SA ranges |
| Excel FV Convention | PASS | Simple division (rate/12), end-of-period contributions |

---

## 1. Monte Carlo Simulation

### Correct Implementation:
- **1,000 runs** - meets minimum threshold
- **Log-normal distribution** with volatility drag adjustment
- **Box-Muller transform** for standard normal random generation
- **Correct percentile calculation** with linear interpolation
- **Success defined** as balance > 0 at life expectancy

### Verified Formulas:
```typescript
// Box-Muller transform (CORRECT)
const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

// Log-normal return with volatility drag (CORRECT)
const logMean = Math.log(1 + expectedReturn) - (volatility * volatility) / 2
```

### Warnings:
1. No correlation modeling between asset classes
2. Random seed option not implemented for reproducibility

---

## 2. SA Tax Calculations (2024/2025)

| Parameter | Code Value | SARS 2024/25 | Status |
|-----------|------------|--------------|--------|
| Pension/RA deduction rate | 27.5% | 27.5% | CORRECT |
| Pension/RA max deduction | R350,000 | R350,000 | CORRECT |
| TFSA annual limit | R36,000 | R36,000 | CORRECT |
| TFSA lifetime limit | R500,000 | R500,000 | CORRECT |
| Primary rebate (under 65) | R17,235 | R17,235 | CORRECT |
| Secondary rebate (65-74) | R9,444 | R9,444 | CORRECT |
| Tertiary rebate (75+) | R3,145 | R3,145 | CORRECT |

### Retirement Lump Sum Tax Table: CORRECT
- First R550,000 tax-free
- 18% on R550,001 - R770,000
- 27% on R770,001 - R1,100,000
- 36% on amounts above R1,100,000

### Warning:
Tax limit validation not enforced on contribution inputs - users could enter unrealistic values.

---

## 3. Projection Calculations

### Excel FV Convention Implementation: CORRECT
```typescript
// Monthly rate - simple division (matches Excel)
const monthlyReturn = netReturn / 12

// End-of-period contributions (type=0)
for (let month = 0; month < 12; month++) {
  const monthGrowth = totalBalance * monthlyReturn
  totalBalance += monthGrowth           // Growth first
  totalBalance += monthlyContribution   // Then contribution
}
```

### Consistent Across All Files:
- `projection-engine.ts`
- `cost-of-delay.ts`
- `optimal-contribution.ts`
- `calculations-breakdown.tsx`

### Note:
Fees use compound conversion while returns use simple division - slightly conservative (overstates fees).

---

## 4. SA Financial Assumptions

| Parameter | Code Value | SA Range | Assessment |
|-----------|------------|----------|------------|
| Inflation | 5.5% | 4.5%-6.5% | APPROPRIATE |
| Equity return | 11% | 10%-12% | APPROPRIATE |
| Bond return | 8% | 7%-9% | APPROPRIATE |
| Cash return | 6.5% | 5.5%-7% | APPROPRIATE |
| Equity volatility | 16.5% | 15%-18% | APPROPRIATE |
| Safe withdrawal rate | 3.5% | 3%-4% | CONSERVATIVE |
| Medical inflation | 9% | 8%-10% | APPROPRIATE |
| Life expectancy | 90 | 85-95 | CONSERVATIVE |
| Contribution escalation | 6% | 5%-7% | APPROPRIATE |

---

## Recommendations for Future Implementation

1. **Add contribution limit validation**
   - TFSA: R36k/year, R500k lifetime
   - RA/Pension: 27.5%, R350k cap

2. **Implement living annuity drawdown bounds**
   - SA regulations: 2.5% - 17.5%

3. **Consider one-third/two-thirds rule**
   - Max 1/3 lump sum, 2/3 must purchase annuity for pension/RA

4. **Add asset class correlation** to Monte Carlo for multi-asset portfolios

5. **Align fee calculation methodology** with return calculation

6. **Add unit tests** for calculation functions

---

## Files Reviewed

- `/lib/calculations/projection-engine.ts`
- `/lib/monte-carlo/simulation-engine.ts`
- `/lib/monte-carlo/random-returns.ts`
- `/lib/constants/defaults.ts`
- `/lib/constants/limits.ts`
- `/lib/constants/tax-tables.ts`
- `/lib/calculations/cost-of-delay.ts`
- `/lib/calculations/optimal-contribution.ts`
- `/lib/calculations/medical-costs.ts`
- `/components/results/calculations-breakdown.tsx`
- `/components/accounts/account-form.tsx`

---

## Overall Assessment

The calculator is **actuarially sound** for South African retirement planning. Core calculations are accurate, SA-specific parameters are appropriate, and Excel FV convention is correctly implemented. Recommendations enhance regulatory compliance but are not critical defects.
