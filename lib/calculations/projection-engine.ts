import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import { calculateIncomeTaxWithRebates, calculateLumpSumCommutation, calculateExcessContributionCredit } from "./retirement-tax"
import { getSpendingPhaseMultiplier } from "./utils/spending-phase"
import { calculateMonthlyReturn } from "./utils/projection"
import { deflate, escalate } from "./utils/money-time"
import { assertNonNegativeBalance } from "./utils/invariant-guards"
import { calculateInitialWithdrawal, calculateNextWithdrawal } from "./utils/drawdown-withdrawal"
import type {
  Account,
  AccountType,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
  YearlyProjection,
} from "@/types"

// Account types subject to full income tax on withdrawal
const PENSION_TYPES: AccountType[] = ['pension_fund', 'retirement_annuity', 'preservation_fund']

export interface DrawdownAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  costBasis: number // For discretionary: tracks original value (contributions + initial balance); used for CGT gain calculation
  netReturn: number // (expectedReturn - annualFees) / 100
  feeRate: number   // annualFees / 100 (for display only)
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
  yearsInRetirement: number
): ProjectionResult {
  return {
    yearlyProjections: [],
    portfolioAtRetirement: 0,
    monthlyIncomeAtRetirement: 0,
    monthlyNetIncomeAtRetirement: 0,
    portfolioDepletionAge: personalInfo.retirementAge,
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
  compoundingMethod: 'nominal' | 'compound'
): AccumulationResult {
  const rows: YearlyProjection[] = []

  // Track each account's balance and cost basis separately
  const accountBalances = accounts.map(acc => acc.currentBalance)
  const accountMonthlyContributions = accounts.map(acc => acc.monthlyContribution)
  // Cost basis tracks original value + contributions for CGT calculation on discretionary accounts
  const accountCostBases = accounts.map(acc => acc.currentBalance)

  // TFSA contribution tracking: lifetime cap starts from user-supplied contributions-to-date
  const tfsaLifetimeUsed = accounts.map(acc =>
    acc.type === 'tfsa' ? (acc.tfsaContributionsToDate ?? 0) : 0
  )

  // Section 11F excess contribution credit accumulated during the accumulation phase.
  // Income is escalated with inflation each year so the deduction limit grows in line
  // with contributions (both expressed in nominal terms).
  let accumulatedExcessCredit = 0
  let totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)

  for (let year = 0; year < yearsToRetirement; year++) {
    const age = personalInfo.currentAge + year
    const startingBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)
    let yearlyGrowth = 0
    let yearlyFees = 0
    let yearlyContributions = 0
    let yearlyPensionContributions = 0
    let tfsaExcessContribution = 0 // Track excess TFSA contributions for penalty calculation

    // Reset annual TFSA contribution tracker each year
    const tfsaYearlyUsed = accounts.map(() => 0)

    // Project each account individually
    for (let accIdx = 0; accIdx < accounts.length; accIdx++) {
      const acc = accounts[accIdx]
      const accNetReturn = (acc.expectedReturn - acc.annualFees) / 100
      const accMonthlyReturn = calculateMonthlyReturn(accNetReturn, compoundingMethod)
      const accMonthlyFeeRate = Math.pow(1 + acc.annualFees / 100, 1 / 12) - 1
      const accEscalation = acc.contributionEscalation / 100

      // Monthly compounding within each year for this account
      for (let month = 0; month < 12; month++) {
        // Calculate contribution for this month (smooth escalation)
        let monthlyContribution =
          accountMonthlyContributions[accIdx] * Math.pow(1 + accEscalation, year + month / 12)

        // Enforce TFSA annual (R46k) and lifetime (R500k) contribution limits
        // Track excess for penalty calculation (40% tax on contributions over R46k/year)
        if (acc.type === 'tfsa') {
          const intendedContribution = monthlyContribution
          const remainingLifetime = Math.max(0, TFSA_LIMITS_CONFIG.lifetimeLimit - tfsaLifetimeUsed[accIdx])
          const remainingAnnual = Math.max(0, TFSA_LIMITS_CONFIG.annualLimit - tfsaYearlyUsed[accIdx])
          monthlyContribution = Math.min(intendedContribution, remainingLifetime, remainingAnnual)

          // Track excess contribution in the annual amount (not individual months) for penalty
          const monthlyExcess = Math.max(0, intendedContribution - monthlyContribution)
          tfsaExcessContribution += monthlyExcess

          tfsaLifetimeUsed[accIdx] += monthlyContribution
          tfsaYearlyUsed[accIdx] += monthlyContribution
        }

        yearlyContributions += monthlyContribution
        if (PENSION_TYPES.includes(acc.type)) yearlyPensionContributions += monthlyContribution

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

    // Accumulate Section 11F excess credit. Income is escalated with inflation so the
    // deduction limit grows in nominal terms alongside escalating contributions.
    const effectiveIncome = escalate(personalInfo.annualIncome, year, inflationRate)
    accumulatedExcessCredit += calculateExcessContributionCredit(yearlyPensionContributions, effectiveIncome)

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
      tfsaExcessContributionPenalty: tfsaExcessContributionPenalty > 0 ? tfsaExcessContributionPenalty : 0,
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
 * Drawdown phase: tax-optimised sequential withdrawal (TFSA → Discretionary → Pension/RA).
 *
 * Mutates the `drawdownAccounts` it is given — they carry per-account balances through the
 * loop — but touches no state outside them.
 */
export function runDrawdownPhase(
  drawdownAccounts: DrawdownAccount[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  yearsToRetirement: number,
  yearsInRetirement: number,
  inflationRate: number,
  initialAnnualWithdrawal: number,
  creditCarriedIntoDrawdown: number
): DrawdownResult {
  const rows: YearlyProjection[] = []
  let annualWithdrawal = initialAnnualWithdrawal
  let creditRemaining = creditCarriedIntoDrawdown
  let portfolioDepletionAge: number | null = null
  let totalLifetimeIncomeTax = 0
  let totalMedicalAidContributions = 0
  let totalGrossWithdrawals = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = personalInfo.retirementAge + year
    let currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)
    const startingBalance = currentTotal

    if (currentTotal <= 0) {
      if (!portfolioDepletionAge) portfolioDepletionAge = age
      // Zero out all account balances when portfolio depletes so finalBalance calculation is correct
      drawdownAccounts.forEach(acc => { acc.balance = 0 })
      rows.push({
        year: yearsToRetirement + year + 1,
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
        accountBalances: Object.fromEntries(drawdownAccounts.map(a => [a.id, 0])),
        tfsaExcessContributionPenalty: 0,
      })
      continue
    }

    // Apply growth to each account individually
    let totalGrowth = 0
    let totalFees = 0
    for (const acc of drawdownAccounts) {
      if (acc.balance <= 0) continue
      const growth = acc.balance * acc.netReturn
      const fees = acc.balance * acc.feeRate
      totalGrowth += growth
      totalFees += fees
      acc.balance += growth
    }

    currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

    // From year 1 onward, recompute the base withdrawal per-strategy against the
    // live post-growth balance instead of blindly inflating last year's figure —
    // this is what makes the four strategies actually diverge over time.
    if (year > 0) {
      annualWithdrawal = calculateNextWithdrawal(
        annualWithdrawal,
        currentTotal,
        drawdownConfig,
        yearsToRetirement + year,
        inflationRate
      )
    }

    // Target withdrawal with spending phase multiplier
    const spendingMultiplier = getSpendingPhaseMultiplier(year)
    const desiredWithdrawalThisYear = annualWithdrawal * spendingMultiplier
    const targetWithdrawal = Math.min(desiredWithdrawalThisYear, currentTotal)
    // The portfolio could not fund the full withdrawal this year — the retiree ran
    // short DURING this year rather than simply starting the next one with nothing.
    const withdrawalWasClamped = targetWithdrawal < desiredWithdrawalThisYear
    let remaining = targetWithdrawal

    // 1. TFSA — fully tax-free
    let tfsaWithdrawal = 0
    for (const acc of drawdownAccounts) {
      if (acc.type !== 'tfsa' || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      acc.balance -= take
      tfsaWithdrawal += take
      remaining -= take
    }

    // 2. Discretionary — CGT on gains only, after the annual exclusion (40% inclusion rate)
    let discretionaryWithdrawal = 0
    let capitalGainRealized = 0
    for (const acc of drawdownAccounts) {
      if (acc.type !== 'discretionary' || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      const gainFraction = Math.max(0, Math.min(1, (acc.balance - acc.costBasis) / acc.balance))
      const gainTaken = take * gainFraction
      capitalGainRealized += gainTaken
      acc.costBasis = Math.max(0, acc.costBasis - take * (1 - gainFraction))
      acc.balance -= take
      discretionaryWithdrawal += take
      remaining -= take
    }
    // Annual exclusion applies once per taxpayer per year, across all discretionary accounts
    const taxableCapitalGain = Math.max(0, capitalGainRealized - SA_TAX_LIMITS.cgtAnnualExclusion)
    const cgtTaxableAmount = taxableCapitalGain * SA_TAX_LIMITS.cgtInclusionRateIndividual

    // 3. Pension / RA / Preservation — full income tax
    let pensionWithdrawal = 0
    for (const acc of drawdownAccounts) {
      if (!PENSION_TYPES.includes(acc.type) || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      acc.balance -= take
      pensionWithdrawal += take
      remaining -= take
    }

    const totalWithdrawal = tfsaWithdrawal + discretionaryWithdrawal + pensionWithdrawal

    // Apply any remaining Section 11F credit against pension annuity income
    const creditAppliedThisYear = Math.min(pensionWithdrawal, creditRemaining)
    creditRemaining -= creditAppliedThisYear

    // Only pension withdrawals and CGT inclusion amount are taxable income
    const taxableIncome = (pensionWithdrawal - creditAppliedThisYear) + cgtTaxableAmount
    const incomeTax = calculateIncomeTaxWithRebates(
      taxableIncome,
      age,
      drawdownConfig.monthlyMedicalAid ? drawdownConfig.medicalAidDependants ?? 0 : undefined
    )
    // monthlyMedicalAid is entered in today's Rands; escalate to retirement-year value
    // using medical inflation (9%) not general inflation (5.5%), since SA medical costs
    // grow faster than CPI
    const medicalAidContribution =
      (drawdownConfig.monthlyMedicalAid ?? 0) *
      Math.pow(1 + SA_DEFAULTS.medicalInflation, yearsToRetirement + year) *
      12
    const netIncome = totalWithdrawal - incomeTax - medicalAidContribution

    currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

    // Depletion is normally detected at the START of a year (see the guard at the
    // top of this loop), but that never fires for a portfolio which empties during
    // the FINAL year — there is no subsequent iteration to observe it. Catch it
    // here so the engine can't report a zero ending balance and a null depletion
    // age at the same time.
    //
    // Only a clamped withdrawal counts. A retiree who drew their full income every
    // year and happens to land on exactly R0 at life expectancy has not run out
    // early — that is a perfectly funded plan, not a depletion.
    if (currentTotal <= 0 && withdrawalWasClamped && !portfolioDepletionAge) {
      portfolioDepletionAge = age
    }

    totalGrossWithdrawals += totalWithdrawal
    totalLifetimeIncomeTax += incomeTax
    totalMedicalAidContributions += medicalAidContribution

    rows.push({
      year: yearsToRetirement + year + 1,
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
      endingBalance: Math.max(0, assertNonNegativeBalance(currentTotal, `drawdown year at age ${age}`)),
      inflationAdjustedWithdrawal: deflate(totalWithdrawal, yearsToRetirement + year, inflationRate),
      tfsaWithdrawal,
      discretionaryWithdrawal,
      pensionWithdrawal,
      cgtTaxableAmount,
      taxableIncome,
      accountBalances: Object.fromEntries(
        drawdownAccounts.map(a => [
          a.id,
          Math.max(0, assertNonNegativeBalance(a.balance, `account ${a.id} at age ${age}`)),
        ])
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

export function calculateProjection(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  assumptions?: MarketAssumptions
): ProjectionResult {
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge
  const inflationRate = retirementGoals.inflationRate / 100

  // Invalid/inverted ages (retirementAge before currentAge, or lifeExpectancy
  // before retirementAge) — the input forms guard against this with Zod, but
  // calculateProjection can be called directly (tests, debug tools, imports).
  if (yearsToRetirement < 0 || yearsInRetirement < 0) {
    return buildEmptyProjectionResult(personalInfo, retirementGoals, yearsInRetirement)
  }

  // Handle case with no accounts
  if (accounts.length === 0) {
    return buildEmptyProjectionResult(personalInfo, retirementGoals, yearsInRetirement)
  }

  const compoundingMethod = assumptions?.compoundingMethod || 'nominal'

  // ---- Phase 1: accumulation ----
  const accumulation = runAccumulationPhase(
    accounts,
    personalInfo,
    yearsToRetirement,
    inflationRate,
    compoundingMethod
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
    (sum, acc, i) => (PENSION_TYPES.includes(acc.type) ? sum + accountBalances[i] : sum),
    0
  )
  const cappedLumpSumPercentage = Math.min(
    drawdownConfig.lumpSumPercentage ?? 0,
    SA_TAX_LIMITS.maxLumpSumCommutationPercentage
  )
  const lumpSumCommutation = calculateLumpSumCommutation(
    pensionBalanceAtRetirement,
    cappedLumpSumPercentage,
    accumulatedExcessCredit,
  )
  const lumpSumFraction = pensionBalanceAtRetirement > 0
    ? lumpSumCommutation.lumpSumAmount / pensionBalanceAtRetirement
    : 0

  // Build per-account drawdown state with post-lump-sum balances (lump sum fraction
  // only applies to pension/RA/preservation accounts)
  const drawdownAccounts: DrawdownAccount[] = accounts.map((acc, i) => {
    const fraction = PENSION_TYPES.includes(acc.type) ? lumpSumFraction : 0
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
    drawdownAccounts.map(a => [a.id, a.balance])
  )

  // ---- Phase 2: drawdown ----
  // Calculate initial withdrawal based on remaining portfolio after lump sum
  const initialAnnualWithdrawal = calculateInitialWithdrawal(
    remainingPortfolio,
    retirementGoals.desiredMonthlyIncome,
    drawdownConfig,
    yearsToRetirement,
    inflationRate,
    "strategy"
  )

  const drawdown = runDrawdownPhase(
    drawdownAccounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    yearsToRetirement,
    yearsInRetirement,
    inflationRate,
    initialAnnualWithdrawal,
    lumpSumCommutation.creditCarriedIntoDrawdown
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

  const monthlyIncomeAtRetirement =
    calculateInitialWithdrawal(
      remainingPortfolio,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig,
      yearsToRetirement,
      inflationRate,
      "strategy"
    ) / 12

  // Net income after tax — sourced from the first drawdown year's projection so it
  // reflects the actual account-mix tax treatment (TFSA tax-free, CGT on discretionary,
  // full income tax on pension/RA/preservation) and medical aid, instead of re-taxing
  // the gross withdrawal as if it were all ordinary income.
  const firstDrawdownYear = yearlyProjections[yearsToRetirement]
  const monthlyNetIncomeAtRetirement = firstDrawdownYear
    ? firstDrawdownYear.netIncome / 12
    : 0

  // Calculate average effective tax rate
  const averageEffectiveTaxRate =
    totalGrossWithdrawals > 0
      ? (totalLifetimeIncomeTax / totalGrossWithdrawals) * 100
      : 0

  // Calculate shortfall by comparing the inflation-adjusted desired income against
  // what was actually withdrawn each drawdown year, not just the year-0 target.
  // Comparing only the initial target (as before) was structurally always 0 for
  // every strategy except fixed_percentage, because calculateInitialWithdrawal
  // returns the desired amount verbatim for the other three strategies — so a
  // portfolio that fully depletes years before life expectancy (withdrawals
  // dropping to R0) never registered as a shortfall. Summing the per-year gap
  // against actual withdrawals captures both depletion and guardrail/variable
  // cuts below the desired income.
  const desiredMonthlyAtRetirement =
    escalate(retirementGoals.desiredMonthlyIncome, yearsToRetirement, inflationRate)
  const shortfallAmount = yearlyProjections
    .slice(yearsToRetirement)
    .reduce((sum, yp, drawdownYear) => {
      const desiredAnnualThisYear =
        escalate(desiredMonthlyAtRetirement * 12, drawdownYear, inflationRate)
      return sum + Math.max(0, desiredAnnualThisYear - yp.withdrawals)
    }, 0)

  // Critical constraint: if portfolio survives with surplus, there's no shortfall
  // (any gap is due to spending phase strategy, not insufficient funds)
  const finalSurplus = Math.max(0, finalBalance)
  const correctedShortfall = finalSurplus > 0 ? 0 : shortfallAmount

  return {
    yearlyProjections,
    portfolioAtRetirement,
    monthlyIncomeAtRetirement,
    monthlyNetIncomeAtRetirement,
    portfolioDepletionAge,
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
