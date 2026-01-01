import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  YearlyProjection,
  ProjectionResult,
} from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"

/**
 * Calculate weighted average return from accounts
 */
function calculateWeightedReturn(accounts: Account[]): number {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  if (totalBalance === 0) return SA_DEFAULTS.equityReturn
  return accounts.reduce(
    (sum, acc) =>
      sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
    0
  )
}

/**
 * Calculate weighted average fees from accounts
 */
function calculateWeightedFees(accounts: Account[]): number {
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  if (totalBalance === 0) return 0.01
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
 */
function calculateInitialWithdrawal(
  portfolioValue: number,
  desiredMonthlyIncome: number,
  config: DrawdownConfig
): number {
  switch (config.strategy) {
    case "fixed_percentage":
      return portfolioValue * (config.initialWithdrawalRate / 100)
    case "fixed_amount_inflation_adjusted":
      return desiredMonthlyIncome * 12
    case "variable_percentage":
    case "guardrails":
      return Math.min(
        Math.max(desiredMonthlyIncome * 12, config.minimumWithdrawal * 12),
        config.maximumWithdrawal * 12
      )
    default:
      return portfolioValue * SA_DEFAULTS.safeWithdrawalRate
  }
}

/**
 * Main projection calculation
 */
export function calculateProjection(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig
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

  // Accumulation phase
  for (let year = 0; year < yearsToRetirement; year++) {
    const age = personalInfo.currentAge + year
    const startingBalance = totalBalance
    const growth = totalBalance * netReturn
    const fees = totalBalance * weightedFees

    totalBalance = startingBalance + totalContribution + growth

    yearlyProjections.push({
      year: year + 1,
      age,
      startingBalance,
      contributions: totalContribution,
      growth,
      fees,
      withdrawals: 0,
      endingBalance: totalBalance,
      inflationAdjustedWithdrawal: 0,
    })

    totalContribution *= 1 + avgEscalation
  }

  const portfolioAtRetirement = totalBalance

  // Calculate initial withdrawal based on strategy
  let annualWithdrawal = calculateInitialWithdrawal(
    portfolioAtRetirement,
    retirementGoals.desiredMonthlyIncome,
    drawdownConfig
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

    const withdrawal = Math.min(annualWithdrawal, totalBalance)
    const postWithdrawalBalance = totalBalance - withdrawal
    const growth = postWithdrawalBalance * netReturn
    const fees = postWithdrawalBalance * weightedFees

    totalBalance = postWithdrawalBalance + growth

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
      drawdownConfig
    ) / 12

  const shortfallAmount =
    Math.max(0, retirementGoals.desiredMonthlyIncome - monthlyIncomeAtRetirement) *
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
