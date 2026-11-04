import type {
  Account,
  DrawdownConfig,
  InvestmentType,
  MarketAssumptions,
  PersonalInfo,
  ProjectionResult,
  RetirementGoals,
} from "@/types"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import {
  calculateProjection,
  calculateProjectionWithDrawdownReturns,
  incomeGoalForDrawdownYear,
  type DrawdownReturnOverrides,
} from "./projection-engine"
import { resolveAccountRisk } from "./utils/account-risk"
import { finiteOrZero } from "./utils/invariant-guards"
import { deflate } from "./utils/money-time"

/** How one account is shocked in the stress year */
export interface StressShock {
  accountId: string
  accountName: string
  investmentType: InvestmentType | null
  /** Market return in the bad year, decimal; null = this account does not fall */
  marketReturn: number | null
  /** Net return applied (market return minus the account's fees), decimal; null = unchanged */
  netReturnApplied: number | null
  /** Where the figure comes from, for display */
  period: string
  /** True when the figure is a calendar year, which understates a 12-month fall */
  understated: boolean
}

/** The outcome measures the stress test reports, for one projection */
export interface StressOutcome {
  /** First age the income goal is not met in full; null = met to life expectancy */
  incomeGoalShortfallAge: number | null
  /** Money left at life expectancy, nominal rands */
  finalBalance: number
  /** Money left at life expectancy in today's rands */
  finalBalanceToday: number
  /** The worst drawdown year's income as a share of that year's goal (0–1); null = no goal */
  lowestIncomeShareOfGoal: number | null
}

export interface StressTestResult {
  retirementAge: number
  lifeExpectancy: number
  steady: StressOutcome
  stressed: StressOutcome
  shocks: StressShock[]
}

/**
 * The "bad first year of retirement" scenario: in drawdown year 0 every account earns its
 * investment type's worst researched 12-month return (see resolveAccountRisk for untyped
 * accounts), net of the account's own fees; from year 1 it returns to its expected return.
 *
 * Fees are subtracted because the engine's returns are net of fees. The factsheet figures
 * for multi-asset and SA equity are already net of fund fees, so this double-counts a
 * little — the cautious direction for a stress test.
 */
export function buildFirstYearStress(
  accounts: Account[],
  untypedVolatility: number,
): { overrides: DrawdownReturnOverrides; shocks: StressShock[] } {
  const shocks = accounts.map((acc): StressShock => {
    const risk = resolveAccountRisk(acc, untypedVolatility)
    const marketReturn = risk.stressReturn
    const typeRisk = risk.investmentType ? INVESTMENT_TYPE_RISK[risk.investmentType] : null
    return {
      accountId: acc.id,
      accountName: acc.name,
      investmentType: risk.investmentType,
      marketReturn,
      netReturnApplied:
        marketReturn === null ? null : marketReturn - finiteOrZero(acc.annualFees) / 100,
      period: typeRisk
        ? typeRisk.stressPeriod
        : marketReturn === null
          ? "0% expected return: treated as cash"
          : `no investment type: SA equity, ${INVESTMENT_TYPE_RISK.sa_equity.stressPeriod}`,
      understated: typeRisk?.stressUnderstated ?? false,
    }
  })
  return { overrides: [shocks.map((s) => s.netReturnApplied)], shocks }
}

/** Reduce a projection to the measures the stress test compares */
export function summariseStressOutcome(
  projection: ProjectionResult,
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
): StressOutcome {
  const yearsToRetirement = Math.max(0, personalInfo.retirementAge - personalInfo.currentAge)
  const totalYears = Math.max(0, personalInfo.lifeExpectancy - personalInfo.currentAge)
  const inflationRate = finiteOrZero(retirementGoals.inflationRate) / 100
  const drawdownRows = projection.yearlyProjections.slice(yearsToRetirement)
  const finalBalance = drawdownRows.at(-1)?.endingBalance ?? projection.portfolioAtRetirement

  let lowestIncomeShareOfGoal: number | null = null
  if (retirementGoals.desiredMonthlyIncome > 0) {
    drawdownRows.forEach((row, year) => {
      const goal = incomeGoalForDrawdownYear(
        retirementGoals.desiredMonthlyIncome,
        yearsToRetirement,
        year,
        inflationRate,
      )
      if (goal <= 0) return
      const share = Math.min(1, Math.max(0, row.withdrawals / goal))
      lowestIncomeShareOfGoal =
        lowestIncomeShareOfGoal === null ? share : Math.min(lowestIncomeShareOfGoal, share)
    })
  }

  return {
    incomeGoalShortfallAge: projection.incomeGoalShortfallAge ?? null,
    finalBalance,
    finalBalanceToday: deflate(finalBalance, totalYears, inflationRate),
    lowestIncomeShareOfGoal,
  }
}

/**
 * Historical stress test: the plan with steady returns versus the same plan with a
 * 2008-style fall in the first year of retirement. Deterministic — it reuses the whole
 * projection engine with a first-year return override, so it cannot drift from it.
 */
export function calculateStressTest(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  assumptions: MarketAssumptions | undefined,
): StressTestResult {
  const untypedVolatility = assumptions
    ? finiteOrZero(assumptions.equityVolatility) / 100
    : SA_DEFAULTS.equityVolatility
  const { overrides, shocks } = buildFirstYearStress(accounts, untypedVolatility)

  const steadyProjection = calculateProjection(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    assumptions,
  )
  const stressedProjection = calculateProjectionWithDrawdownReturns(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    assumptions,
    overrides,
  )

  return {
    retirementAge: personalInfo.retirementAge,
    lifeExpectancy: personalInfo.lifeExpectancy,
    steady: summariseStressOutcome(steadyProjection, personalInfo, retirementGoals),
    stressed: summariseStressOutcome(stressedProjection, personalInfo, retirementGoals),
    shocks,
  }
}
