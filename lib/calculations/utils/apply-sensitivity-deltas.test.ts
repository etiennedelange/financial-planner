import { describe, expect, it } from "vitest"
import type { Account, PersonalInfo, RetirementGoals } from "@/types"
import {
  applySensitivityDeltas,
  DEFAULT_SENSITIVITY_DELTAS,
  type SensitivityDeltas,
} from "./apply-sensitivity-deltas"

const personalInfo: PersonalInfo = {
  currentAge: 40,
  retirementAge: 60,
  lifeExpectancy: 90,
  annualIncome: 600000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const ra: Account = {
  id: "ra-1",
  name: "My RA",
  provider: "Test",
  type: "retirement_annuity",
  currentBalance: 500000,
  monthlyContribution: 4000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

const tfsa: Account = {
  ...ra,
  id: "tfsa-1",
  name: "TFSA",
  type: "tfsa",
  monthlyContribution: 2000,
}

const zeroContributionDiscretionary: Account = {
  ...ra,
  id: "d-1",
  name: "Discretionary",
  type: "discretionary",
  monthlyContribution: 0,
}

function deltas(overrides: Partial<SensitivityDeltas>): SensitivityDeltas {
  return { ...DEFAULT_SENSITIVITY_DELTAS, ...overrides }
}

describe("applySensitivityDeltas", () => {
  describe("Critical SA scenarios", () => {
    it("is a no-op when all deltas are at default", () => {
      const result = applySensitivityDeltas(
        [ra, tfsa],
        personalInfo,
        retirementGoals,
        DEFAULT_SENSITIVITY_DELTAS
      )
      expect(result.personalInfo).toEqual(personalInfo)
      expect(result.retirementGoals).toEqual(retirementGoals)
      expect(result.accounts).toEqual([ra, tfsa])
    })

    it("scales every nonzero-contribution account by the same percentage, preserving relative share", () => {
      const result = applySensitivityDeltas(
        [ra, tfsa],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 20 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(4800, 2) // 4000 * 1.2
      expect(result.accounts[1].monthlyContribution).toBeCloseTo(2400, 2) // 2000 * 1.2
    })

    it("leaves R0-contribution accounts untouched while a sibling nonzero account absorbs the scale", () => {
      const result = applySensitivityDeltas(
        [ra, zeroContributionDiscretionary],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 50 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(6000, 2) // 4000 * 1.5
      expect(result.accounts[1].monthlyContribution).toBe(0)
    })

    it("scales a single account 1:1", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 10 })
      )
      expect(result.accounts[0].monthlyContribution).toBeCloseTo(4400, 2)
    })

    it("overrides target monthly income directly when set", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ targetMonthlyIncomeOverride: 25000 })
      )
      expect(result.retirementGoals.desiredMonthlyIncome).toBe(25000)
    })

    it("adds the return delta on top of the account's existing expected return", () => {
      const result = applySensitivityDeltas([ra], personalInfo, retirementGoals, deltas({ returnDeltaPts: 2 }))
      expect(result.accounts[0].expectedReturn).toBe(12)
    })
  })

  describe("Edge cases", () => {
    it("floors contribution at R0 instead of going negative", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: -150 })
      )
      expect(result.accounts[0].monthlyContribution).toBe(0)
    })

    it("floors expectedReturn at 0% instead of going negative", () => {
      const result = applySensitivityDeltas([ra], personalInfo, retirementGoals, deltas({ returnDeltaPts: -20 }))
      expect(result.accounts[0].expectedReturn).toBe(0)
    })

    it("clamps retirement age offset so it never drops to or below current age", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ retirementAgeOffset: -30 })
      )
      expect(result.personalInfo.retirementAge).toBe(personalInfo.currentAge + 1)
    })

    it("clamps retirement age offset so it never exceeds life expectancy", () => {
      const result = applySensitivityDeltas(
        [ra],
        personalInfo,
        retirementGoals,
        deltas({ retirementAgeOffset: 100 })
      )
      expect(result.personalInfo.retirementAge).toBe(personalInfo.lifeExpectancy)
    })

    it("handles an empty accounts array", () => {
      const result = applySensitivityDeltas(
        [],
        personalInfo,
        retirementGoals,
        deltas({ contributionScalePct: 20, returnDeltaPts: 2 })
      )
      expect(result.accounts).toEqual([])
    })
  })
})
