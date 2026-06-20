import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import { calculateIncomeTaxWithRebates, calculateLumpSumCommutation, calculateExcessContributionCredit } from "./retirement-tax"
import { getSpendingPhaseMultiplier } from "./utils/spending-phase"
import { calculateMonthlyReturn } from "./utils/projection"
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

interface DrawdownAccount {
  id: string
  name: string
  type: AccountType
  balance: number
  costBasis: number // For discretionary: tracks original value (contributions + initial balance); used for CGT gain calculation
  netReturn: number // (expectedReturn - annualFees) / 100
  feeRate: number   // annualFees / 100 (for display only)
}

/**
 * Calculate weighted average return from accounts
 * When balance is 0, weight by contributions instead of balance
 */
function calculateWeightedReturn(accounts: Account[]): number {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)

  // If balance is 0, weight by monthly contributions
  if (totalBalance === 0) {
    const totalContribution = accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
    if (totalContribution === 0) return SA_DEFAULTS.equityReturn
    return accounts.reduce(
      (sum, acc) =>
        sum + (acc.expectedReturn / 100) * (acc.monthlyContribution / totalContribution),
      0
    )
  }

  return accounts.reduce(
    (sum, acc) =>
      sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
    0
  )
}

/**
 * Calculate weighted average fees from accounts
 * When balance is 0, weight by contributions instead of balance
 */
function calculateWeightedFees(accounts: Account[]): number {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)

  // If balance is 0, weight by monthly contributions
  if (totalBalance === 0) {
    const totalContribution = accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
    if (totalContribution === 0) return 0.01
    return accounts.reduce(
      (sum, acc) =>
        sum + (acc.annualFees / 100) * (acc.monthlyContribution / totalContribution),
      0
    )
  }

  return accounts.reduce(
    (sum, acc) =>
      sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
    0
  )
}

/**
 * Calculate average contribution escalation rate
 */
function calculateAverageEscalation(accounts: Account[]): number {
  if (accounts.length === 0) return SA_DEFAULTS.contributionEscalation
  return (
    accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
    accounts.length
  )
}

/**
 * Calculate initial annual withdrawal based on strategy
 * @param portfolioValue - Portfolio value at retirement
 * @param desiredMonthlyIncomeToday - Desired monthly income in today's Rands
 * @param config - Drawdown configuration
 * @param yearsToRetirement - Years until retirement (for inflation adjustment)
 * @param inflationRate - Annual inflation rate (decimal)
 */
function calculateInitialWithdrawal(
  portfolioValue: number,
  desiredMonthlyIncomeToday: number,
  config: DrawdownConfig,
  yearsToRetirement: number,
  inflationRate: number
): number {
  // Inflate desired income to retirement date (nominal value at retirement)
  const desiredMonthlyAtRetirement =
    desiredMonthlyIncomeToday * Math.pow(1 + inflationRate, yearsToRetirement)

  switch (config.strategy) {
    case "fixed_percentage":
      return portfolioValue * (config.initialWithdrawalRate / 100)
    case "fixed_amount_inflation_adjusted":
      return desiredMonthlyAtRetirement * 12
    case "variable_percentage":
    case "guardrails":
      // Also inflate min/max to retirement values
      const minAtRetirement = config.minimumWithdrawal * Math.pow(1 + inflationRate, yearsToRetirement)
      const maxAtRetirement = config.maximumWithdrawal * Math.pow(1 + inflationRate, yearsToRetirement)
      return Math.min(
        Math.max(desiredMonthlyAtRetirement * 12, minAtRetirement * 12),
        maxAtRetirement * 12
      )
    default:
      return portfolioValue * SA_DEFAULTS.safeWithdrawalRate
  }
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

  const yearlyProjections: YearlyProjection[] = []

  // Aggregate account data
  let totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  let totalContribution = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution * 12,
    0
  )
  const weightedReturn = calculateWeightedReturn(accounts)
  const weightedFees = calculateWeightedFees(accounts)
  const avgEscalation = calculateAverageEscalation(accounts)

  const netReturn = weightedReturn - weightedFees

  // Handle case with no accounts
  if (accounts.length === 0) {
    return buildEmptyProjectionResult(personalInfo, retirementGoals, yearsInRetirement)
  }

  // Accumulation phase with monthly compounding
  // Project each account separately to handle different return rates correctly
  const compoundingMethod = assumptions?.compoundingMethod || 'nominal'

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

  for (let year = 0; year < yearsToRetirement; year++) {
    const age = personalInfo.currentAge + year
    const startingBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)
    let yearlyGrowth = 0
    let yearlyFees = 0
    let yearlyContributions = 0
    let yearlyPensionContributions = 0

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

        // Enforce TFSA annual (R36k) and lifetime (R500k) contribution limits
        if (acc.type === 'tfsa') {
          const remainingLifetime = Math.max(0, TFSA_LIMITS_CONFIG.lifetimeLimit - tfsaLifetimeUsed[accIdx])
          const remainingAnnual = Math.max(0, TFSA_LIMITS_CONFIG.annualLimit - tfsaYearlyUsed[accIdx])
          monthlyContribution = Math.min(monthlyContribution, remainingLifetime, remainingAnnual)
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
    const effectiveIncome = personalInfo.annualIncome * Math.pow(1 + inflationRate, year)
    accumulatedExcessCredit += calculateExcessContributionCredit(yearlyPensionContributions, effectiveIncome)

    yearlyProjections.push({
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
    })
  }

  const portfolioAtRetirement = totalBalance

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

  // Calculate initial withdrawal based on remaining portfolio after lump sum
  let annualWithdrawal = calculateInitialWithdrawal(
    remainingPortfolio,
    retirementGoals.desiredMonthlyIncome,
    drawdownConfig,
    yearsToRetirement,
    inflationRate
  )

  // Drawdown phase — tax-optimized sequential withdrawal: TFSA → Discretionary → Pension/RA
  let creditRemaining = lumpSumCommutation.creditCarriedIntoDrawdown
  let portfolioDepletionAge: number | null = null
  let totalLifetimeIncomeTax = 0
  const totalLumpSumTax = lumpSumCommutation.lumpSumTax
  let totalMedicalAidContributions = 0
  let totalGrossWithdrawals = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = personalInfo.retirementAge + year
    let currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)
    const startingBalance = currentTotal

    if (currentTotal <= 0) {
      if (!portfolioDepletionAge) portfolioDepletionAge = age
      yearlyProjections.push({
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

    // Target withdrawal with spending phase multiplier
    const spendingMultiplier = getSpendingPhaseMultiplier(year)
    const targetWithdrawal = Math.min(annualWithdrawal * spendingMultiplier, currentTotal)
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
    const medicalAidContribution =
      (drawdownConfig.monthlyMedicalAid ?? 0) *
      Math.pow(1 + inflationRate, yearsToRetirement + year) *
      12
    const netIncome = totalWithdrawal - incomeTax - medicalAidContribution

    currentTotal = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

    totalGrossWithdrawals += totalWithdrawal
    totalLifetimeIncomeTax += incomeTax
    totalMedicalAidContributions += medicalAidContribution

    yearlyProjections.push({
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
      endingBalance: Math.max(0, currentTotal),
      inflationAdjustedWithdrawal: totalWithdrawal / Math.pow(1 + inflationRate, year),
      tfsaWithdrawal,
      discretionaryWithdrawal,
      pensionWithdrawal,
      cgtTaxableAmount,
      taxableIncome,
      accountBalances: Object.fromEntries(drawdownAccounts.map(a => [a.id, Math.max(0, a.balance)])),
      excessCreditApplied: creditAppliedThisYear,
      excessCreditRemaining: creditRemaining,
    })

    annualWithdrawal *= 1 + inflationRate
  }

  // Use remaining balance from per-account tracking for surplus
  const finalBalance = drawdownAccounts.reduce((s, a) => s + a.balance, 0)

  const monthlyIncomeAtRetirement =
    calculateInitialWithdrawal(
      remainingPortfolio,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig,
      yearsToRetirement,
      inflationRate
    ) / 12

  // Calculate monthly net income (after tax)
  const annualGrossIncomeAtRetirement = monthlyIncomeAtRetirement * 12
  const firstYearTax = calculateIncomeTaxWithRebates(
    annualGrossIncomeAtRetirement,
    personalInfo.retirementAge
  )
  const annualNetIncomeAtRetirement = annualGrossIncomeAtRetirement - firstYearTax
  const monthlyNetIncomeAtRetirement = annualNetIncomeAtRetirement / 12

  // Calculate average effective tax rate
  const averageEffectiveTaxRate =
    totalGrossWithdrawals > 0
      ? (totalLifetimeIncomeTax / totalGrossWithdrawals) * 100
      : 0

  // Calculate shortfall based on inflation-adjusted desired income at retirement
  const desiredMonthlyAtRetirement =
    retirementGoals.desiredMonthlyIncome * Math.pow(1 + inflationRate, yearsToRetirement)
  const shortfallAmount =
    Math.max(0, desiredMonthlyAtRetirement - monthlyIncomeAtRetirement) *
    12 *
    yearsInRetirement

  return {
    yearlyProjections,
    portfolioAtRetirement,
    monthlyIncomeAtRetirement,
    monthlyNetIncomeAtRetirement,
    portfolioDepletionAge,
    shortfallAmount,
    surplusAmount: Math.max(0, finalBalance),
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
