import { describe, expect, it } from "vite-plus/test"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
  ProjectionResult,
} from "@/types"
import { buildPlanNarrativePayload, buildPlanNarrativePrompt } from "./plan-narrative-prompt"

const personalInfo: PersonalInfo = {
  currentAge: 45,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 600000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const drawdownConfig: DrawdownConfig = {
  strategy: "fixed_percentage",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 0,
}

const ra: Account = {
  id: "ra-1",
  name: "My RA",
  provider: "Test",
  type: "retirement_annuity",
  currentBalance: 800000,
  monthlyContribution: 5000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

const tfsa: Account = {
  ...ra,
  id: "tfsa-1",
  name: "TFSA",
  type: "tfsa",
  monthlyContribution: 3000,
}

const zeroContributionDiscretionary: Account = {
  ...ra,
  id: "d-1",
  name: "Discretionary",
  type: "discretionary",
  monthlyContribution: 0,
}

function baseProjection(overrides: Partial<ProjectionResult> = {}): ProjectionResult {
  return {
    yearlyProjections: [],
    portfolioAtRetirement: 4200000,
    monthlyIncomeAtRetirement: 28000,
    monthlyNetIncomeAtRetirement: 25000,
    portfolioDepletionAge: null,
    incomeGoalShortfallAge: null,
    shortfallAmount: 0,
    surplusAmount: 0,
    totalLifetimeIncomeTax: 0,
    totalLumpSumTax: 0,
    totalMedicalAidContributions: 0,
    averageEffectiveTaxRate: 0,
    lumpSumCommutation: {
      lumpSumPercentage: 0,
      lumpSumAmount: 0,
      taxableLumpSum: 0,
      lumpSumTax: 0,
      netLumpSum: 0,
      remainingPortfolio: 0,
      accumulatedExcessCredit: 0,
      creditAppliedToLumpSum: 0,
      creditCarriedIntoDrawdown: 0,
    },
    accumulatedExcessCredit: 0,
    accountBalancesAtRetirement: {},
    ...overrides,
  }
}

describe("buildPlanNarrativePayload", () => {
  it("returns null when there is no projection yet", () => {
    const result = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: null,
    })
    expect(result).toBeNull()
  })

  it("sends no Monte Carlo figures: market risk lives on the Risk page", () => {
    const result = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })
    expect(result).not.toHaveProperty("simulation")
  })
})

describe("buildPlanNarrativePrompt", () => {
  it("always includes the general-education, no-directives constraint", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    const { system } = buildPlanNarrativePrompt(payload)
    expect(system).toContain("NEVER use second-person directives")
  })

  it("lists every account for a multi-account plan", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra, tfsa],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("Retirement Annuity (RA)")
    expect(prompt).toContain("Tax-Free Savings Account (TFSA)")
  })

  it("describes a single-account plan without error", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("Retirement Annuity (RA)")
  })

  it("reports a deterministic depletion age plainly", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection({ portfolioDepletionAge: 78 }),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("funds running out at age 78")
  })

  it("still describes a plan where every account has R0 contribution", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [zeroContributionDiscretionary],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("R 0/month contribution")
  })

  it("states that the figures assume steady returns and quotes no success rate", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    const { prompt } = buildPlanNarrativePrompt(payload)
    expect(prompt).toContain("assume steady investment returns")
    expect(prompt).not.toMatch(/success probability|Monte Carlo/i)
  })

  it("states whether the projected income meets the desired income", () => {
    const meets = buildPlanNarrativePrompt(
      buildPlanNarrativePayload({
        accounts: [ra],
        personalInfo,
        retirementGoals,
        drawdownConfig,
        projection: baseProjection(),
      })!,
    ).prompt
    expect(meets).toContain("meets the desired income every year")
    const short = buildPlanNarrativePrompt(
      buildPlanNarrativePayload({
        accounts: [ra],
        personalInfo,
        retirementGoals,
        drawdownConfig,
        projection: baseProjection({ incomeGoalShortfallAge: 70 }),
      })!,
    ).prompt
    expect(short).toContain("falls below the desired income from age 70")
  })

  it("omits the goal line for a payload from a client that predates the field", () => {
    const payload = buildPlanNarrativePayload({
      accounts: [ra],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      projection: baseProjection(),
    })!
    delete payload.projection.incomeGoalShortfallAge
    expect(buildPlanNarrativePrompt(payload).prompt).not.toContain("desired income every year")
  })
})
