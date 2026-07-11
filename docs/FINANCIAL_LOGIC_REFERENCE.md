# SA Retirement Calculator — Complete Financial Logic Reference

> **Purpose:** Portable, exact reference for reimplementing all financial planning rules, formulas,
> and constants in a new project. Every rule is extracted directly from source code.
> Incorrect retirement projections have real consequences — no simplifications.

---

## Table of Contents

1. [SA Tax Year Configuration (2026/2027)](#1-sa-tax-year-configuration-20262027)
2. [Financial Planning Defaults](#2-financial-planning-defaults)
3. [Type Definitions](#3-type-definitions)
4. [Account Types and Rules](#4-account-types-and-rules)
5. [Core Accumulation Formula](#5-core-accumulation-formula)
6. [Full Deterministic Projection Engine](#6-full-deterministic-projection-engine)
7. [Monte Carlo Simulation](#7-monte-carlo-simulation)
8. [Investment Scenarios](#8-investment-scenarios)
9. [Optimal Contribution (Binary Search)](#9-optimal-contribution-binary-search)
10. [Section 11F RA Optimization](#10-section-11f-ra-optimization)
11. [Medical Cost Projection](#11-medical-cost-projection)
12. [Spending Phase Model (Go-Go / Slow-Go / No-Go)](#12-spending-phase-model)
13. [Cost of Delay](#13-cost-of-delay)
14. [Replacement Ratio](#14-replacement-ratio)
15. [Drawdown Strategies](#15-drawdown-strategies)
16. [Critical Validation Rules](#16-critical-validation-rules)
17. [Annual Tax Year Update Checklist](#17-annual-tax-year-update-checklist)

---

## 1. SA Tax Year Configuration (2026/2027)

> Update annually from the SARS Budget Tax Guide.
> Source: https://www.sars.gov.za/wp-content/uploads/Docs/Budget/Budget2026/Budget-tax-guide-2026-web-version.pdf

### 1.1 Income Tax Brackets

Each bracket stores its lower bound (`min`), upper bound (`max`), marginal rate, and the
pre-calculated tax at the bracket's lower bound (`baseTax`).

| min (R) | max (R) | rate | baseTax (R) |
|---|---|---|---|
| 0 | 245,100 | 18% | 0 |
| 245,100 | 383,100 | 26% | 44,118 |
| 383,100 | 530,200 | 31% | 79,998 |
| 530,200 | 695,800 | 36% | 125,599 |
| 695,800 | 887,000 | 39% | 185,215 |
| 887,000 | 1,878,600 | 41% | 259,783 |
| 1,878,600 | ∞ | 45% | 666,339 |

**Formula:**
```
tax = baseTax + (taxableIncome - bracketMin) × marginalRate
```

**Implementation:**
```typescript
function calculateIncomeTax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0
  const brackets = [
    { min: 0,       max: 245100,   rate: 0.18, baseTax: 0      },
    { min: 245100,  max: 383100,   rate: 0.26, baseTax: 44118  },
    { min: 383100,  max: 530200,   rate: 0.31, baseTax: 79998  },
    { min: 530200,  max: 695800,   rate: 0.36, baseTax: 125599 },
    { min: 695800,  max: 887000,   rate: 0.39, baseTax: 185215 },
    { min: 887000,  max: 1878600,  rate: 0.41, baseTax: 259783 },
    { min: 1878600, max: Infinity, rate: 0.45, baseTax: 666339 },
  ]
  for (const bracket of brackets) {
    if (taxableIncome <= bracket.max) {
      return bracket.baseTax + (taxableIncome - bracket.min) * bracket.rate
    }
  }
  // Fallthrough: last bracket
  const last = brackets[brackets.length - 1]
  return last.baseTax + (taxableIncome - last.min) * last.rate
}
```

### 1.2 Retirement / Severance Lump Sum Tax Table

Applied to lump sums taken at retirement from pension/RA/preservation funds.
`threshold` = upper bound of tier; `previousTax` = cumulative tax at the previous threshold.

| threshold (R) | rate | previousTax (R) |
|---|---|---|
| 550,000 | 0% | 0 |
| 770,000 | 18% | 0 |
| 1,155,000 | 27% | 39,600 |
| ∞ | 36% | 143,550 |

**Implementation:**
```typescript
function calculateLumpSumTax(lumpSum: number): number {
  const table = [
    { threshold: 550000,  rate: 0,    previousTax: 0      },
    { threshold: 770000,  rate: 0.18, previousTax: 0      },
    { threshold: 1155000, rate: 0.27, previousTax: 39600  },
    { threshold: Infinity, rate: 0.36, previousTax: 143550 },
  ]
  if (lumpSum <= table[0].threshold) return 0
  for (let i = 1; i < table.length; i++) {
    if (lumpSum <= table[i].threshold) {
      return table[i].previousTax + (lumpSum - table[i - 1].threshold) * table[i].rate
    }
  }
  const last = table[table.length - 1]
  const secondLast = table[table.length - 2]
  return last.previousTax + (lumpSum - secondLast.threshold) * last.rate
}
```

### 1.3 Tax Rebates

Rebates are **direct reductions of tax payable**, not deductions from income.

| Age | Rebates applied | Total rebate (R) |
|---|---|---|
| Under 65 | Primary only | 17,820 |
| 65–74 | Primary + Secondary | 27,585 |
| 75+ | Primary + Secondary + Tertiary | 30,834 |

```
primaryRebate   = 17,820
secondaryRebate =  9,765   (added at age 65)
tertiaryRebate  =  3,249   (added at age 75)
```

**Age-based rebate selection:**
```typescript
function getRebate(age: number): number {
  if (age >= 75) return 17820 + 9765 + 3249  // 30,834
  if (age >= 65) return 17820 + 9765          // 27,585
  return 17820
}
```

**Net income tax (after rebate and optional medical credit):**
```typescript
function calculateIncomeTaxWithRebates(
  annualIncome: number,
  age: number,
  medicalAidDependants?: number   // omit to skip credit
): number {
  if (annualIncome <= 0) return 0
  const grossTax = calculateIncomeTax(annualIncome)
  const rebate = getRebate(age)
  const medicalCredit = medicalAidDependants !== undefined
    ? calculateMedicalAidTaxCredit(medicalAidDependants)
    : 0
  return Math.max(0, grossTax - rebate - medicalCredit)
}
```

### 1.4 Tax-Free Thresholds

Income below these thresholds results in zero net tax after rebates.

| Age | Threshold (R) |
|---|---|
| Under 65 | 99,000 |
| 65–74 | 153,250 |
| 75+ | 171,300 |

### 1.5 Pension / RA Contribution Deduction Limits (Section 11F)

```
deductionLimit = min(annualIncome × 0.275, 430,000)
```

- Rate: **27.5%** of the greater of remuneration or taxable income
- Annual rand cap: **R430,000**
- Income base escalates with inflation each projection year (see §6 accumulation)

### 1.6 TFSA Limits

| Limit | Value |
|---|---|
| Annual contribution limit | R46,000 per tax year (increased from R36,000 effective 1 March 2026) |
| Lifetime contribution limit | R500,000 |

**Critical rule:** The lifetime limit tracks *contributions only*, not investment growth. A TFSA
balance may legally exceed R500,000 if growth pushes it there.

### 1.7 Medical Aid Tax Credits (Section 6A)

These are **direct reductions of tax payable** (not income deductions).

| Beneficiary | Monthly credit (R) |
|---|---|
| Principal member | 376 |
| First additional beneficiary | 376 |
| Each further beneficiary | 254 |

```typescript
function calculateMedicalAidTaxCredit(dependants: number = 0): number {
  let monthlyCredit = 376                                  // principal
  if (dependants >= 1) monthlyCredit += 376               // first dependant
  if (dependants >= 2) monthlyCredit += 254 * (dependants - 1) // further
  return monthlyCredit * 12
}
```

| Dependants | Monthly (R) | Annual (R) |
|---|---|---|
| 0 | 376 | 4,512 |
| 1 | 752 | 9,024 |
| 2 | 1,006 | 12,072 |
| 3 | 1,260 | 15,120 |

---

## 2. Financial Planning Defaults

### Market Assumptions

| Parameter | Default |
|---|---|
| General inflation | 5.5% p.a. (0.055) |
| Medical inflation | 9.0% p.a. (0.09) — SA medical grows faster than general CPI |
| Equity return | 11.0% p.a. (0.11) |
| Bond return | 8.0% p.a. (0.08) |
| Cash return | 6.5% p.a. (0.065) |
| Equity volatility (std dev) | 16.5% (0.165) |
| Bond volatility (std dev) | 6.0% (0.06) |

### Planning Parameters

| Parameter | Default |
|---|---|
| Safe withdrawal rate | 3.5% (more conservative for SA conditions) |
| Life expectancy | 90 years |
| Contribution escalation | 6% p.a. |
| Base monthly medical cost (today's Rands) | R3,500 |
| Additional medical cost per year of age over 65 | +2% per year |
| Default current age | 35 |
| Default retirement age | 65 |

### New Account Defaults

| Parameter | Default |
|---|---|
| Expected annual return | 10% |
| Annual fees | 1% |
| Contribution escalation | 6% |

### Application Defaults

| Parameter | Default |
|---|---|
| Default compounding method | `nominal` (Excel-compatible; backward-compat) |
| Default drawdown strategy | `fixed_percentage` at 3.5% |
| Default annual income | R600,000 |
| Desired monthly retirement income | R30,000 |
| Minimum monthly withdrawal | R15,000 |
| Maximum monthly withdrawal | R60,000 |

---

## 3. Type Definitions

```typescript
// ─── Account ────────────────────────────────────────────────────────────────

type AccountType =
  | 'pension_fund'
  | 'retirement_annuity'
  | 'preservation_fund'
  | 'tfsa'
  | 'discretionary'

interface Account {
  id: string
  name: string
  provider: string
  type: AccountType
  currentBalance: number          // Rands
  monthlyContribution: number     // Rands
  expectedReturn: number          // annual %, e.g. 10 for 10%
  annualFees: number              // %, e.g. 1 for 1%
  contributionEscalation: number  // annual %, e.g. 6 for 6%
  tfsaContributionsToDate?: number // TFSA only: cumulative contributions (NOT balance)
}

// ─── Inputs ─────────────────────────────────────────────────────────────────

interface PersonalInfo {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  annualIncome: number  // for tax calculation purposes
}

interface RetirementGoals {
  desiredMonthlyIncome: number  // today's Rands
  inflationRate: number         // annual %
  legacyAmount: number          // desired inheritance
}

type CompoundingMethod = 'nominal' | 'compound'

interface MarketAssumptions {
  equityReturn: number        // nominal annual %
  bondReturn: number
  cashReturn: number
  equityVolatility: number    // standard deviation %
  bondVolatility: number
  inflationRate: number
  compoundingMethod: CompoundingMethod
}

type DrawdownStrategy =
  | 'fixed_percentage'
  | 'fixed_amount_inflation_adjusted'
  | 'variable_percentage'
  | 'guardrails'

interface DrawdownConfig {
  strategy: DrawdownStrategy
  initialWithdrawalRate: number   // % of portfolio
  minimumWithdrawal: number       // monthly floor in today's Rands
  maximumWithdrawal: number       // monthly ceiling in today's Rands
  lumpSumPercentage: number       // % of portfolio at retirement (0-100)
  monthlyMedicalAid?: number      // monthly contribution paid from retirement income
  medicalAidDependants?: number   // number of additional beneficiaries (0 = member only)
  upperGuardrail?: number         // guardrails: % above which to increase withdrawal
  lowerGuardrail?: number         // guardrails: % below which to decrease withdrawal
}

// ─── Projection output ───────────────────────────────────────────────────────

interface YearlyProjection {
  year: number                    // 1-based from first year of projection
  age: number
  startingBalance: number
  contributions: number           // accumulation phase only
  growth: number
  fees: number
  withdrawals: number             // gross withdrawal before tax
  incomeTax: number
  lumpSumTax: number              // one-time at retirement year
  medicalAidContribution: number  // annual cost paid from income
  netIncome: number               // withdrawals - incomeTax - medicalAidContribution
  endingBalance: number
  inflationAdjustedWithdrawal: number  // withdrawal in today's Rands
  // Drawdown phase only:
  tfsaWithdrawal?: number
  discretionaryWithdrawal?: number
  pensionWithdrawal?: number
  cgtTaxableAmount?: number       // gains × 40% CGT inclusion
  taxableIncome?: number          // pensionWithdrawal + cgtTaxableAmount
  accountBalances?: Record<string, number>
  excessCreditApplied?: number
  excessCreditRemaining?: number
}

interface LumpSumCommutationResult {
  lumpSumPercentage: number
  lumpSumAmount: number           // gross amount taken
  taxableLumpSum: number          // after excess credit reduction
  lumpSumTax: number
  netLumpSum: number
  remainingPortfolio: number
  accumulatedExcessCredit: number
  creditAppliedToLumpSum: number
  creditCarriedIntoDrawdown: number
}

interface ProjectionResult {
  yearlyProjections: YearlyProjection[]
  portfolioAtRetirement: number
  monthlyIncomeAtRetirement: number
  monthlyNetIncomeAtRetirement: number   // after tax
  portfolioDepletionAge: number | null   // null if never depletes
  shortfallAmount: number
  surplusAmount: number
  totalLifetimeIncomeTax: number
  totalLumpSumTax: number
  totalMedicalAidContributions: number
  averageEffectiveTaxRate: number
  lumpSumCommutation: LumpSumCommutationResult
  accumulatedExcessCredit: number
  accountBalancesAtRetirement: Record<string, number>
}

// ─── Simulation ──────────────────────────────────────────────────────────────

interface SimulationConfig {
  numberOfRuns: number   // typically 1000–10000
  randomSeed?: number    // for reproducibility
}

interface SimulationRun {
  runId: number
  yearlyBalances: number[]
  finalBalance: number
  depletionAge: number | null
  success: boolean             // balance > 0 at lifeExpectancy
  lifetimeIncomeTax?: number   // sum of annual income/CGT tax over drawdown, reporting only
  lumpSumTax?: number          // one-time tax on the retirement lump sum, reporting only
}

interface SimulationResult {
  runs: SimulationRun[]
  successRate: number    // % of successful runs
  percentiles: {
    p10: number[]        // balance per year across all runs at 10th percentile
    p25: number[]
    p50: number[]        // median
    p75: number[]
    p90: number[]
  }
  medianDepletionAge: number | null
  averageFinalBalance: number
  averageLifetimeIncomeTax?: number  // mean of SimulationRun.lifetimeIncomeTax across runs
  averageLumpSumTax?: number         // mean of SimulationRun.lumpSumTax across runs
}
```

---

## 4. Account Types and Rules

| Type Key | Label | Tax Treatment at Withdrawal |
|---|---|---|
| `pension_fund` | Pension Fund | Full income tax (PAYE on annuity) |
| `retirement_annuity` | Retirement Annuity (RA) | Full income tax (PAYE on annuity) |
| `preservation_fund` | Preservation Fund | Full income tax (PAYE on annuity) |
| `tfsa` | Tax-Free Savings Account | Zero — completely tax-free |
| `discretionary` | Discretionary Investment | CGT at 40% inclusion rate on gains only |

**Pension types** (for Section 11F and drawdown tax sequencing):
```typescript
const PENSION_TYPES = ['pension_fund', 'retirement_annuity', 'preservation_fund']
```

### TFSA Contribution Enforcement

Applied every month during the accumulation loop:

```typescript
// Reset tfsaYearlyUsed to 0 at the start of each projection year
const remainingLifetime = Math.max(0, 500_000 - tfsaLifetimeUsed)
const remainingAnnual   = Math.max(0, 46_000  - tfsaYearlyUsed)
const actualContribution = Math.min(rawContribution, remainingLifetime, remainingAnnual)
tfsaLifetimeUsed += actualContribution
tfsaYearlyUsed   += actualContribution
```

`tfsaContributionsToDate` seeds `tfsaLifetimeUsed` at the start (tracks historical contributions
the user already made before the projection begins).

### Section 11F — Which Account Types Qualify

Only `pension_fund`, `retirement_annuity`, and `preservation_fund` accumulate excess credit.
TFSA and discretionary contributions are excluded.

---

## 5. Core Accumulation Formula

### `projectFinalSavings` — single source of truth

```typescript
function projectFinalSavings(
  currentSavings: number,
  monthlyContribution: number,
  years: number,
  contributionGrowth: number,   // decimal, e.g. 0.06 for 6%
  annualReturn: number,          // decimal, NET of fees
  compoundingMethod: 'nominal' | 'compound'
): number {
  if (years <= 0) return currentSavings
  let total = currentSavings
  const monthlyReturn = calculateMonthlyReturn(annualReturn, compoundingMethod)
  for (let year = 0; year < years; year++) {
    for (let month = 0; month < 12; month++) {
      total *= 1 + monthlyReturn                                        // growth first
      total += monthlyContribution * Math.pow(1 + contributionGrowth, year + month / 12)
    }
  }
  return total
}
```

**Key invariants:**
- Growth is applied *before* contribution each month (end-of-period, matches Excel `FV(type=0)`)
- Contribution escalation uses continuous fractional exponentiation — smooth, not step-wise
- `annualReturn` must already be net of fees before passing in

### Compounding Methods

```typescript
function calculateMonthlyReturn(annualReturn: number, method: 'nominal' | 'compound'): number {
  return method === 'compound'
    ? Math.pow(1 + annualReturn, 1 / 12) - 1   // actuarially correct: (1+r)^(1/12) - 1
    : annualReturn / 12                          // Excel-compatible nominal: r / 12
}
```

| Method | Formula | Effective annual at 12% nominal |
|---|---|---|
| `nominal` | r / 12 = 1% / month | 12.68% (overstates slightly) |
| `compound` | (1+r)^(1/12) - 1 ≈ 0.9489% / month | exactly 12% |

Default is `nominal` for backward compatibility. `compound` is more accurate.

### Contribution Escalation — Continuous, Not Step-Wise

```
contribution at month = baseMonthly × (1 + escalationRate)^(year + month/12)
```

This produces smooth, proportional growth throughout the year, not a sudden annual jump.
At year=0, month=0: contribution = baseMonthly × 1.0 (no change yet).
At year=1, month=0: contribution = baseMonthly × (1 + 0.06)^1.0 = baseMonthly × 1.06.

---

## 6. Full Deterministic Projection Engine

### Inputs

```
accounts[]         — per-account balance, contribution, return, fees, escalation
personalInfo       — currentAge, retirementAge, lifeExpectancy, annualIncome
retirementGoals    — desiredMonthlyIncome (today's Rands), inflationRate (%)
drawdownConfig     — strategy, rates, lumpSumPercentage, medicalAid settings
assumptions        — compoundingMethod (optional, default 'nominal')
```

### Weighted Aggregates (used for portfolio-level display, not per-account growth)

```typescript
// Weighted by currentBalance; if balance=0 weight by monthlyContribution instead
weightedReturn = Σ (acc.expectedReturn/100) × (acc.balance / totalBalance)
weightedFees   = Σ (acc.annualFees/100)    × (acc.balance / totalBalance)
netReturn      = weightedReturn - weightedFees
```

### Phase 1 — Accumulation (currentAge → retirementAge)

Each account is projected **independently** with its own return and fee rates.
The accumulation loop mirrors `projectFinalSavings` but tracks per-account state for:
- TFSA limit enforcement
- CGT cost basis tracking (discretionary)
- Section 11F excess credit accumulation (pension types)

```
for year = 0 to yearsToRetirement - 1:
  reset tfsaYearlyUsed[each account] = 0

  for each account:
    accNetReturn    = (expectedReturn - annualFees) / 100
    accMonthlyReturn = calculateMonthlyReturn(accNetReturn, compoundingMethod)
    accMonthlyFeeRate = (1 + annualFees/100)^(1/12) - 1   // for fee reporting only

    for month = 0 to 11:
      rawContrib = monthlyContribution × (1 + escalation)^(year + month/12)

      if TFSA:
        actualContrib = min(rawContrib, remainingLifetime, remainingAnnual)
        update tfsaLifetimeUsed, tfsaYearlyUsed

      growth = balance × accMonthlyReturn
      fees   = balance × accMonthlyFeeRate
      balance += growth
      balance += actualContrib
      costBasis += actualContrib    // discretionary only

  // Section 11F credit (after all months in this year):
  effectiveIncome = annualIncome × (1 + inflationRate)^year
  deductionLimit  = min(effectiveIncome × 0.275, 430_000)
  excessCredit    = max(0, yearlyPensionContributions - deductionLimit)
  accumulatedExcessCredit += excessCredit
```

### Phase 2 — Lump Sum Commutation at Retirement

```typescript
function calculateLumpSumCommutation(
  portfolioValue: number,
  lumpSumPercentage: number,           // 0-100, clamped
  accumulatedExcessCredit: number = 0
) {
  const pct = Math.max(0, Math.min(100, lumpSumPercentage))
  const lumpSumAmount = portfolioValue * (pct / 100)

  // Excess credit reduces taxable portion of lump sum
  const creditApplied   = Math.min(accumulatedExcessCredit, lumpSumAmount)
  const taxableLumpSum  = lumpSumAmount - creditApplied
  const lumpSumTax      = calculateLumpSumTax(taxableLumpSum)
  const netLumpSum      = lumpSumAmount - lumpSumTax
  const remainingPortfolio = portfolioValue - lumpSumAmount

  return {
    lumpSumAmount, taxableLumpSum, lumpSumTax, netLumpSum,
    remainingPortfolio, accumulatedExcessCredit,
    creditAppliedToLumpSum: creditApplied,
    creditCarriedIntoDrawdown: accumulatedExcessCredit - creditApplied,
  }
}
```

**Lump sum deducted proportionally from each account:**
```
lumpSumFraction  = lumpSumAmount / portfolioAtRetirement
account.balance *= (1 - lumpSumFraction)
account.costBasis *= (1 - lumpSumFraction)   // discretionary
```

### Phase 3 — Drawdown (retirementAge → lifeExpectancy)

Annual loop (not monthly) for performance. Growth applied at end-of-year before withdrawal.

#### 3a. Annual Account Growth

```typescript
for each drawdownAccount:
  growth = balance × netReturn    // netReturn = (expectedReturn - annualFees) / 100
  balance += growth
```

#### 3b. Tax-Optimized Withdrawal Order

```
1. TFSA           — fully tax-free
2. Discretionary  — CGT on gains only (40% inclusion rate)
3. Pension / RA / Preservation — full income tax
```

```typescript
// Target withdrawal (spending-phase adjusted)
const targetWithdrawal = Math.min(annualWithdrawal * spendingMultiplier, currentTotal)
let remaining = targetWithdrawal

// 1. TFSA
for tfsa accounts (balance > 0, remaining > 0):
  take = min(remaining, balance)
  balance -= take; remaining -= take

// 2. Discretionary
for discretionary accounts (balance > 0, remaining > 0):
  take = min(remaining, balance)
  gainFraction = max(0, min(1, (balance - costBasis) / balance))
  gainTaken = take × gainFraction
  cgtTaxableAmount += gainTaken × 0.40    // 40% CGT inclusion rate
  costBasis = max(0, costBasis - take × (1 - gainFraction))
  balance -= take; remaining -= take

// 3. Pension / RA / Preservation
for pension accounts (balance > 0, remaining > 0):
  take = min(remaining, balance)
  balance -= take; remaining -= take
```

#### 3c. Section 11F Credit in Drawdown

```typescript
const creditAppliedThisYear = Math.min(pensionWithdrawal, creditRemaining)
creditRemaining -= creditAppliedThisYear
const taxableIncome = (pensionWithdrawal - creditAppliedThisYear) + cgtTaxableAmount
```

#### 3d. Income Tax Calculation Per Year

```typescript
const age = retirementAge + year
const incomeTax = calculateIncomeTaxWithRebates(
  taxableIncome,
  age,
  drawdownConfig.monthlyMedicalAid ? drawdownConfig.medicalAidDependants ?? 0 : undefined
)
```

#### 3e. Medical Aid Escalation in Drawdown

Monthly medical aid is entered in **today's Rands** and escalated using **general inflation**
(not medical inflation — the separate `projectMedicalCosts` module uses medical inflation
for standalone analysis):

```typescript
const medicalAidContribution =
  (drawdownConfig.monthlyMedicalAid ?? 0)
  × Math.pow(1 + inflationRate, yearsToRetirement + year)
  × 12
```

#### 3f. Net Income Per Year

```typescript
const netIncome = totalWithdrawal - incomeTax - medicalAidContribution
const inflationAdjustedWithdrawal = totalWithdrawal / Math.pow(1 + inflationRate, yearsToRetirement + year)
```

#### 3g. Next Year's Withdrawal (end of each drawdown year)

From year 1 onward, the base withdrawal is recomputed per-strategy against the live
post-growth balance — see §15 for the per-strategy formulas (`calculateNextWithdrawal`
in `lib/calculations/utils/drawdown-withdrawal.ts`, shared by both engines). Only
`fixed_amount_inflation_adjusted` actually reduces to a flat CPI inflation of the prior
amount; the other three strategies re-derive the amount from `currentBalance` each year,
which is what makes them diverge from each other after year 0.

```typescript
if (year > 0) {
  annualWithdrawal = calculateNextWithdrawal(
    annualWithdrawal, currentTotal, drawdownConfig,
    yearsToRetirement + year, inflationRate
  )
}
```

### Initial Withdrawal by Strategy

```typescript
function calculateInitialWithdrawal(
  portfolioValue: number,
  desiredMonthlyIncomeToday: number,
  config: DrawdownConfig,
  yearsToRetirement: number,
  inflationRate: number
): number {
  const desiredMonthlyAtRetirement =
    desiredMonthlyIncomeToday * Math.pow(1 + inflationRate, yearsToRetirement)

  switch (config.strategy) {
    case 'fixed_percentage':
      return portfolioValue * (config.initialWithdrawalRate / 100)

    case 'fixed_amount_inflation_adjusted':
      return desiredMonthlyAtRetirement * 12

    case 'variable_percentage':
    case 'guardrails':
      const minAtRetirement = config.minimumWithdrawal * Math.pow(1 + inflationRate, yearsToRetirement)
      const maxAtRetirement = config.maximumWithdrawal * Math.pow(1 + inflationRate, yearsToRetirement)
      return Math.min(
        Math.max(desiredMonthlyAtRetirement * 12, minAtRetirement * 12),
        maxAtRetirement * 12
      )
  }
}
```

### Portfolio Depletion

Once balance reaches R0, all subsequent years record zero balance and zero withdrawals.
No negative balances permitted. `portfolioDepletionAge` is set on the first year balance hits 0.

---

## 7. Monte Carlo Simulation

### Random Return Generation

**Box-Muller transform** for normally distributed random numbers:
```typescript
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random()
  const u2 = Math.random()
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + stdDev * z0
}
```

**Log-normal returns** (corrected for Jensen's inequality / volatility drag):
```typescript
function generateReturnSequence(
  expectedReturn: number,
  volatility: number,
  years: number
): number[] {
  return Array.from({ length: years }, () => {
    // Drift adjustment: ensures geometric mean = stated expectedReturn
    const logMean = Math.log(1 + expectedReturn) - (volatility * volatility) / 2
    const logReturn = randomNormal(logMean, volatility)
    return Math.exp(logReturn) - 1
  })
}
```

Why log-normal: simple normally distributed returns can go below -100%.
The drift correction `-σ²/2` (Jensen's inequality) ensures the expected geometric
growth rate matches the stated `expectedReturn`.

### Simulation Run — Accumulation Phase

Each account gets its own independent return sequence. Monthly compounding matches
the deterministic engine:

```typescript
for year = 0 to yearsToRetirement - 1:
  for each account:
    annualReturn = accountReturns[accIdx][year]     // pre-generated sequence
    monthlyReturn = calculateMonthlyReturn(annualReturn, compoundingMethod)
    for month = 0 to 11:
      contrib = monthlyContribution × (1 + escalation)^(year + month/12)
      balance = balance × (1 + monthlyReturn) + contrib
```

### Simulation Run — Drawdown Phase

Each account keeps its own stochastic return sequence into the drawdown phase (no
single pooled return) — growth is applied per-account before each year's withdrawal:

```typescript
for year = 0 to yearsInRetirement - 1:
  for each drawdownAccount:
    if (acc.balance > 0) acc.balance *= (1 + acc.returns[yearsToRetirement + year])

  const multiplier = getSpendingPhaseMultiplier(year)
  let remaining = min(withdrawal × multiplier, balance)
  // Withdraw in tax-efficient order, mirrors the deterministic projection engine:
  // 1. TFSA (tax-free)        2. Discretionary (CGT only)        3. Pension/RA/preservation (income tax)
  if (year > 0) {
    withdrawal = calculateNextWithdrawal(
      withdrawal, balance, drawdownConfig,
      yearsToRetirement + year, inflationRate, desiredMonthlyIncome
    )
  }
```

Tax on the pension withdrawal plus CGT-taxable discretionary gains is computed each
year via `calculateIncomeTaxWithRebates` and accumulated into `lifetimeIncomeTax` —
for reporting only; it does not force additional liquidation (it reduces net
spendable income, matching the deterministic engine's treatment).

### Lump Sum in Monte Carlo

Lump sum commutation is restricted to pension/RA/preservation balances and capped at
one-third, mirroring the deterministic engine:

```typescript
const pensionBalanceAtRetirement = accounts.reduce((sum, acc, idx) =>
  PENSION_TYPES.includes(acc.type) ? sum + accountBalances[idx] : sum, 0)
const cappedLumpSumPercentage = Math.min(Math.max(0, lumpSumPercentage), SA_TAX_LIMITS.maxLumpSumCommutationPercentage)
const lumpSumFraction = pensionBalanceAtRetirement > 0 ? cappedLumpSumPercentage / 100 : 0

// Only pension-type accounts are reduced by the commutation fraction
drawdownAccounts = accounts.map(acc => ({
  ...acc,
  balance: accountBalances[idx] × (1 - (PENSION_TYPES.includes(acc.type) ? lumpSumFraction : 0)),
}))

// Tax on the commuted amount itself, via the same retirement lump sum table as §1.2,
// reported on SimulationRun.lumpSumTax (added to lifetimeIncomeTax is NOT done —
// they are tracked as separate fields, see SimulationRun below)
const lumpSumTax = calculateLumpSumCommutation(pensionBalanceAtRetirement, cappedLumpSumPercentage).lumpSumTax
```

### Initial Withdrawal for Monte Carlo

```typescript
// fixed_percentage: use GREATER of percentage-based or desired income
// (ensures success rate tests whether the user can achieve their actual goal)
case 'fixed_percentage':
  return Math.max(portfolioAtRetirement × withdrawalRate, desiredAnnualAtRetirement)

default:
  return desiredAnnualAtRetirement   // inflated to retirement
```

### Success Criterion

`balance > 0` at `lifeExpectancy` = success. Lump sum and income/CGT tax are reported
via `SimulationRun.lumpSumTax` / `lifetimeIncomeTax` (and their `SimulationResult`
averages) but do not affect the success/failure determination — both leave the
portfolio balance unchanged either way, only the reported tax differs.

### Percentile Calculation (linear interpolation)

```typescript
function getPercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0
  const index = (percentile / 100) * (sortedArray.length - 1)
  const lower = Math.floor(index)
  const upper = Math.ceil(index)
  const weight = index - lower
  if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1]
  return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight
}
```

Computed percentiles: p10, p25, p50, p75, p90 — per year across all runs.

---

## 8. Investment Scenarios

Three pre-defined SA-specific investment scenarios (nominal returns):

| Scenario | Nominal Return | Volatility | Allocation |
|---|---|---|---|
| Conservative | 10.5% | 10% | 60% bonds, 30% equity, 10% cash |
| Balanced | 12.0% | 14% | 60% equity, 30% bonds, 10% cash |
| Aggressive | 14.0% | 18% | 85% equity, 10% bonds, 5% cash |

**Real return (display only):**
```
realReturn = nominalReturn - inflationRate - fees
```

All scenario projections use **nominal returns** (consistent with main simulation methodology).
Real return is informational only.

### Scenario Recommendation Logic

```typescript
function recommendScenario(yearsToRetirement: number, successProbabilities: Record<string, number>) {
  if (yearsToRetirement > 20) {
    return successProbabilities.aggressive >= 70 ? 'aggressive' : 'balanced'
  }
  if (yearsToRetirement > 10) {
    return successProbabilities.balanced >= 75 ? 'balanced' : 'conservative'
  }
  return 'conservative'   // capital preservation near retirement
}
// Add warning if recommended scenario success probability < 50%
```

---

## 9. Optimal Contribution (Binary Search)

**Step 1: Compute target nest egg**
```typescript
const desiredMonthlyAtRetirement = desiredMonthlyToday × Math.pow(1 + inflationRate, yearsToRetirement)
const desiredAnnualAtRetirement  = desiredMonthlyAtRetirement × 12
const targetNestEgg = desiredAnnualAtRetirement / (initialWithdrawalRate / 100)
```

**Step 2: Check if already on track (no contribution needed)**
```typescript
const zeroContribProjection = projectFinalSavings(
  currentSavings, 0, yearsToRetirement, escalation, netReturn, compoundingMethod
)
if (zeroContribProjection >= targetNestEgg) return 0
```

**Step 3: Binary search**
```typescript
let low = 0
let high = 100_000   // R100,000/month upper bound

while (high - low > 100) {   // R100 precision
  const mid = (low + high) / 2
  const projected = projectFinalSavings(currentSavings, mid, years, escalation, netReturn, compounding)
  if (projected >= targetNestEgg) high = mid
  else low = mid
}

// Round up to nearest R100
return Math.ceil(high / 100) * 100
```

---

## 10. Section 11F RA Optimization

Calculates deduction room and the tax saving from maximizing RA contributions.

```typescript
function calculateRAOptimization(annualIncome: number, accounts: Account[]): RAOptimizationResult {
  const annualDeductionLimit = Math.min(annualIncome × 0.275, 430_000)

  const currentMonthlyContributions = accounts
    .filter(a => ['pension_fund', 'retirement_annuity', 'preservation_fund'].includes(a.type))
    .reduce((sum, a) => sum + a.monthlyContribution, 0)

  const currentAnnualContributions = currentMonthlyContributions × 12
  const remainingRoom = Math.max(0, annualDeductionLimit - currentAnnualContributions)

  // Tax saving = tax(current taxable income) - tax(income after maxing deduction)
  // Both use PRIMARY REBATE ONLY (working-age; no medical or secondary/tertiary rebates)
  const currentDeduction       = Math.min(currentAnnualContributions, annualDeductionLimit)
  const currentTaxableIncome   = Math.max(0, annualIncome - currentDeduction)
  const optimizedTaxableIncome = Math.max(0, annualIncome - annualDeductionLimit)

  const currentTax   = Math.max(0, calculateIncomeTax(currentTaxableIncome)   - 17_820)
  const optimizedTax = Math.max(0, calculateIncomeTax(optimizedTaxableIncome) - 17_820)
  const annualTaxSaving = Math.max(0, currentTax - optimizedTax)

  return {
    annualDeductionLimit,
    currentAnnualContributions,
    remainingRoom,
    utilizationPct: annualDeductionLimit > 0
      ? Math.min(100, (currentAnnualContributions / annualDeductionLimit) × 100)
      : 0,
    annualTaxSaving,
    optimalMonthlyContribution: annualDeductionLimit / 12,
    currentMonthlyContributions,
    isFullyUtilized: remainingRoom <= 0,
    isOverLimit: currentAnnualContributions > annualDeductionLimit,
  }
}
```

**Note:** Excess contributions (`isOverLimit`) are not deductible that year — they accumulate as
Section 11F carry-forward credit that reduces taxable lump sum at retirement (see §6 Phase 2).

---

## 11. Medical Cost Projection

Standalone analysis tool. The main drawdown engine uses **general inflation** for medical aid,
not medical inflation. This module provides detailed lifetime medical cost analysis.

```typescript
function projectMedicalCosts(params: {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  currentMedicalCostMonthly?: number   // default R3,500
  generalInflation?: number            // default 0.055
  medicalInflation?: number            // default 0.09
}): MedicalCostProjection {
  const yearsToRetirement = retirementAge - currentAge
  const yearsInRetirement = lifeExpectancy - retirementAge

  // Medical cost at start of retirement, inflated from today with medical inflation
  const medicalCostAtRetirement =
    currentMedicalCostMonthly × Math.pow(1 + medicalInflation, yearsToRetirement)

  for year = 0 to yearsInRetirement - 1:
    const age = retirementAge + year
    // Base escalates with medical inflation each year in retirement
    const baseCost = medicalCostAtRetirement × Math.pow(1 + medicalInflation, year)
    // Plus 2% additional per year of age in retirement
    const ageMultiplier = 1 + 0.02 × year
    monthlyMedicalCost = baseCost × ageMultiplier
}
```

**Medical inflation premium** (extra savings needed vs general inflation):
```typescript
function calculateMedicalInflationPremium({ retirementAge, lifeExpectancy,
  baseMedicalCostMonthly, generalInflation, medicalInflation }) {
  let totalAtMedicalInflation = 0
  let totalAtGeneralInflation = 0
  for year = 0 to yearsInRetirement - 1:
    const ageMultiplier = 1 + 0.02 × year
    totalAtMedicalInflation += baseMedicalCostMonthly × (1+medicalInflation)^year × ageMultiplier × 12
    totalAtGeneralInflation += baseMedicalCostMonthly × (1+generalInflation)^year × ageMultiplier × 12
  return totalAtMedicalInflation - totalAtGeneralInflation
}
```

---

## 12. Spending Phase Model

Based on the empirical "Go-Go / Slow-Go / No-Go" retirement spending pattern
(ref: Kitces, "The Retirement Spending Smile").

| Phase | Years in Retirement | Multiplier | Rationale |
|---|---|---|---|
| Go-Go | 0 – 15 | 1.00 (100%) | Active, healthy, travel |
| Slow-Go | 16 – 25 | 0.80 (80%) | Reduced activity |
| No-Go | 26+ | 0.70 → 1.20 | Medical costs dominate |

```typescript
function getSpendingPhaseMultiplier(yearsInRetirement: number): number {
  if (yearsInRetirement <= 15) return 1.0
  if (yearsInRetirement <= 25) return 0.8
  // No-Go: 70% base rising with medical premium, capped at 120%
  const medicalPremium = 0.15 × (yearsInRetirement - 25) / 10
  return Math.min(0.7 + medicalPremium, 1.2)
}
```

**No-Go detail:**
- Medical premium rises at 0.015 per year past year 25 (1.5% per year)
- Reaches the 1.2× cap at approximately year 58 (33 years past year 25)
- Boundaries are **inclusive**: year 15 is still Go-Go, year 25 is still Slow-Go

---

## 13. Cost of Delay

Quantifies the cost of waiting 1, 2, or 5 years before starting to save.

```typescript
function calculateCostOfDelay(params) {
  // Baseline: start contributing now
  const baseline = projectFinalSavings(
    currentSavings, monthlyContribution, yearsToRetirement,
    escalation, netReturn, compoundingMethod
  )

  // During delay: savings grow but NO new contributions (simple annual compounding)
  const savingsAfterDelay = (n) => currentSavings × Math.pow(1 + netReturn, n)

  // After delay: resume contributions for remaining years
  const nestEgg = (delayYears) => projectFinalSavings(
    savingsAfterDelay(delayYears),
    monthlyContribution,
    Math.max(0, yearsToRetirement - delayYears),
    escalation, netReturn, compoundingMethod
  )

  return {
    baselineNestEgg: baseline,
    oneYearDelayNestEgg:  nestEgg(1),
    twoYearDelayNestEgg:  nestEgg(2),
    fiveYearDelayNestEgg: nestEgg(5),
    costOfOneYearDelay:   baseline - nestEgg(1),
    costOfTwoYearDelay:   baseline - nestEgg(2),
    costOfFiveYearDelay:  baseline - nestEgg(5),
    percentageLostOneYear:  (baseline - nestEgg(1)) / baseline × 100,
    percentageLostTwoYear:  (baseline - nestEgg(2)) / baseline × 100,
    percentageLostFiveYear: (baseline - nestEgg(5)) / baseline × 100,
  }
}
```

**Note:** The idle period uses annual compounding (`balance × (1 + netReturn)^n`), not monthly.

---

## 14. Replacement Ratio

```typescript
function calculateReplacementRatio(
  annualRetirementIncome: number,   // after tax
  preRetirementIncome: number       // before tax
): number {
  if (preRetirementIncome <= 0) return 0
  // Estimate net pre-retirement income assuming 25% effective tax rate
  const estimatedPreRetirementNetIncome = preRetirementIncome × 0.75
  return (annualRetirementIncome / estimatedPreRetirementNetIncome) × 100
}
```

**Target:** 75% replacement ratio is the general SA planning benchmark.

---

## 15. Drawdown Strategies

| Strategy | Key | Year 0 (retirement date) | Year 1+ |
|---|---|---|---|
| Fixed Percentage | `fixed_percentage` | `portfolio × rate` | Recomputed as `currentBalance × rate` every year (pure %-of-portfolio in the deterministic engine; Monte Carlo takes the greater of that and CPI-inflated desired income — see §7) |
| Fixed Amount Inflation-Adjusted | `fixed_amount_inflation_adjusted` | Desired income inflated to retirement date | Prior year's withdrawal × `(1 + inflationRate)` — the only strategy that is a flat CPI escalation |
| Variable Percentage | `variable_percentage` | Desired income inflated to retirement date, clamped to min/max | `currentBalance × rate`, clamped to the inflation-adjusted min/max for that year |
| Guardrails | `guardrails` | Same as Variable Percentage | Guyton-Klinger decision rule (below), then clamped to the inflation-adjusted min/max |

All four strategies share year-0 logic in `calculateInitialWithdrawal` (§6) — this anchor is
unchanged by the per-year recompute. From year 1 onward, `calculateNextWithdrawal` in
`lib/calculations/utils/drawdown-withdrawal.ts` is the single source of truth, shared by both
the deterministic engine (§3g) and Monte Carlo (§7). This is what makes the four strategies
diverge after year 0 instead of collapsing to an identical CPI-escalation path.

### Guardrails — Guyton-Klinger decision rule

Each year, compare the *actual* withdrawal rate (`previousWithdrawal / currentBalance`) against
upper/lower bands around the *target* rate (`initialWithdrawalRate`):

```typescript
const targetRate = initialWithdrawalRate / 100
const actualRate = previousWithdrawal / currentBalance
const upperBand = targetRate × (1 + upperGuardrail / 100)   // default upperGuardrail = 20
const lowerBand = targetRate × (1 - lowerGuardrail / 100)   // default lowerGuardrail = 20

if (actualRate > upperBand) next = previousWithdrawal × 0.9   // capital preservation: cut 10%
else if (actualRate < lowerBand) next = previousWithdrawal × 1.1  // prosperity rule: raise 10%
else next = previousWithdrawal × (1 + inflationRate)           // within band: CPI as normal
```

`upperGuardrail`/`lowerGuardrail` default to 20% (standard Guyton-Klinger) when not set in
`DrawdownConfig`. Both are user-adjustable in the UI (`drawdown-strategy-form.tsx`,
5–50% range). The result is then clamped to the same inflation-adjusted min/max as
Variable Percentage.

### Variable Percentage / Guardrails min-max clamp

`minimumWithdrawal`/`maximumWithdrawal` are monthly figures in today's Rands. Each drawdown
year they're inflated and annualized before clamping:

```typescript
const minAtYear = minimumWithdrawal × (1 + inflationRate) ** yearsSinceToday × 12
const maxAtYear = maximumWithdrawal × (1 + inflationRate) ** yearsSinceToday × 12
result = Math.min(Math.max(amount, minAtYear), maxAtYear)
```

This re-clamps every year (not just at year 0) — a percentage-of-portfolio withdrawal that
falls outside the floor/ceiling in year 5 is just as constrained as one that does so at
retirement.

---

## 16. Critical Validation Rules

These rules are non-obvious and easy to get wrong:

1. **TFSA `tfsaContributionsToDate`** tracks cumulative historical contributions, NOT the current
   balance. Balance can legally exceed R500,000 from growth.

2. **Net return** must be `(expectedReturn - annualFees) / 100` before passing to projection
   functions. Never pass gross return.

3. **Age rebates** are recalculated every drawdown year using `retirementAge + year`.
   Do not use a static rebate for the entire drawdown period.

4. **Medical aid credit** is applied only when `monthlyMedicalAid` is provided and non-zero.
   Pass `undefined` as `medicalAidDependants` to skip the credit entirely.

5. **Section 11F credit** only accumulates from `pension_fund`, `retirement_annuity`,
   and `preservation_fund`. TFSA and discretionary are excluded.

6. **CGT inclusion rate is hardcoded at 40%** for individuals. This is not configurable.

7. **Lump sum percentage** must be clamped to 0–100 before calculation.

8. **Portfolio depletion**: once balance hits R0, subsequent years get zero balance and zero
   withdrawals. No negative balances.

9. **Default compounding** is `nominal` for backward compatibility. `compound` is more accurate
   for long-term projections.

10. **Income for Section 11F** escalates with inflation annually:
    `annualIncome × (1 + inflationRate)^year`. The deduction limit therefore grows in nominal
    terms, keeping pace with escalating contributions.

11. **Medical aid in drawdown**: the main projection engine uses **general inflation** to escalate
    medical aid costs, not medical inflation. `projectMedicalCosts()` is a separate analysis tool
    that applies medical inflation — it is not used inside the main projection loop.

12. **No monthly compounding in drawdown**: Phase 3 uses annual loops for performance.
    Accumulation uses monthly loops.

13. **Contribution escalation is continuous**: `baseContribution × (1 + escalation)^(year + month/12)`
    — not a step-wise annual increase.

14. **Lump sum deducted proportionally**: every account's balance is reduced by the same fraction
    (`lumpSumAmount / totalPortfolio`) at retirement.

15. **Monte Carlo withdrawal baseline**: for `fixed_percentage`, use the **greater** of
    percentage-based withdrawal and desired income — this ensures success rate tests whether
    the user can actually achieve their income goal, not just whether the portfolio lasts.

16. **CGT cost basis after withdrawal**:
    ```typescript
    costBasis = Math.max(0, costBasis - withdrawal × (1 - gainFraction))
    ```
    Cost basis is reduced by the non-gain portion of each withdrawal.

17. **Spending phase multiplier applies to the target withdrawal** (`annualWithdrawal × multiplier`),
    not to the actual portfolio withdrawal. The multiplied amount is then capped at portfolio value.

18. **Withdrawal strategy divergence is year 1+ only**: year 0 always uses
    `calculateInitialWithdrawal` (§6) regardless of strategy. `calculateNextWithdrawal` (§15)
    takes over from year 1 onward and is what makes the four strategies actually diverge —
    don't confuse the two when debugging early-vs-later-year withdrawal amounts.

---

## 17. Annual Tax Year Update Checklist

When SARS releases new budget figures, update these values in a single config file:

- [ ] Income tax brackets (check all 7 tiers: min, max, rate, baseTax)
- [ ] Lump sum tax table (check all 4 tiers: threshold, rate, previousTax)
- [ ] Tax rebates — primary, secondary, tertiary
- [ ] Tax-free thresholds — under 65, 65–74, 75+
- [ ] TFSA limits: annual (currently R36,000) and lifetime (currently R500,000)
- [ ] Section 11F: deduction rate (currently 27.5%) and annual cap (currently R430,000)
- [ ] Medical aid credits: principal member, first dependant, additional dependants

After updating, run `npm test` — failing tests will flag any values that have changed.
