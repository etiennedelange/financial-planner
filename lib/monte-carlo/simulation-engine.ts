import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
  SimulationConfig,
  SimulationRun,
  SimulationResult,
} from "@/types"
import { generateReturnSequence, getPercentile } from "./random-returns"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { calculateIncomeTaxWithRebates } from "../calculations/retirement-tax"

/**
 * Calculate spending phase multiplier based on years in retirement
 * Models the "Go-Go, Slow-Go, No-Go" retirement phases
 */
function getSpendingPhaseMultiplier(yearsInRetirement: number): number {
  if (yearsInRetirement <= 15) {
    return 1.0 // Go-Go phase
  } else if (yearsInRetirement <= 25) {
    return 0.8 // Slow-Go phase
  } else {
    const baseRate = 0.7
    const medicalPremium = 0.15 * (yearsInRetirement - 25) / 10
    return Math.min(baseRate + medicalPremium, 1.2)
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
 * Calculate initial withdrawal for simulation based on strategy
 *
 * IMPORTANT: The success rate should reflect whether the user can achieve their
 * desired retirement income goal. For all strategies, we use the desired income
 * as the baseline withdrawal to test if the plan meets the user's actual needs.
 *
 * The strategy affects HOW withdrawals are adjusted over time, but the baseline
 * must reflect the user's income goal for the success rate to be meaningful.
 */
function calculateSimulationWithdrawal(
  portfolioAtRetirement: number,
  desiredMonthlyIncomeToday: number,
  strategy: string,
  withdrawalRate: number,
  yearsToRetirement: number,
  inflationRate: number
): number {
  // Inflate desired income to retirement date
  const desiredMonthlyAtRetirement =
    desiredMonthlyIncomeToday * Math.pow(1 + inflationRate, yearsToRetirement)

  // Annual desired income at retirement
  const desiredAnnualAtRetirement = desiredMonthlyAtRetirement * 12

  switch (strategy) {
    case "fixed_percentage":
      // Use the GREATER of percentage-based withdrawal or desired income
      // This ensures success rate reflects whether the user can achieve their goal
      // If percentage > desired, we test the more conservative scenario
      // If percentage < desired, we test the actual income need
      const percentageWithdrawal = portfolioAtRetirement * withdrawalRate
      return Math.max(percentageWithdrawal, desiredAnnualAtRetirement)
    case "fixed_amount_inflation_adjusted":
      return desiredAnnualAtRetirement
    case "variable_percentage":
    case "guardrails":
      return desiredAnnualAtRetirement
    default:
      return Math.max(portfolioAtRetirement * withdrawalRate, desiredAnnualAtRetirement)
  }
}

/**
 * Simulate a single run with stochastic returns
 */
function simulateSingleRun(
  runId: number,
  initialBalance: number,
  monthlyContribution: number,
  expectedReturn: number,
  volatility: number,
  fees: number,
  escalation: number,
  yearsToRetirement: number,
  yearsInRetirement: number,
  inflationRate: number,
  desiredMonthlyIncome: number,
  strategy: string,
  withdrawalRate: number,
  lifeExpectancy: number,
  currentAge: number,
  compoundingMethod: 'nominal' | 'compound'
): SimulationRun {
  const totalYears = yearsToRetirement + yearsInRetirement
  const returns = generateReturnSequence(expectedReturn - fees, volatility, totalYears)

  let balance = initialBalance
  const yearlyBalances: number[] = []
  let depletionAge: number | null = null

  // Accumulation phase with MONTHLY compounding (matches deterministic projection)
  for (let year = 0; year < yearsToRetirement; year++) {
    const annualReturn = returns[year]

    // Calculate monthly return based on compounding method
    const monthlyReturn = compoundingMethod === 'compound'
      ? Math.pow(1 + annualReturn, 1 / 12) - 1  // Mathematically correct
      : annualReturn / 12                        // Nominal (Excel-compatible)

    // Monthly compounding within each year
    for (let month = 0; month < 12; month++) {
      // Calculate contribution for this month (smooth escalation)
      const currentMonthlyContribution = monthlyContribution * Math.pow(1 + escalation, year + month / 12)

      // Apply growth first (end-of-period contributions, matches Excel FV type=0)
      balance = balance * (1 + monthlyReturn)

      // Then add contribution
      balance += currentMonthlyContribution
    }

    yearlyBalances.push(balance)
  }

  // Drawdown phase - calculate withdrawal based on strategy
  // NOTE: Withdrawals represent gross amounts (before tax). Tax is implicitly
  // included in the withdrawal amount. For detailed tax analysis, see the
  // deterministic projection engine which tracks annual tax calculations.
  let withdrawal = calculateSimulationWithdrawal(
    balance,
    desiredMonthlyIncome,
    strategy,
    withdrawalRate,
    yearsToRetirement,
    inflationRate
  )

  for (let year = yearsToRetirement; year < totalYears; year++) {
    if (balance <= 0 && !depletionAge) {
      depletionAge = currentAge + year
    }

    // Apply return FIRST (on full balance before withdrawal)
    if (balance > 0) {
      balance = balance * (1 + returns[year])
    }

    // Apply spending phase multiplier (Go-Go/Slow-Go/No-Go)
    const yearsInRetirement = year - yearsToRetirement
    const spendingMultiplier = getSpendingPhaseMultiplier(yearsInRetirement)
    const adjustedWithdrawal = withdrawal * spendingMultiplier

    // THEN withdraw
    balance = Math.max(0, balance - adjustedWithdrawal)
    yearlyBalances.push(balance)

    withdrawal *= 1 + inflationRate
  }

  return {
    runId,
    yearlyBalances,
    finalBalance: balance,
    depletionAge,
    success: balance > 0,
  }
}

/**
 * Aggregate results from all simulation runs
 */
function aggregateResults(
  runs: SimulationRun[],
  totalYears: number
): SimulationResult {
  const successCount = runs.filter((r) => r.success).length
  const successRate = (successCount / runs.length) * 100

  // Calculate percentiles for each year
  const percentiles = {
    p10: [] as number[],
    p25: [] as number[],
    p50: [] as number[],
    p75: [] as number[],
    p90: [] as number[],
  }

  for (let year = 0; year < totalYears; year++) {
    const balancesAtYear = runs
      .map((r) => r.yearlyBalances[year] || 0)
      .sort((a, b) => a - b)

    percentiles.p10.push(getPercentile(balancesAtYear, 10))
    percentiles.p25.push(getPercentile(balancesAtYear, 25))
    percentiles.p50.push(getPercentile(balancesAtYear, 50))
    percentiles.p75.push(getPercentile(balancesAtYear, 75))
    percentiles.p90.push(getPercentile(balancesAtYear, 90))
  }

  const depletionAges = runs
    .map((r) => r.depletionAge)
    .filter((age): age is number => age !== null)
    .sort((a, b) => a - b)

  return {
    runs,
    successRate,
    percentiles,
    medianDepletionAge:
      depletionAges.length > 0 ? getPercentile(depletionAges, 50) : null,
    averageFinalBalance:
      runs.reduce((sum, r) => sum + r.finalBalance, 0) / runs.length,
  }
}

/**
 * Run Monte Carlo simulation
 */
export function runMonteCarloSimulation(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  config: SimulationConfig,
  marketAssumptions?: MarketAssumptions
): SimulationResult {
  // Handle empty accounts
  if (accounts.length === 0) {
    return {
      runs: [],
      successRate: 0,
      percentiles: { p10: [], p25: [], p50: [], p75: [], p90: [] },
      medianDepletionAge: personalInfo.retirementAge,
      averageFinalBalance: 0,
    }
  }

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge
  const totalYears = yearsToRetirement + yearsInRetirement
  const inflationRate = retirementGoals.inflationRate / 100

  // Aggregate account data
  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const totalMonthlyContribution = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution,
    0
  )
  const weightedReturn = calculateWeightedReturn(accounts)
  const weightedFees = calculateWeightedFees(accounts)
  const avgEscalation = calculateAverageEscalation(accounts)

  // Use volatility from market assumptions if provided, otherwise use default
  const volatility = marketAssumptions
    ? marketAssumptions.equityVolatility / 100
    : SA_DEFAULTS.equityVolatility

  // Use compounding method from market assumptions, default to nominal for backward compatibility
  const compoundingMethod = marketAssumptions?.compoundingMethod || 'nominal'

  const runs: SimulationRun[] = []

  for (let runId = 0; runId < config.numberOfRuns; runId++) {
    const run = simulateSingleRun(
      runId,
      totalBalance,
      totalMonthlyContribution,
      weightedReturn,
      volatility,
      weightedFees,
      avgEscalation,
      yearsToRetirement,
      yearsInRetirement,
      inflationRate,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig.strategy,
      drawdownConfig.initialWithdrawalRate / 100,
      personalInfo.lifeExpectancy,
      personalInfo.currentAge,
      compoundingMethod
    )
    runs.push(run)
  }

  return aggregateResults(runs, totalYears)
}
