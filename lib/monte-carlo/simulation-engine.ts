import type {
  Account,
  AccountType,
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
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { getSpendingPhaseMultiplier } from "@/lib/calculations/utils/spending-phase"
import { calculateMonthlyReturn } from "@/lib/calculations/utils/projection"
import { calculateIncomeTaxWithRebates, calculateLumpSumCommutation } from "@/lib/calculations/retirement-tax"
import { calculateNextWithdrawal } from "@/lib/calculations/utils/drawdown-withdrawal"

// Account types subject to full income tax on withdrawal — mirrors projection-engine.ts
const PENSION_TYPES: AccountType[] = ['pension_fund', 'retirement_annuity', 'preservation_fund']

interface DrawdownAccount {
  type: AccountType
  balance: number
  costBasis: number // For discretionary: tracks original value + contributions, for CGT gain calc
  returns: number[] // Full totalYears stochastic return sequence (accumulation + drawdown years)
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
  drawdownConfig: DrawdownConfig,
  currentAge: number,
  compoundingMethod: 'nominal' | 'compound',
  lumpSumPercentage: number = 0
): SimulationRun {
  const totalYears = yearsToRetirement + yearsInRetirement

  // Track each account's balance and cost basis separately during accumulation
  const accountBalances = accounts.map(acc => acc.currentBalance)
  const accountCostBases = accounts.map(acc => acc.currentBalance)
  const accountMonthlyContributions = accounts.map(acc => acc.monthlyContribution)

  // Generate return sequences for each account based on their expected return.
  // Full totalYears length so the same per-account sequence can be reused for the
  // drawdown phase (indices [yearsToRetirement, totalYears)) below.
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
      const monthlyReturn = calculateMonthlyReturn(annualReturn, compoundingMethod)

      // Monthly compounding within each year for this account
      for (let month = 0; month < 12; month++) {
        // Calculate contribution for this month (smooth escalation)
        const currentMonthlyContribution =
          accountMonthlyContributions[accIdx] * Math.pow(1 + accEscalation, year + month / 12)

        // Apply growth first (end-of-period contributions, matches Excel FV type=0)
        accountBalances[accIdx] = accountBalances[accIdx] * (1 + monthlyReturn)

        // Then add contribution
        accountBalances[accIdx] += currentMonthlyContribution
        accountCostBases[accIdx] += currentMonthlyContribution
      }
    }

    const totalBalance = accountBalances.reduce((sum, bal) => sum + bal, 0)
    yearlyBalances.push(totalBalance)
  }

  const portfolioAtRetirement = accountBalances.reduce((sum, bal) => sum + bal, 0)

  // Lump sum commutation is only available on pension/RA/preservation balances, and SA
  // law caps it at one-third of the retirement-fund interest — mirrors projection-engine.ts.
  const pensionBalanceAtRetirement = accounts.reduce(
    (sum, acc, idx) => (PENSION_TYPES.includes(acc.type) ? sum + accountBalances[idx] : sum),
    0
  )
  const cappedLumpSumPercentage = Math.min(
    Math.max(0, lumpSumPercentage),
    SA_TAX_LIMITS.maxLumpSumCommutationPercentage
  )
  const lumpSumFraction = pensionBalanceAtRetirement > 0 ? cappedLumpSumPercentage / 100 : 0
  const lumpSumTax =
    pensionBalanceAtRetirement > 0
      ? calculateLumpSumCommutation(pensionBalanceAtRetirement, cappedLumpSumPercentage).lumpSumTax
      : 0

  // Build per-account drawdown state with post-lump-sum balances (only pension-type
  // accounts are reduced by the commutation fraction)
  const drawdownAccounts: DrawdownAccount[] = accounts.map((acc, idx) => {
    const fraction = PENSION_TYPES.includes(acc.type) ? lumpSumFraction : 0
    return {
      type: acc.type,
      balance: accountBalances[idx] * (1 - fraction),
      costBasis: accountCostBases[idx] * (1 - fraction),
      returns: accountReturns[idx],
    }
  })

  let balance = drawdownAccounts.reduce((sum, a) => sum + a.balance, 0)

  // Drawdown phase - calculate withdrawal based on strategy
  let withdrawal = calculateSimulationWithdrawal(
    balance,
    desiredMonthlyIncome,
    drawdownConfig.strategy,
    drawdownConfig.initialWithdrawalRate / 100,
    yearsToRetirement,
    inflationRate
  )

  let lifetimeIncomeTax = 0

  for (let year = 0; year < yearsInRetirement; year++) {
    if (balance <= 0 && !depletionAge) {
      depletionAge = currentAge + yearsToRetirement + year
    }

    // Apply growth per-account FIRST (on full balance before withdrawal), continuing
    // each account's own stochastic return sequence from the accumulation phase
    for (const acc of drawdownAccounts) {
      if (acc.balance <= 0) continue
      acc.balance *= 1 + acc.returns[yearsToRetirement + year]
    }

    balance = drawdownAccounts.reduce((sum, a) => sum + a.balance, 0)

    // From year 1 onward, recompute the base withdrawal per-strategy against the
    // live post-growth balance instead of blindly inflating last year's figure —
    // mirrors projection-engine.ts so the deterministic and Monte Carlo engines
    // diverge identically across drawdown strategies.
    if (year > 0) {
      withdrawal = calculateNextWithdrawal(
        withdrawal,
        balance,
        drawdownConfig,
        yearsToRetirement + year,
        inflationRate,
        desiredMonthlyIncome
      )
    }

    // Apply spending phase multiplier (Go-Go/Slow-Go/No-Go)
    const spendingMultiplier = getSpendingPhaseMultiplier(year)
    const targetWithdrawal = Math.min(withdrawal * spendingMultiplier, Math.max(0, balance))
    let remaining = targetWithdrawal

    // Tax-optimized sequential withdrawal: TFSA -> Discretionary -> Pension/RA, mirrors
    // the deterministic projection engine's account-type-aware sourcing. Tax is computed
    // for reporting only (it does not force additional portfolio liquidation, matching
    // how the deterministic engine treats tax as a reduction of net spendable income).
    for (const acc of drawdownAccounts) {
      if (acc.type !== 'tfsa' || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      acc.balance -= take
      remaining -= take
    }

    let capitalGainRealized = 0
    for (const acc of drawdownAccounts) {
      if (acc.type !== 'discretionary' || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      const gainFraction = Math.max(0, Math.min(1, (acc.balance - acc.costBasis) / acc.balance))
      capitalGainRealized += take * gainFraction
      acc.costBasis = Math.max(0, acc.costBasis - take * (1 - gainFraction))
      acc.balance -= take
      remaining -= take
    }
    const taxableCapitalGain = Math.max(0, capitalGainRealized - SA_TAX_LIMITS.cgtAnnualExclusion)
    const cgtTaxableAmount = taxableCapitalGain * SA_TAX_LIMITS.cgtInclusionRateIndividual

    let pensionWithdrawal = 0
    for (const acc of drawdownAccounts) {
      if (!PENSION_TYPES.includes(acc.type) || remaining <= 0 || acc.balance <= 0) continue
      const take = Math.min(remaining, acc.balance)
      acc.balance -= take
      pensionWithdrawal += take
      remaining -= take
    }

    const age = currentAge + yearsToRetirement + year
    const taxableIncome = pensionWithdrawal + cgtTaxableAmount
    lifetimeIncomeTax += calculateIncomeTaxWithRebates(taxableIncome, age)

    balance = Math.max(0, drawdownAccounts.reduce((sum, a) => sum + a.balance, 0))
    yearlyBalances.push(balance)
  }

  return {
    runId,
    yearlyBalances,
    finalBalance: balance,
    depletionAge,
    success: balance > 0,
    lifetimeIncomeTax,
    lumpSumTax,
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
    averageLifetimeIncomeTax:
      runs.reduce((sum, r) => sum + (r.lifetimeIncomeTax ?? 0), 0) / runs.length,
    averageLumpSumTax:
      runs.reduce((sum, r) => sum + (r.lumpSumTax ?? 0), 0) / runs.length,
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
      drawdownConfig,
      personalInfo.currentAge,
      compoundingMethod,
      drawdownConfig.lumpSumPercentage ?? 0
    )
    runs.push(run)
  }

  return aggregateResults(runs, totalYears)
}
