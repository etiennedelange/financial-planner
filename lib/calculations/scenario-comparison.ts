import type { PersonalInfo, RetirementGoals, DrawdownConfig, CompoundingMethod } from "@/types"
import { runMonteCarloSimulation as runMonteCarlo } from "@/lib/monte-carlo/simulation-engine"
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
 * Simple Monte Carlo simulation for success probability
 */
function runSimpleMonteCarloSimulation(
  startingBalance: number,
  annualWithdrawal: number,
  targetYears: number,
  expectedReturn: number,
  volatility: number,
  inflation: number,
  iterations: number = 1000
): number {
  let successCount = 0

  for (let i = 0; i < iterations; i++) {
    let balance = startingBalance
    let yearlyWithdrawal = annualWithdrawal
    let success = true

    for (let year = 0; year < targetYears; year++) {
      // Generate random return using Box-Muller transform
      const u1 = Math.random()
      const u2 = Math.random()
      const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2)
      const logMean = Math.log(1 + expectedReturn) - 0.5 * volatility * volatility
      const randomReturn = Math.exp(logMean + volatility * z) - 1

      // Apply return first
      balance *= 1 + randomReturn

      // Apply spending phase
      const spendingMultiplier = getSpendingPhaseMultiplier(year)
      const adjustedWithdrawal = yearlyWithdrawal * spendingMultiplier

      // Then withdraw
      balance -= adjustedWithdrawal

      if (balance <= 0) {
        success = false
        break
      }

      yearlyWithdrawal *= 1 + inflation
    }

    if (success) successCount++
  }

  return (successCount / iterations) * 100
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
  const yearsInRetirement = personalInfo.lifeExpectancy - personalInfo.retirementAge
  const inflationRate = retirementGoals.inflationRate / 100

  const results: Record<ScenarioType, ScenarioResult> = {} as Record<
    ScenarioType,
    ScenarioResult
  >

  for (const [key, scenario] of Object.entries(INVESTMENT_SCENARIOS)) {
    const scenarioKey = key as ScenarioType
    // Nominal return for accumulation phase (consistent with main projection)
    const nominalReturn = scenario.nominalReturn - fees
    // Real return for sustainability/drawdown analysis (accounts for inflation)
    const realReturn = scenario.nominalReturn - inflationRate - fees

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

    // How many years the savings will last
    const yearsLasts = projectRetirementDuration(
      projectedNestEgg,
      annualWithdrawal,
      realReturn,
      inflationRate
    )

    // Monte Carlo success probability
    const successProbability = runSimpleMonteCarloSimulation(
      projectedNestEgg,
      annualWithdrawal,
      yearsInRetirement,
      realReturn,
      scenario.volatility,
      inflationRate
    )

    // Monthly income supported by portfolio
    const withdrawalRate = drawdownConfig.initialWithdrawalRate / 100
    const monthlyIncomeAtRetirement = (projectedNestEgg * withdrawalRate) / 12

    results[scenarioKey] = {
      scenario: scenario.name,
      description: scenario.description,
      allocation: scenario.allocation,
      nominalReturn: scenario.nominalReturn * 100,
      realReturn: realReturn * 100,
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
