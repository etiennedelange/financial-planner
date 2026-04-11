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
import { getSpendingPhaseMultiplier } from "@/lib/calculations/utils/spending-phase"

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
 * Now accepts per-account data to project each account separately during accumulation
 */
function simulateSingleRun(
  runId: number,
  accounts: Account[],
  volatility: number,
  yearsToRetirement: number,
  yearsInRetirement: number,
  inflationRate: number,
  desiredMonthlyIncome: number,
  strategy: string,
  withdrawalRate: number,
  currentAge: number,
  compoundingMethod: 'nominal' | 'compound'
): SimulationRun {
  const totalYears = yearsToRetirement + yearsInRetirement

  // Track each account's balance separately during accumulation
  const accountBalances = accounts.map(acc => acc.currentBalance)
  const accountMonthlyContributions = accounts.map(acc => acc.monthlyContribution)

  // Generate return sequences for each account based on their expected return
  const accountReturns = accounts.map(acc => {
    const netReturn = (acc.expectedReturn - acc.annualFees) / 100
    // Use per-account volatility (0 for cash/fixed accounts, or proportional to return)
    const accVolatility = acc.expectedReturn === 0 ? 0 : volatility
    return generateReturnSequence(netReturn, accVolatility, totalYears)
  })

  const yearlyBalances: number[] = []
  let depletionAge: number | null = null

  // Accumulation phase - project each account separately
  for (let year = 0; year < yearsToRetirement; year++) {
    // Project each account individually
    for (let accIdx = 0; accIdx < accounts.length; accIdx++) {
      const acc = accounts[accIdx]
      const annualReturn = accountReturns[accIdx][year]
      const accEscalation = acc.contributionEscalation / 100

      // Calculate monthly return based on compounding method
      const monthlyReturn = compoundingMethod === 'compound'
        ? Math.pow(1 + annualReturn, 1 / 12) - 1  // Mathematically correct
        : annualReturn / 12                        // Nominal (Excel-compatible)

      // Monthly compounding within each year for this account
      for (let month = 0; month < 12; month++) {
        // Calculate contribution for this month (smooth escalation)
        const currentMonthlyContribution =
          accountMonthlyContributions[accIdx] * Math.pow(1 + accEscalation, year + month / 12)

        // Apply growth first (end-of-period contributions, matches Excel FV type=0)
        accountBalances[accIdx] = accountBalances[accIdx] * (1 + monthlyReturn)

        // Then add contribution
        accountBalances[accIdx] += currentMonthlyContribution
      }
    }

    const totalBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)
    yearlyBalances.push(totalBalance)
  }

  // Combined balance at retirement for drawdown phase
  let balance = accountBalances.reduce((sum, bal) => sum + bal, 0)

  // Calculate weighted return for drawdown phase based on account balances at retirement
  const totalRetirementBalance = balance
  const weightedReturnForDrawdown = totalRetirementBalance > 0
    ? accounts.reduce((sum, acc, idx) => {
        const accNetReturn = (acc.expectedReturn - acc.annualFees) / 100
        return sum + accNetReturn * (accountBalances[idx] / totalRetirementBalance)
      }, 0)
    : SA_DEFAULTS.equityReturn - 0.01 // Default if somehow balance is 0

  // Generate return sequence for drawdown phase using weighted return
  const drawdownReturns = generateReturnSequence(weightedReturnForDrawdown, volatility, yearsInRetirement)

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

  for (let year = 0; year < yearsInRetirement; year++) {
    if (balance <= 0 && !depletionAge) {
      depletionAge = currentAge + yearsToRetirement + year
    }

    // Apply return FIRST (on full balance before withdrawal)
    if (balance > 0) {
      balance = balance * (1 + drawdownReturns[year])
    }

    // Apply spending phase multiplier (Go-Go/Slow-Go/No-Go)
    const spendingMultiplier = getSpendingPhaseMultiplier(year)
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
      accounts,
      volatility,
      yearsToRetirement,
      yearsInRetirement,
      inflationRate,
      retirementGoals.desiredMonthlyIncome,
      drawdownConfig.strategy,
      drawdownConfig.initialWithdrawalRate / 100,
      personalInfo.currentAge,
      compoundingMethod
    )
    runs.push(run)
  }

  return aggregateResults(runs, totalYears)
}
