import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import {
  calculateIndexedIncomeTax,
  calculateLumpSumCommutation,
  calculateExcessContributionCredit,
  taxThresholdForAge,
  taxThresholdScale,
} from "./retirement-tax"
import { getSpendingPhaseMultiplier } from "./utils/spending-phase"
import { calculateMonthlyReturn } from "./utils/projection"
import { deflate, escalate } from "./utils/money-time"
import { isPensionType, runDrawdownYear } from "./utils/drawdown-year"
import { admitTfsaContribution, createTfsaAllowance, startTfsaYear } from "./utils/tfsa-allowance"
import { resolveTaxThresholdIndexation, type TaxThresholdIndexation } from "./utils/tax-relief"
import { assertNonNegativeBalance, finiteOrZero, sanitizeAccounts } from "./utils/invariant-guards"
import { calculateInitialWithdrawal, calculateNextWithdrawal } from "./utils/drawdown-withdrawal"
import type {
  Account,
  AccountType,
  CompoundingMethod,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
  YearlyProjection,
} from "@/types"

export interface DrawdownAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  costBasis: number // For discretionary: tracks original value (contributions + initial balance); used for CGT gain calculation
  netReturn: number // (expectedReturn - annualFees) / 100
  feeRate: number // annualFees / 100 (for display only)
}

/**
 * Main projection calculation
 */
/**
 * Degenerate ProjectionResult used when there's nothing to project — either no
 * accounts, or ages are invalid (e.g. retirementAge <= currentAge inverted via
 * direct API/test usage bypassing the form's Zod validation).
 */
function buildEmptyProjectionResult(
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  yearsInRetirement: number,
): ProjectionResult {
  return {
    yearlyProjections: [],
    portfolioAtRetirement: 0,
    monthlyIncomeAtRetirement: 0,
    monthlyNetIncomeAtRetirement: 0,
    portfolioDepletionAge: personalInfo.retirementAge,
    incomeGoalShortfallAge:
      retirementGoals.desiredMonthlyIncome > 0 && yearsInRetirement > 0
        ? personalInfo.retirementAge
        : null,
    shortfallAmount: retirementGoals.desiredMonthlyIncome * 12 * Math.max(0, yearsInRetirement),
    surplusAmount: 0,
    totalLifetimeIncomeTax: 0,
    totalLumpSumTax: 0,
    totalMedicalAidContributions: 0,
    averageEffectiveTaxRate: 0,
    lumpSumCommutation: {
      lumpSumPercentage: 0,
      lumpSumAmount: 0,
      taxableLumpSum: 0,
      lumpSumTax: 0,
      netLumpSum: 0,
      remainingPortfolio: 0,
      accumulatedExcessCredit: 0,
      creditAppliedToLumpSum: 0,
      creditCarriedIntoDrawdown: 0,
    },
    accumulatedExcessCredit: 0,
    accountBalancesAtRetirement: {},
  }
}

/**
 * Result of the accumulation phase — everything the drawdown phase needs, and nothing else.
 *
 * Phase 10 Step 3 split `calculateProjection` into two phases. Previously both loops ran
 * inside one 630-line function sharing mutable locals (`totalBalance`, `annualWithdrawal`,
 * `portfolioDepletionAge`), which made it possible for accumulation-phase state to leak
 * into drawdown. Making the hand-off an explicit value removes that class of bug.
 */
export interface AccumulationResult {
  /** One row per accumulation year. */
  rows: YearlyProjection[]
  /** Per-account balances at the retirement date, index-aligned with `accounts`. */
  accountBalances: number[]
  /** Per-account cost bases (contributions + opening balance), for CGT on discretionary. */
  accountCostBases: number[]
  /** Section 11F contributions disallowed during accumulation, carried into commutation. */
  accumulatedExcessCredit: number
  /** Total portfolio value at the retirement date, before any lump-sum commutation. */
  portfolioAtRetirement: number
}

/**
 * Accumulation phase: monthly compounding per account, up to the retirement date.
 *
 * Pure — reads its inputs, mutates only its own locals, and returns everything it produced.
 */
export function runAccumulationPhase(
  accounts: Account[],
  personalInfo: PersonalInfo,
  yearsToRetirement: number,
  inflationRate: number,
  compoundingMethod: CompoundingMethod,
  taxIndexation: TaxThresholdIndexation,
): AccumulationResult {
  const rows: YearlyProjection[] = []

  // NaN/Infinity inputs must not poison the compounding arithmetic (Phase 9.1).
  const safeAccounts = sanitizeAccounts(accounts)

  // Track each account's balance and cost basis separately
  const accountBalances = safeAccounts.map((acc) => acc.currentBalance)
  const accountMonthlyContributions = safeAccounts.map((acc) => acc.monthlyContribution)
  // Cost basis tracks original value + contributions for CGT calculation on discretionary accounts
  const accountCostBases = safeAccounts.map((acc) => acc.currentBalance)

  // TFSA limits are per taxpayer, shared across every TFSA account
  const tfsaAllowance = createTfsaAllowance(safeAccounts)

  // Section 11F excess contribution credit accumulated during the accumulation phase.
  // Income is escalated with inflation each year so the deduction limit grows in line
  // with contributions (both expressed in nominal terms).
  let accumulatedExcessCredit = 0
  let totalBalance = safeAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0)

  for (let year = 0; year < yearsToRetirement; year++) {
    const age = personalInfo.currentAge + year
    const startingBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)
    let yearlyGrowth = 0
    let yearlyFees = 0
    let yearlyContributions = 0
    let yearlyPensionContributions = 0
    let tfsaExcessContribution = 0 // Track excess TFSA contributions for penalty calculation

    startTfsaYear(tfsaAllowance)

    // Project each account individually
    for (let accIdx = 0; accIdx < safeAccounts.length; accIdx++) {
      const acc = safeAccounts[accIdx]
      const accNetReturn = (acc.expectedReturn - acc.annualFees) / 100
      const accMonthlyReturn = calculateMonthlyReturn(accNetReturn, compoundingMethod)
      const accMonthlyFeeRate = Math.pow(1 + acc.annualFees / 100, 1 / 12) - 1
      const accEscalation = acc.contributionEscalation / 100

      // Monthly compounding within each year for this account
      for (let month = 0; month < 12; month++) {
        // Calculate contribution for this month (smooth escalation)
        let monthlyContribution =
          accountMonthlyContributions[accIdx] * Math.pow(1 + accEscalation, year + month / 12)

        // Enforce the TFSA annual (R46k) and lifetime (R500k) limits across all TFSAs.
        // The excess is tracked for the 40% penalty display, not invested.
        if (acc.type === "tfsa") {
          const { admitted, excess } = admitTfsaContribution(tfsaAllowance, monthlyContribution)
          monthlyContribution = admitted
          tfsaExcessContribution += excess
        }

        yearlyContributions += monthlyContribution
        if (isPensionType(acc.type)) yearlyPensionContributions += monthlyContribution

        // Apply growth first (end-of-period contributions, matches Excel FV type=0)
        const monthGrowth = accountBalances[accIdx] * accMonthlyReturn
        const monthFees = accountBalances[accIdx] * accMonthlyFeeRate
        yearlyGrowth += monthGrowth
        yearlyFees += monthFees
        accountBalances[accIdx] += monthGrowth

        // Then add contribution (doesn't earn interest until next month)
        accountBalances[accIdx] += monthlyContribution
        accountCostBases[accIdx] += monthlyContribution
      }
    }

    totalBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)

    // Section 11F carry-forward. Contributions not deducted in a year are deemed contributed
    // in the next (s11F(3)), so this year's deduction limit is tested against this year's
    // contributions PLUS everything carried in, and only what still does not fit carries on.
    // Summing each year's excess independently (as before 2026-11-01) never let a later
    // year's unused room absorb earlier excess, overstating the retirement credit — badly so
    // once the R430k cap is indexed. Income escalates with inflation; the cap per the
    // tax-relief assumption.
    const effectiveIncome = escalate(personalInfo.annualIncome, year, inflationRate)
    accumulatedExcessCredit = calculateExcessContributionCredit(
      accumulatedExcessCredit + yearlyPensionContributions,
      effectiveIncome,
      taxThresholdScale(year, taxIndexation.retirementDeductionCap),
    )

    // Calculate TFSA excess contribution penalty (40% tax on contributions over R46k/year)
    const tfsaExcessContributionPenalty = tfsaExcessContribution * 0.4

    rows.push({
      year: year + 1,
      age,
      startingBalance,
      contributions: yearlyContributions,
      growth: yearlyGrowth,
      fees: yearlyFees,
      withdrawals: 0,
      incomeTax: 0,
      lumpSumTax: 0,
      medicalAidContribution: 0,
      netIncome: 0,
      endingBalance: totalBalance,
      inflationAdjustedWithdrawal: 0,
      tfsaExcessContributionPenalty:
        tfsaExcessContributionPenalty > 0 ? tfsaExcessContributionPenalty : 0,
    })
  }

  return {
    rows,
    accountBalances,
    accountCostBases,
    accumulatedExcessCredit,
    portfolioAtRetirement: totalBalance,
  }
}

/**
 * Result of the drawdown phase.
 *
 * Phase 10 Step 3: the drawdown loop previously shared mutable locals with the
 * accumulation loop inside one 630-line function. Returning an explicit value makes the
 * boundary checkable and each phase independently testable.
 */
export interface DrawdownResult {
  /** One row per drawdown year. */
  rows: YearlyProjection[]
  /** Portfolio value at life expectancy (may be 0 if exhausted). */
  finalBalance: number
  /** Age at which the portfolio ran out, or null if it survived. */
  portfolioDepletionAge: number | null
  totalLifetimeIncomeTax: number
  totalMedicalAidContributions: number
  totalGrossWithdrawals: number
}

/**
 * Drawdown phase: one `runDrawdownYear` per year — monthly income, living annuity band,
 * TFSA → Discretionary → Pension/RA sequencing.
 *
 * Mutates the `drawdownAccounts` it is given — they carry per-account balances through the
 * loop — but touches no state outside them.
 *
 * `portfolioDepletionAge` is the first year the portfolio could not pay the full income:
 * either it ran out, or what is left sits in a living annuity already at its 17.5% ceiling.
 *
 * `returnOverrides[year][accountIndex]`, when a number, replaces that account's net annual
 * return for that drawdown year (the historical stress test); `null`, or a year beyond the
 * array, keeps the account's own return. An override is converted to monthly
 * GEOMETRICALLY, (1 + R)^(1/12) − 1, whatever the compounding method, so the year returns
 * exactly R — the nominal R/12 convention would turn a −37.6% year into about −31.8%.
 * Required, so every caller states whether it is projecting steady returns (`[]`).
 */
export type DrawdownReturnOverrides = ReadonlyArray<ReadonlyArray<number | null>>

export function runDrawdownPhase(
  drawdownAccounts: DrawdownAccount[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  yearsToRetirement: number,
  yearsInRetirement: number,
  inflationRate: number,
  initialAnnualWithdrawal: number,
  creditCarriedIntoDrawdown: number,
  compoundingMethod: CompoundingMethod,
  taxIndexation: TaxThresholdIndexation,
  returnOverrides: DrawdownReturnOverrides,
): DrawdownResult {
  const rows: YearlyProjection[] = []
  let annualWithdrawal = initialAnnualWithdrawal
  let creditRemaining = creditCarriedIntoDrawdown
  let portfolioDepletionAge: number | null = null
  let totalLifetimeIncomeTax = 0
  let totalMedicalAidContributions = 0
  let totalGrossWithdrawals = 0

  // NaN/Infinity inputs must not poison the drawdown arithmetic (Phase 9.1).
  // The gainFraction division below divides by balance, so a NaN balance would otherwise
  // leak NaN into the CGT/tax computation for the whole year.
  const safeRetirementAge = finiteOrZero(personalInfo.retirementAge)
  const safeYearsToRetirement = finiteOrZero(yearsToRetirement)
  const safeInflationRate = finiteOrZero(inflationRate)
  for (const acc of drawdownAccounts) {
    acc.balance = finiteOrZero(acc.balance)
    acc.costBasis = finiteOrZero(acc.costBasis)
    acc.netReturn = finiteOrZero(acc.netReturn)
    acc.feeRate = finiteOrZero(acc.feeRate)
  }

  // Fixed per account for the deterministic projection, so computed once.
  const monthlyRates = drawdownAccounts.map((acc) =>
    calculateMonthlyReturn(acc.netReturn, compoundingMethod),
  )

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = safeRetirementAge + year
    let currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)
    const startingBalance = currentTotal

    if (currentTotal <= 0) {
      if (!portfolioDepletionAge) portfolioDepletionAge = age
      // Zero out all account balances when portfolio depletes so finalBalance calculation is correct
      drawdownAccounts.forEach((acc) => {
        acc.balance = 0
      })
      rows.push({
        year: safeYearsToRetirement + year + 1,
        age,
        startingBalance: 0,
        contributions: 0,
        growth: 0,
        fees: 0,
        withdrawals: 0,
        incomeTax: 0,
        lumpSumTax: 0,
        medicalAidContribution: 0,
        netIncome: 0,
        endingBalance: 0,
        inflationAdjustedWithdrawal: 0,
        tfsaWithdrawal: 0,
        discretionaryWithdrawal: 0,
        pensionWithdrawal: 0,
        cgtTaxableAmount: 0,
        taxableIncome: 0,
        accountBalances: Object.fromEntries(drawdownAccounts.map((a) => [a.id, 0])),
        tfsaExcessContributionPenalty: 0,
      })
      continue
    }

    // Fees are already inside each account's net return; this figure is for display only.
    const totalFees = drawdownAccounts.reduce(
      (sum, acc) => sum + Math.max(0, acc.balance) * acc.feeRate,
      0,
    )

    // From year 1 onward, recompute the base withdrawal per-strategy against the live
    // start-of-year balance — the anniversary value a living annuity's rate is set on, and
    // the same basis year 0 uses — instead of blindly inflating last year's figure.
    if (year > 0) {
      annualWithdrawal = calculateNextWithdrawal(
        annualWithdrawal,
        startingBalance,
        drawdownConfig,
        safeYearsToRetirement + year,
        safeInflationRate,
      )
    }

    // Every rand threshold below is indexed to this tax year (see taxThresholdScale).
    const yearsFromNow = safeYearsToRetirement + year
    const thresholdScale = taxThresholdScale(yearsFromNow, taxIndexation.incomeTax)

    // Annuity income below the age-based threshold, plus whatever s11F credit is left, is
    // tax-free this year — runDrawdownYear draws annuity income into that room first.
    const pensionTaxFreeRoom = taxThresholdForAge(age) * thresholdScale + creditRemaining

    const targetWithdrawal = annualWithdrawal * getSpendingPhaseMultiplier(year)
    const overridesThisYear = returnOverrides[year]
    const ratesThisYear = overridesThisYear
      ? monthlyRates.map((rate, i) => {
          const override = overridesThisYear[i]
          return override === null || override === undefined || !Number.isFinite(override)
            ? rate
            : calculateMonthlyReturn(Math.max(-1, override), "compound")
        })
      : monthlyRates
    const yearOutcome = runDrawdownYear(
      drawdownAccounts,
      ratesThisYear,
      targetWithdrawal,
      pensionTaxFreeRoom,
    )
    const {
      tfsaWithdrawal,
      discretionaryWithdrawal,
      pensionWithdrawal,
      capitalGainRealized,
      growth: totalGrowth,
    } = yearOutcome

    // Annual exclusion applies once per taxpayer per year, across all discretionary accounts
    const taxableCapitalGain = Math.max(
      0,
      capitalGainRealized -
        SA_TAX_LIMITS.cgtAnnualExclusion *
          taxThresholdScale(yearsFromNow, taxIndexation.cgtExclusion),
    )
    const cgtTaxableAmount = taxableCapitalGain * SA_TAX_LIMITS.cgtInclusionRateIndividual

    const totalWithdrawal = tfsaWithdrawal + discretionaryWithdrawal + pensionWithdrawal

    // Apply any remaining Section 11F credit against pension annuity income
    const creditAppliedThisYear = Math.min(pensionWithdrawal, creditRemaining)
    creditRemaining -= creditAppliedThisYear

    // Only pension withdrawals and CGT inclusion amount are taxable income
    const taxableIncome = pensionWithdrawal - creditAppliedThisYear + cgtTaxableAmount
    const incomeTax = calculateIndexedIncomeTax(
      taxableIncome,
      age,
      drawdownConfig.monthlyMedicalAid ? (drawdownConfig.medicalAidDependants ?? 0) : undefined,
      thresholdScale,
    )
    // monthlyMedicalAid is entered in today's Rands; escalate to retirement-year value
    // using medical inflation (9%) not general inflation (5.5%), since SA medical costs
    // grow faster than CPI
    const medicalAidContribution = escalate(
      (drawdownConfig.monthlyMedicalAid ?? 0) * 12,
      safeYearsToRetirement + year,
      SA_DEFAULTS.medicalInflation,
    )
    const netIncome = totalWithdrawal - incomeTax - medicalAidContribution

    currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

    // The year the income could not be paid in full is the depletion year — including
    // the FINAL year, which the start-of-year guard can never observe. A retiree who drew
    // their full income every year and lands on exactly R0 at life expectancy has not run
    // out early: no shortfall, no depletion.
    if (yearOutcome.shortfall && !portfolioDepletionAge) {
      portfolioDepletionAge = age
    }

    totalGrossWithdrawals += totalWithdrawal
    totalLifetimeIncomeTax += incomeTax
    totalMedicalAidContributions += medicalAidContribution

    rows.push({
      year: safeYearsToRetirement + year + 1,
      age,
      startingBalance,
      contributions: 0,
      growth: totalGrowth,
      fees: totalFees,
      withdrawals: totalWithdrawal,
      incomeTax,
      lumpSumTax: 0,
      medicalAidContribution,
      netIncome,
      // Clamp protects rendering; the guard ensures it cannot also hide a defect.
      endingBalance: Math.max(
        0,
        assertNonNegativeBalance(currentTotal, `drawdown year at age ${age}`),
      ),
      inflationAdjustedWithdrawal: deflate(
        totalWithdrawal,
        safeYearsToRetirement + year,
        safeInflationRate,
      ),
      tfsaWithdrawal,
      discretionaryWithdrawal,
      pensionWithdrawal,
      cgtTaxableAmount,
      taxableIncome,
      accountBalances: Object.fromEntries(
        drawdownAccounts.map((a) => [
          a.id,
          Math.max(0, assertNonNegativeBalance(a.balance, `account ${a.id} at age ${age}`)),
        ]),
      ),
      excessCreditApplied: creditAppliedThisYear,
      excessCreditRemaining: creditRemaining,
      tfsaExcessContributionPenalty: 0,
    })
  }

  return {
    rows,
    finalBalance: drawdownAccounts.reduce((s, a) => s + a.balance, 0),
    portfolioDepletionAge,
    totalLifetimeIncomeTax,
    totalMedicalAidContributions,
    totalGrossWithdrawals,
  }
}

// ---------------------------------------------------------------------------
// Summary-metric selectors (Phase 10 Step 4)
//
// These were computed inline at the end of `calculateProjection`, mixed in with
// orchestration. Pulling them out as named functions over `yearlyProjections` makes the
// derivation reviewable in one place and independently testable, and stops the same
// quantity being derived twice in slightly different ways.
//
// NOTE ON SHORTFALL SEMANTICS: `selectShortfallAmount` keeps the rule that a plan which
// funds its income to life expectancy reports no shortfall. That rule is a settled product
// decision (shortfall means "the money ran out before I died", not "cumulative income
// gap"). Since 2026-10-31 "ran out" is read from the depletion age, not the final balance,
// because a living annuity at its 17.5% ceiling can fail to fund the income while keeping
// a residual balance.
// ---------------------------------------------------------------------------

/**
 * Average effective tax rate across the whole drawdown phase, as a percentage.
 */
export function selectAverageEffectiveTaxRate(
  totalLifetimeIncomeTax: number,
  totalGrossWithdrawals: number,
): number {
  return totalGrossWithdrawals > 0 ? (totalLifetimeIncomeTax / totalGrossWithdrawals) * 100 : 0
}

/**
 * Gross (before-tax) monthly income actually paid in the first drawdown year.
 *
 * Read from the projected row, not from the strategy's target. The living annuity band can
 * pay less than the target (17.5% ceiling: a R1M annuity cannot fund R30k a month) or more
 * (2.5% minimum). Reporting the target made the headline promise income the law does not
 * allow, and could show net income above gross. Gross and net now come from the same row.
 */
export function selectMonthlyGrossIncomeAtRetirement(
  rows: YearlyProjection[],
  yearsToRetirement: number,
): number {
  const firstDrawdownYear = rows[yearsToRetirement]
  return firstDrawdownYear ? firstDrawdownYear.withdrawals / 12 : 0
}

/**
 * Net (after-tax) monthly income in the first drawdown year.
 *
 * Sourced from the projected row rather than re-taxing the gross withdrawal, so it
 * reflects the actual account-mix treatment: TFSA tax-free, CGT on discretionary, full
 * income tax on pension/RA/preservation, less medical aid.
 */
export function selectMonthlyNetIncomeAtRetirement(
  rows: YearlyProjection[],
  yearsToRetirement: number,
): number {
  const firstDrawdownYear = rows[yearsToRetirement]
  return firstDrawdownYear ? firstDrawdownYear.netIncome / 12 : 0
}

/**
 * Cumulative gap between the inflation-adjusted desired income and what was actually
 * withdrawn, summed across every drawdown year.
 *
 * Comparing only the year-0 target (as an earlier version did) was structurally always 0
 * for every strategy except `fixed_percentage`, because `calculateInitialWithdrawal`
 * returns the desired amount verbatim for the other three — so a portfolio that fully
 * depleted years before life expectancy never registered a shortfall.
 */
export function selectRawIncomeGap(
  rows: YearlyProjection[],
  yearsToRetirement: number,
  desiredMonthlyIncomeToday: number,
  inflationRate: number,
): number {
  const desiredMonthlyAtRetirement = escalate(
    desiredMonthlyIncomeToday,
    yearsToRetirement,
    inflationRate,
  )
  return rows.slice(yearsToRetirement).reduce((sum, yp, drawdownYear) => {
    const desiredAnnualThisYear = escalate(
      desiredMonthlyAtRetirement * 12,
      drawdownYear,
      inflationRate,
    )
    return sum + Math.max(0, desiredAnnualThisYear - yp.withdrawals)
  }, 0)
}

/** Relative tolerance below which a gap between income paid and the goal is rounding. */
const INCOME_GOAL_TOLERANCE = 1e-6

/**
 * First drawdown age at which the income paid is below the income goal; null if the goal
 * is met every year to life expectancy.
 *
 * The goal for each year is the desired income escalated to that year, times the
 * spending-phase multiplier the plan applies to every strategy. This is the deterministic
 * "is the plan on track?" signal: `portfolioDepletionAge` alone cannot answer it, because a
 * percentage-of-portfolio strategy never depletes yet can pay a fraction of the goal.
 */
export function incomeGoalForDrawdownYear(
  desiredMonthlyIncomeToday: number,
  yearsToRetirement: number,
  drawdownYear: number,
  inflationRate: number,
): number {
  return (
    escalate(desiredMonthlyIncomeToday * 12, yearsToRetirement + drawdownYear, inflationRate) *
    getSpendingPhaseMultiplier(drawdownYear)
  )
}

export function selectIncomeGoalShortfallAge(
  rows: YearlyProjection[],
  yearsToRetirement: number,
  desiredMonthlyIncomeToday: number,
  inflationRate: number,
): number | null {
  if (!(desiredMonthlyIncomeToday > 0)) return null
  const drawdownRows = rows.slice(yearsToRetirement)
  for (let year = 0; year < drawdownRows.length; year++) {
    const goal = incomeGoalForDrawdownYear(
      desiredMonthlyIncomeToday,
      yearsToRetirement,
      year,
      inflationRate,
    )
    if (drawdownRows[year].withdrawals < goal * (1 - INCOME_GOAL_TOLERANCE)) {
      return drawdownRows[year].age
    }
  }
  return null
}

/**
 * Surplus left at life expectancy. Never negative — a depleted portfolio reports 0.
 */
export function selectSurplusAmount(finalBalance: number): number {
  return Math.max(0, finalBalance)
}

/**
 * Reported shortfall.
 *
 * A plan that funds its income to life expectancy reports NO shortfall, regardless of any
 * income gap along the way: "shortfall" here means the money ran out before death. Any
 * gap on a funded plan is a consequence of the chosen drawdown strategy, not of
 * insufficient funds. See the note at the top of this section — that rule is settled.
 *
 * "Ran out" is read from the depletion age rather than the final balance. The two agreed
 * until the living annuity 17.5% ceiling was modelled: a plan can now fail to fund its
 * income while a residual annuity balance survives, and a positive surplus would have
 * hidden that shortfall.
 */
export function selectShortfallAmount(
  rawIncomeGap: number,
  portfolioDepletionAge: number | null,
): number {
  return portfolioDepletionAge === null ? 0 : rawIncomeGap
}

export function calculateProjection(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  assumptions?: MarketAssumptions,
): ProjectionResult {
  return calculateProjectionWithDrawdownReturns(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    assumptions,
    [],
  )
}

/**
 * The full projection with per-year drawdown return overrides (see `runDrawdownPhase`).
 * `calculateProjection` is this with `[]`; the historical stress test passes a shocked
 * first retirement year. One orchestration, so the two cannot drift apart.
 */
export function calculateProjectionWithDrawdownReturns(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  assumptions: MarketAssumptions | undefined,
  drawdownReturnOverrides: DrawdownReturnOverrides,
): ProjectionResult {
  // NaN ages fail `x < 0` comparisons (NaN < 0 is false), so a NaN age used to slip
  // straight past the guard below and poison every subsequent division. Detect
  // non-finite ages explicitly and route them through the same empty-result path as
  // inverted ages. `finiteOrZero` guards the values that *can* sensibly degrade to 0
  // (income, inflation, balances) without producing a silent wrong answer.
  const agesFinite =
    Number.isFinite(personalInfo.currentAge) &&
    Number.isFinite(personalInfo.retirementAge) &&
    Number.isFinite(personalInfo.lifeExpectancy)

  const currentAge = finiteOrZero(personalInfo.currentAge)
  const retirementAge = finiteOrZero(personalInfo.retirementAge)
  const lifeExpectancy = finiteOrZero(personalInfo.lifeExpectancy)
  const annualIncome = finiteOrZero(personalInfo.annualIncome)

  const yearsToRetirement = retirementAge - currentAge
  const yearsInRetirement = lifeExpectancy - retirementAge
  const inflationRate = finiteOrZero(retirementGoals.inflationRate) / 100

  // Sanitized copy of personalInfo with finite ages, so row ages stay finite.
  const safePersonalInfo: PersonalInfo = {
    ...personalInfo,
    currentAge,
    retirementAge,
    lifeExpectancy,
    annualIncome,
  }

  // Invalid/inverted ages (retirementAge before currentAge, or lifeExpectancy
  // before retirementAge) — the input forms guard against this with Zod, but
  // calculateProjection can be called directly (tests, debug tools, imports).
  // Non-finite ages take the same degenerate path rather than degrading to a
  // plausible-looking projection (Phase 9.1).
  if (!agesFinite || yearsToRetirement < 0 || yearsInRetirement < 0) {
    return buildEmptyProjectionResult(safePersonalInfo, retirementGoals, yearsInRetirement)
  }

  // Handle case with no accounts
  if (accounts.length === 0) {
    return buildEmptyProjectionResult(safePersonalInfo, retirementGoals, yearsInRetirement)
  }

  const compoundingMethod = assumptions?.compoundingMethod || "nominal"
  // ASSUMPTION: how far SARS raises tax thresholds in future years. Defaults to the
  // relief it actually granted over the last decade; see tax-relief.ts.
  const taxIndexation = resolveTaxThresholdIndexation(
    assumptions?.taxThresholdRelief,
    inflationRate,
  )

  // ---- Phase 1: accumulation ----
  const accumulation = runAccumulationPhase(
    accounts,
    safePersonalInfo,
    yearsToRetirement,
    inflationRate,
    compoundingMethod,
    taxIndexation,
  )
  const { accountBalances, accountCostBases, accumulatedExcessCredit } = accumulation
  const yearlyProjections: YearlyProjection[] = [...accumulation.rows]
  const portfolioAtRetirement = accumulation.portfolioAtRetirement

  // ---- Phase boundary: lump-sum commutation ----
  // Lump sum commutation is only available on pension/RA/preservation fund balances —
  // TFSA and discretionary money is not subject to the retirement lump-sum tax table.
  // SA law also caps commutation at one-third of the retirement-fund interest; the UI
  // slider enforces this too, but the engine must clamp independently since it can be
  // called directly (tests, debug tools, saved plans).
  const pensionBalanceAtRetirement = accounts.reduce(
    (sum, acc, i) => (isPensionType(acc.type) ? sum + accountBalances[i] : sum),
    0,
  )
  const cappedLumpSumPercentage = Math.min(
    drawdownConfig.lumpSumPercentage ?? 0,
    SA_TAX_LIMITS.maxLumpSumCommutationPercentage,
  )
  const lumpSumCommutation = calculateLumpSumCommutation(
    pensionBalanceAtRetirement,
    cappedLumpSumPercentage,
    accumulatedExcessCredit,
    taxThresholdScale(yearsToRetirement, taxIndexation.lumpSum),
  )
  const lumpSumFraction =
    pensionBalanceAtRetirement > 0
      ? lumpSumCommutation.lumpSumAmount / pensionBalanceAtRetirement
      : 0

  // Build per-account drawdown state with post-lump-sum balances (lump sum fraction
  // only applies to pension/RA/preservation accounts)
  const drawdownAccounts: DrawdownAccount[] = accounts.map((acc, i) => {
    const fraction = isPensionType(acc.type) ? lumpSumFraction : 0
    return {
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: accountBalances[i] * (1 - fraction),
      costBasis: accountCostBases[i] * (1 - fraction),
      netReturn: (acc.expectedReturn - acc.annualFees) / 100,
      feeRate: acc.annualFees / 100,
    }
  })

  const remainingPortfolio = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

  // Snapshot per-account balances at start of drawdown (before loop mutates them)
  const accountBalancesAtRetirement = Object.fromEntries(
    drawdownAccounts.map((a) => [a.id, a.balance]),
  )

  // ---- Phase 2: drawdown ----
  // Calculate initial withdrawal based on remaining portfolio after lump sum
  const initialAnnualWithdrawal = calculateInitialWithdrawal(
    remainingPortfolio,
    retirementGoals.desiredMonthlyIncome,
    drawdownConfig,
    yearsToRetirement,
    inflationRate,
    "strategy",
  )

  const drawdown = runDrawdownPhase(
    drawdownAccounts,
    safePersonalInfo,
    retirementGoals,
    drawdownConfig,
    yearsToRetirement,
    yearsInRetirement,
    inflationRate,
    initialAnnualWithdrawal,
    lumpSumCommutation.creditCarriedIntoDrawdown,
    compoundingMethod,
    taxIndexation,
    drawdownReturnOverrides,
  )
  yearlyProjections.push(...drawdown.rows)

  const {
    portfolioDepletionAge,
    totalLifetimeIncomeTax,
    totalMedicalAidContributions,
    totalGrossWithdrawals,
  } = drawdown
  const totalLumpSumTax = lumpSumCommutation.lumpSumTax
  const finalBalance = drawdown.finalBalance

  // ---- Phase 3: derive the summary metrics from the projected rows ----
  const monthlyIncomeAtRetirement = selectMonthlyGrossIncomeAtRetirement(
    yearlyProjections,
    yearsToRetirement,
  )
  const monthlyNetIncomeAtRetirement = selectMonthlyNetIncomeAtRetirement(
    yearlyProjections,
    yearsToRetirement,
  )
  const averageEffectiveTaxRate = selectAverageEffectiveTaxRate(
    totalLifetimeIncomeTax,
    totalGrossWithdrawals,
  )
  const rawIncomeGap = selectRawIncomeGap(
    yearlyProjections,
    yearsToRetirement,
    retirementGoals.desiredMonthlyIncome,
    inflationRate,
  )
  const finalSurplus = selectSurplusAmount(finalBalance)
  const incomeGoalShortfallAge = selectIncomeGoalShortfallAge(
    yearlyProjections,
    yearsToRetirement,
    retirementGoals.desiredMonthlyIncome,
    inflationRate,
  )
  const correctedShortfall = selectShortfallAmount(rawIncomeGap, portfolioDepletionAge)

  return {
    yearlyProjections,
    portfolioAtRetirement,
    monthlyIncomeAtRetirement,
    monthlyNetIncomeAtRetirement,
    portfolioDepletionAge,
    incomeGoalShortfallAge,
    shortfallAmount: correctedShortfall,
    surplusAmount: finalSurplus,
    totalLifetimeIncomeTax,
    totalLumpSumTax,
    totalMedicalAidContributions,
    averageEffectiveTaxRate,
    lumpSumCommutation: {
      lumpSumPercentage: cappedLumpSumPercentage,
      lumpSumAmount: lumpSumCommutation.lumpSumAmount,
      taxableLumpSum: lumpSumCommutation.taxableLumpSum,
      lumpSumTax: lumpSumCommutation.lumpSumTax,
      netLumpSum: lumpSumCommutation.netLumpSum,
      remainingPortfolio,
      accumulatedExcessCredit: lumpSumCommutation.accumulatedExcessCredit,
      creditAppliedToLumpSum: lumpSumCommutation.creditAppliedToLumpSum,
      creditCarriedIntoDrawdown: lumpSumCommutation.creditCarriedIntoDrawdown,
    },
    accumulatedExcessCredit,
    accountBalancesAtRetirement,
  }
}
