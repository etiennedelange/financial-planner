import { z } from "zod/v4"

const accountTypeSchema = z.enum([
  "pension_fund",
  "retirement_annuity",
  "preservation_fund",
  "tfsa",
  "discretionary",
])

const drawdownStrategySchema = z.enum([
  "fixed_percentage",
  "fixed_amount_inflation_adjusted",
  "variable_percentage",
  "guardrails",
])

const finiteNumber = z.number().finite()

const accountSchema = z.object({
  type: accountTypeSchema,
  currentBalance: finiteNumber,
  monthlyContribution: finiteNumber,
  expectedReturn: finiteNumber,
  annualFees: finiteNumber,
})

/**
 * Caps the account list at what the UI can realistically produce, so a
 * malicious client can't inflate the prompt (and the AI bill) with an
 * arbitrarily large payload.
 */
const MAX_ACCOUNTS = 25

export const planNarrativeRequestSchema = z.object({
  accounts: z.array(accountSchema).max(MAX_ACCOUNTS),
  personalInfo: z.object({
    currentAge: finiteNumber,
    retirementAge: finiteNumber,
    lifeExpectancy: finiteNumber,
    annualIncome: finiteNumber,
  }),
  retirementGoals: z.object({
    desiredMonthlyIncome: finiteNumber,
    inflationRate: finiteNumber,
    legacyAmount: finiteNumber,
  }),
  drawdownConfig: z.object({
    strategy: drawdownStrategySchema,
    initialWithdrawalRate: finiteNumber,
    minimumWithdrawal: finiteNumber,
    maximumWithdrawal: finiteNumber,
    lumpSumPercentage: finiteNumber,
    monthlyMedicalAid: finiteNumber.optional(),
    medicalAidDependants: finiteNumber.optional(),
    upperGuardrail: finiteNumber.optional(),
    lowerGuardrail: finiteNumber.optional(),
  }),
  projection: z.object({
    portfolioAtRetirement: finiteNumber,
    monthlyIncomeAtRetirement: finiteNumber,
    monthlyNetIncomeAtRetirement: finiteNumber,
    portfolioDepletionAge: finiteNumber.nullable(),
  }),
  simulation: z
    .object({
      successRate: finiteNumber,
      medianDepletionAge: finiteNumber.nullable(),
    })
    .nullable(),
  tier: z.enum(["fast", "balanced", "best"]).optional(),
})

export type PlanNarrativeRequest = z.infer<typeof planNarrativeRequestSchema>
