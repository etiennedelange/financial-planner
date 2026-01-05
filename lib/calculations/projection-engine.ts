import { SA_DEFAULTS } from "@/lib/constants/defaults"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
  YearlyProjection,
} from "@/types"

/**
 * Calculate spending phase multiplier based on years in retirement
 * Models the "Go-Go, Slow-Go, No-Go" retirement phases:
 * - Years 0-15: Active years with full spending (100%)
 * - Years 15-25: Slower years with reduced spending (80%)
 * - Years 25+: Less active with lower base (70%) but higher medical costs
 */
function getSpendingPhaseMultiplier(yearsInRetirement: number): number {
  if (yearsInRetirement <= 15) {
    // Go-Go phase: full spending
    return 1.0
  } else if (yearsInRetirement <= 25) {
    // Slow-Go phase: reduced activity spending
    return 0.8
  } else {
    // No-Go phase: lower base but add medical premium (SA medical inflation is high)
    const baseRate = 0.7
    const medicalPremium = 0.15 * (yearsInRetirement - 25) / 10
    return Math.min(baseRate + medicalPremium, 1.2) // Cap at 120%
  }
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
 * Calculate monthly return from annual return based on compounding method
 */
function calculateMonthlyReturn(annualReturn: number, method: 'nominal' | 'compound'): number {
  if (method === 'compound') {
    // Mathematically correct: (1 + annual)^(1/12) - 1
    return Math.pow(1 + annualReturn, 1 / 12) - 1
  } else {
    // Nominal rate (Excel FV compatible): annual / 12
    return annualReturn / 12
  }
}

/**
 * Main projection calculation
 */
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
    return {
      yearlyProjections: [],
      portfolioAtRetirement: 0,
      monthlyIncomeAtRetirement: 0,
      portfolioDepletionAge: personalInfo.retirementAge,
      shortfallAmount: retirementGoals.desiredMonthlyIncome * 12 * yearsInRetirement,
      surplusAmount: 0,
    }
  }

  // Accumulation phase with monthly compounding
  const compoundingMethod = assumptions?.compoundingMethod || 'nominal'
  const monthlyReturn = calculateMonthlyReturn(netReturn, compoundingMethod)
  const monthlyFeeRate = Math.pow(1 + weightedFees, 1 / 12) - 1
  const baseMonthlyContribution = totalContribution / 12

  for (let year = 0; year < yearsToRetirement; year++) {
    const age = personalInfo.currentAge + year
    const startingBalance = totalBalance
    let yearlyGrowth = 0
    let yearlyFees = 0
    let yearlyContributions = 0

    // Monthly compounding within each year
    for (let month = 0; month < 12; month++) {
      // Calculate contribution for this month (smooth escalation)
      const monthlyContribution =
        baseMonthlyContribution * Math.pow(1 + avgEscalation, year + month / 12)
      yearlyContributions += monthlyContribution

      // Apply growth first (end-of-period contributions, matches Excel FV type=0)
      // Original (beginning-of-period, type=1): contribution added before growth
      const monthGrowth = totalBalance * monthlyReturn
      const monthFees = totalBalance * monthlyFeeRate
      yearlyGrowth += monthGrowth
      yearlyFees += monthFees
      totalBalance += monthGrowth

      // Then add contribution (doesn't earn interest until next month)
      totalBalance += monthlyContribution
    }

    yearlyProjections.push({
      year: year + 1,
      age,
      startingBalance,
      contributions: yearlyContributions,
      growth: yearlyGrowth,
      fees: yearlyFees,
      withdrawals: 0,
      endingBalance: totalBalance,
      inflationAdjustedWithdrawal: 0,
    })
  }

  const portfolioAtRetirement = totalBalance

  // Calculate initial withdrawal based on strategy
  let annualWithdrawal = calculateInitialWithdrawal(
    portfolioAtRetirement,
    retirementGoals.desiredMonthlyIncome,
    drawdownConfig,
    yearsToRetirement,
    inflationRate
  )

  // Drawdown phase
  let portfolioDepletionAge: number | null = null

  for (let year = 0; year < yearsInRetirement; year++) {
    const age = personalInfo.retirementAge + year
    const startingBalance = totalBalance

    if (totalBalance <= 0) {
      if (!portfolioDepletionAge) {
        portfolioDepletionAge = age
      }
      // Continue tracking years with zero balance
      yearlyProjections.push({
        year: yearsToRetirement + year + 1,
        age,
        startingBalance: 0,
        contributions: 0,
        growth: 0,
        fees: 0,
        withdrawals: 0,
        endingBalance: 0,
        inflationAdjustedWithdrawal: 0,
      })
      continue
    }

    // Apply return FIRST (on full balance before withdrawal)
    const growth = totalBalance * netReturn
    const fees = totalBalance * weightedFees
    const balanceAfterGrowth = totalBalance + growth

    // Apply spending phase multiplier (Go-Go/Slow-Go/No-Go)
    const spendingMultiplier = getSpendingPhaseMultiplier(year)
    const adjustedWithdrawal = annualWithdrawal * spendingMultiplier

    // THEN withdraw
    const withdrawal = Math.min(adjustedWithdrawal, balanceAfterGrowth)
    totalBalance = balanceAfterGrowth - withdrawal

    yearlyProjections.push({
      year: yearsToRetirement + year + 1,
      age,
      startingBalance,
      contributions: 0,
      growth,
      fees,
      withdrawals: withdrawal,
      endingBalance: Math.max(0, totalBalance),
      inflationAdjustedWithdrawal: withdrawal / Math.pow(1 + inflationRate, year),
    })

    // Adjust withdrawal for inflation
    annualWithdrawal *= 1 + inflationRate
  }

  const monthlyIncomeAtRetirement =
    calculateInitialWithdrawal(
      portfolioAtRetirement,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig,
      yearsToRetirement,
      inflationRate
    ) / 12

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
    portfolioDepletionAge,
    shortfallAmount,
    surplusAmount: Math.max(0, totalBalance),
  }
}
