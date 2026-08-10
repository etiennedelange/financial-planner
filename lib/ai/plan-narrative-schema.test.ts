import { describe, it, expect } from "vitest"
import { planNarrativeRequestSchema } from "./plan-narrative-schema"

function validPayload() {
  return {
    accounts: [
      { type: "tfsa", currentBalance: 10000, monthlyContribution: 500, expectedReturn: 10, annualFees: 1 },
    ],
    personalInfo: { currentAge: 30, retirementAge: 65, lifeExpectancy: 90, annualIncome: 500000 },
    retirementGoals: { desiredMonthlyIncome: 20000, inflationRate: 5.5, legacyAmount: 0 },
    drawdownConfig: {
      strategy: "fixed_percentage",
      initialWithdrawalRate: 4,
      minimumWithdrawal: 0,
      maximumWithdrawal: 100000,
      lumpSumPercentage: 0,
    },
    projection: {
      portfolioAtRetirement: 1000000,
      monthlyIncomeAtRetirement: 4000,
      monthlyNetIncomeAtRetirement: 3800,
      portfolioDepletionAge: null,
    },
    simulation: null,
  }
}

describe("planNarrativeRequestSchema", () => {
  it("accepts a well-formed payload", () => {
    expect(planNarrativeRequestSchema.safeParse(validPayload()).success).toBe(true)
  })

  it("rejects an unknown account type", () => {
    const payload = validPayload()
    payload.accounts[0].type = "crypto_wallet" as never
    expect(planNarrativeRequestSchema.safeParse(payload).success).toBe(false)
  })

  it("rejects more accounts than the cap", () => {
    const payload = validPayload()
    payload.accounts = Array.from({ length: 26 }, () => payload.accounts[0])
    expect(planNarrativeRequestSchema.safeParse(payload).success).toBe(false)
  })

  it("rejects non-finite numbers (Infinity / NaN payload smuggling)", () => {
    const payload = validPayload()
    payload.personalInfo.annualIncome = Infinity
    expect(planNarrativeRequestSchema.safeParse(payload).success).toBe(false)
  })

  it("rejects a missing required field", () => {
    const payload = validPayload() as Partial<ReturnType<typeof validPayload>>
    delete payload.projection
    expect(planNarrativeRequestSchema.safeParse(payload).success).toBe(false)
  })

  it("accepts an absent tier and an unknown tier is rejected", () => {
    const payload = validPayload()
    expect(planNarrativeRequestSchema.safeParse(payload).success).toBe(true)
    expect(planNarrativeRequestSchema.safeParse({ ...payload, tier: "ultra" }).success).toBe(false)
    expect(planNarrativeRequestSchema.safeParse({ ...payload, tier: "best" }).success).toBe(true)
  })
})
