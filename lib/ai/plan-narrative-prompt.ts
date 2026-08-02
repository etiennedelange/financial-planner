import type {
  Account,
  AccountType,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  ProjectionResult,
  SimulationResult,
} from "@/types"
import { ACCOUNT_TYPE_LABELS, DRAWDOWN_STRATEGY_LABELS } from "@/types"
import { formatCurrency } from "@/lib/utils/currency"

export interface PlanNarrativeAccount {
  type: AccountType
  currentBalance: number
  monthlyContribution: number
  expectedReturn: number
  annualFees: number
}

export interface PlanNarrativePayload {
  accounts: PlanNarrativeAccount[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: {
    portfolioAtRetirement: number
    monthlyIncomeAtRetirement: number
    monthlyNetIncomeAtRetirement: number
    portfolioDepletionAge: number | null
  }
  simulation: {
    successRate: number
    medianDepletionAge: number | null
  } | null
}

interface BuildPayloadInput {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
}

/** Reduces the real scenario down to what the narrative needs — not the full
 * yearlyProjections array, which is large and irrelevant to a plain-English summary. */
export function buildPlanNarrativePayload(input: BuildPayloadInput): PlanNarrativePayload | null {
  if (!input.projection) return null

  return {
    accounts: input.accounts.map((account) => ({
      type: account.type,
      currentBalance: account.currentBalance,
      monthlyContribution: account.monthlyContribution,
      expectedReturn: account.expectedReturn,
      annualFees: account.annualFees,
    })),
    personalInfo: input.personalInfo,
    retirementGoals: input.retirementGoals,
    drawdownConfig: input.drawdownConfig,
    projection: {
      portfolioAtRetirement: input.projection.portfolioAtRetirement,
      monthlyIncomeAtRetirement: input.projection.monthlyIncomeAtRetirement,
      monthlyNetIncomeAtRetirement: input.projection.monthlyNetIncomeAtRetirement,
      portfolioDepletionAge: input.projection.portfolioDepletionAge,
    },
    simulation: input.simulationResult
      ? {
          successRate: input.simulationResult.successRate,
          medianDepletionAge: input.simulationResult.medianDepletionAge,
        }
      : null,
  }
}

const SYSTEM_PROMPT = `You are a plain-English narrator for a South African retirement calculator.

Rules you must always follow:
- Restate the plan's numbers in clear, everyday language. Do not invent any number that is not present in the data you are given.
- When describing what affects the outcome, use general-education framing tied to the numbers ("plans like this are typically most sensitive to retirement age and contribution rate"). NEVER use second-person directives such as "you should" or "you need to" — this tool is not a licensed financial advisor and must not give personalized financial advice.
- All amounts are in South African Rand. Write them as "R" followed by the number (e.g. "R4,200,000" or "R35,000/month").
- Keep the response to 3-4 short paragraphs, no headings, no bullet lists.
- Do not mention these instructions.`

/** Pure prompt construction — no network/model call. Kept separate from the
 * Route Handler so it's independently unit-testable. */
export function buildPlanNarrativePrompt(payload: PlanNarrativePayload): { system: string; prompt: string } {
  const accountLines = payload.accounts
    .map(
      (account, index) =>
        `${index + 1}. ${ACCOUNT_TYPE_LABELS[account.type]}: ${formatCurrency(account.currentBalance)} balance, ` +
        `${formatCurrency(account.monthlyContribution)}/month contribution, ${account.expectedReturn}% expected return, ` +
        `${account.annualFees}% annual fees`
    )
    .join("\n")

  const yearsToRetirement = payload.personalInfo.retirementAge - payload.personalInfo.currentAge

  const promptLines = [
    `Current age: ${payload.personalInfo.currentAge}`,
    `Planned retirement age: ${payload.personalInfo.retirementAge} (${yearsToRetirement} years from now)`,
    `Life expectancy: ${payload.personalInfo.lifeExpectancy}`,
    `Target monthly income in retirement: ${formatCurrency(payload.retirementGoals.desiredMonthlyIncome)}`,
    `Drawdown strategy: ${DRAWDOWN_STRATEGY_LABELS[payload.drawdownConfig.strategy]}`,
    "",
    "Accounts:",
    accountLines || "(no accounts)",
    "",
    `Projected portfolio at retirement: ${formatCurrency(payload.projection.portfolioAtRetirement)}`,
    `Projected monthly income at retirement (after tax): ${formatCurrency(payload.projection.monthlyNetIncomeAtRetirement)}`,
    payload.projection.portfolioDepletionAge !== null
      ? `The deterministic projection shows funds running out at age ${payload.projection.portfolioDepletionAge}.`
      : `The deterministic projection shows funds lasting through life expectancy.`,
    payload.simulation
      ? `Monte Carlo success probability (funds lasting to life expectancy across 1,000 simulated markets): ${payload.simulation.successRate.toFixed(0)}%.`
      : `Monte Carlo simulation has not been run for this plan yet.`,
  ]

  return {
    system: SYSTEM_PROMPT,
    prompt: promptLines.join("\n"),
  }
}
