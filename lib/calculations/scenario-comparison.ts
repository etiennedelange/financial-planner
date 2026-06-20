import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod, MarketAssumptions } from "@/types"
import { runMonteCarloSimulation } from "@/lib/monte-carlo/simulation-engine"
import { projectFinalSavings } from "./utils/projection"
import { getSpendingPhaseMultiplier } from "./utils/spending-phase"

// SA-specific investment scenarios (nominal returns)
export const INVESTMENT_SCENARIOS = {
  conservative: {
    name: "Conservative",
    description: "Lower risk, more stable returns",
    nominalReturn: 0.105, // 10.5%
    volatility: 0.10, // 10%
    allocation: "60% bonds, 30% equity, 10% cash",
  },
  balanced: {
    name: "Balanced",
    description: "Moderate risk, typical balanced fund",
    nominalReturn: 0.12, // 12%
    volatility: 0.14, // 14%
    allocation: "60% equity, 30% bonds, 10% cash",
  },
  aggressive: {
    name: "Aggressive",
    description: "Higher risk, higher potential returns",
    nominalReturn: 0.14, // 14%
    volatility: 0.18, // 18%
    allocation: "85% equity, 10% bonds, 5% cash",
  },
} as const

export type ScenarioType = keyof typeof INVESTMENT_SCENARIOS

interface ScenarioComparisonParams {
  currentSavings: number
  monthlyContribution: number
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  contributionEscalation: number // decimal
  fees: number // decimal
  compoundingMethod: CompoundingMethod
}

interface ScenarioResult {
  scenario: string
  description: string
  allocation: string
  nominalReturn: number
  realReturn: number
  volatility: number
  projectedNestEgg: number
  yearsLasts: number
  successProbability: number
  monthlyIncomeAtRetirement: number
}

interface ScenarioComparisonResult {
  conservative: ScenarioResult
  balanced: ScenarioResult
  aggressive: ScenarioResult
  recommendedScenario: ScenarioType
  recommendation: string
}

/**
 * Project how long retirement savings will last
 */
function projectRetirementDuration(
  savings: number,
  firstYearExpenses: number,
  realReturn: number,
  inflation: number
): number {
  let yearsCovered = 0
  let remainingSavings = savings
  let yearlyExpenses = firstYearExpenses

  while (remainingSavings > 0 && yearsCovered < 50) {
    const withdrawalRate = getSpendingPhaseMultiplier(yearsCovered)
    const actualWithdrawal = yearlyExpenses * withdrawalRate

    if (remainingSavings < actualWithdrawal) break

    remainingSavings -= actualWithdrawal
    remainingSavings *= 1 + realReturn
    yearlyExpenses *= 1 + inflation
    yearsCovered++
  }

  return yearsCovered
}

/**
 * Full Monte Carlo simulation including both accumulation and drawdown phases.
 * Delegates to the shared simulation-engine.ts (single source of truth for the
 * Monte Carlo methodology) by wrapping the scenario's aggregate inputs into a
 * single synthetic account, rather than reimplementing accumulation/drawdown here.
 *
 * The withdrawal always targets the user's desired income (not the configured
 * drawdown strategy) to preserve this function's historical behavior of testing
 * "can this scenario fund my actual income goal" — equivalent to forcing the
 * 'fixed_amount_inflation_adjusted' strategy with no lump sum.
 */
function runFullMonteCarloSimulation(
  currentBalance: number,
  monthlyContribution: number,
  contributionEscalation: number,
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  expectedReturn: number,
  volatility: number,
  compoundingMethod: CompoundingMethod,
  iterations: number = 1000
): number {
  const syntheticAccount: Account = {
    id: "scenario-comparison-synthetic",
    name: "Scenario Portfolio",
    provider: "",
    type: "discretionary",
    currentBalance,
    monthlyContribution,
    expectedReturn: expectedReturn * 100,
    annualFees: 0, // expectedReturn is already net of fees
    contributionEscalation: contributionEscalation * 100,
  }

  const marketAssumptions: MarketAssumptions = {
    equityReturn: syntheticAccount.expectedReturn,
    bondReturn: syntheticAccount.expectedReturn,
    cashReturn: syntheticAccount.expectedReturn,
    equityVolatility: volatility * 100,
    bondVolatility: volatility * 100,
    inflationRate: retirementGoals.inflationRate,
    compoundingMethod,
  }

  const syntheticDrawdownConfig: DrawdownConfig = {
    strategy: "fixed_amount_inflation_adjusted",
    initialWithdrawalRate: 0,
    minimumWithdrawal: 0,
    maximumWithdrawal: Number.MAX_SAFE_INTEGER,
    lumpSumPercentage: 0,
  }

  const result = runMonteCarloSimulation(
    [syntheticAccount],
    personalInfo,
    retirementGoals,
    syntheticDrawdownConfig,
    { numberOfRuns: iterations },
    marketAssumptions
  )

  return result.successRate
}

/**
 * Compare retirement outcomes across Conservative, Balanced, and Aggressive scenarios
 */
export function compareScenarios(
  params: ScenarioComparisonParams
): ScenarioComparisonResult {
  const {
    currentSavings,
    monthlyContribution,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    contributionEscalation,
    fees,
    compoundingMethod,
  } = params

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflationRate = retirementGoals.inflationRate / 100

  const results: Record<ScenarioType, ScenarioResult> = {} as Record<
    ScenarioType,
    ScenarioResult
  >

  for (const [key, scenario] of Object.entries(INVESTMENT_SCENARIOS)) {
    const scenarioKey = key as ScenarioType
    // Nominal return for all calculations (consistent with main simulation)
    // This ensures scenarios use the same methodology as the main Monte Carlo
    const nominalReturn = scenario.nominalReturn - fees
    // Real return is only used for display purposes (informational)
    const realReturnForDisplay = scenario.nominalReturn - inflationRate - fees

    // Project nest egg at retirement using nominal returns
    const projectedNestEgg = projectFinalSavings(
      currentSavings,
      monthlyContribution,
      yearsToRetirement,
      contributionEscalation,
      nominalReturn,
      compoundingMethod
    )

    // Calculate annual withdrawal at retirement
    const desiredMonthlyAtRetirement =
      retirementGoals.desiredMonthlyIncome *
      Math.pow(1 + inflationRate, yearsToRetirement)
    const annualWithdrawal = desiredMonthlyAtRetirement * 12

    // How many years the savings will last (using nominal return, withdrawals inflate)
    const yearsLasts = projectRetirementDuration(
      projectedNestEgg,
      annualWithdrawal,
      nominalReturn,
      inflationRate
    )

    // Monte Carlo success probability including both accumulation and drawdown phases
    // This matches the main simulation methodology in simulation-engine.ts
    const successProbability = runFullMonteCarloSimulation(
      currentSavings,
      monthlyContribution,
      contributionEscalation,
      personalInfo,
      retirementGoals,
      nominalReturn,
      scenario.volatility,
      compoundingMethod
    )

    // Monthly income supported by portfolio
    const withdrawalRate = drawdownConfig.initialWithdrawalRate / 100
    const monthlyIncomeAtRetirement = (projectedNestEgg * withdrawalRate) / 12

    results[scenarioKey] = {
      scenario: scenario.name,
      description: scenario.description,
      allocation: scenario.allocation,
      nominalReturn: scenario.nominalReturn * 100,
      realReturn: realReturnForDisplay * 100,
      volatility: scenario.volatility * 100,
      projectedNestEgg,
      yearsLasts,
      successProbability,
      monthlyIncomeAtRetirement,
    }
  }

  // Determine recommended scenario based on success probability and years to retirement
  let recommendedScenario: ScenarioType = "balanced"
  let recommendation = ""

  if (yearsToRetirement > 20) {
    // Longer time horizon - can take more risk
    if (results.aggressive.successProbability >= 70) {
      recommendedScenario = "aggressive"
      recommendation =
        "With 20+ years to retirement, you can afford higher risk for potentially better returns."
    } else {
      recommendedScenario = "balanced"
      recommendation =
        "A balanced approach provides good growth potential with manageable risk."
    }
  } else if (yearsToRetirement > 10) {
    // Medium time horizon
    if (results.balanced.successProbability >= 75) {
      recommendedScenario = "balanced"
      recommendation =
        "With 10-20 years to retirement, a balanced approach balances growth and security."
    } else {
      recommendedScenario = "conservative"
      recommendation =
        "Consider a more conservative approach to protect your accumulated savings."
    }
  } else {
    // Short time horizon - prioritize capital preservation
    recommendedScenario = "conservative"
    recommendation =
      "With less than 10 years to retirement, prioritize capital preservation over growth."
  }

  // Adjust recommendation if success probability is very low
  if (results[recommendedScenario].successProbability < 50) {
    recommendation +=
      " Note: Current projections show a lower success probability. Consider increasing contributions or adjusting retirement goals."
  }

  return {
    conservative: results.conservative,
    balanced: results.balanced,
    aggressive: results.aggressive,
    recommendedScenario,
    recommendation,
  }
}
