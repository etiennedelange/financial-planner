import type { Account, PersonalInfo, RetirementGoals } from "@/types"

export interface SensitivityDeltas {
  retirementAgeOffset: number // years, default 0
  contributionScalePct: number // %, default 0 = no change
  returnDeltaPts: number // percentage points, default 0
  targetMonthlyIncomeOverride: number | null // null = use real value
}

export const DEFAULT_SENSITIVITY_DELTAS: SensitivityDeltas = {
  retirementAgeOffset: 0,
  contributionScalePct: 0,
  returnDeltaPts: 0,
  targetMonthlyIncomeOverride: null,
}

interface AppliedSensitivity {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Pure transform: applies sandbox deltas to the real plan's inputs, producing
 * scaled copies to feed into the existing calculateProjection /
 * runMonteCarloSimulation engines unmodified. No calculation logic lives here.
 */
export function applySensitivityDeltas(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  deltas: SensitivityDeltas
): AppliedSensitivity {
  const scaledPersonalInfo: PersonalInfo = {
    ...personalInfo,
    retirementAge: clamp(
      personalInfo.retirementAge + deltas.retirementAgeOffset,
      personalInfo.currentAge + 1,
      personalInfo.lifeExpectancy
    ),
  }

  const scaledRetirementGoals: RetirementGoals = {
    ...retirementGoals,
    desiredMonthlyIncome: deltas.targetMonthlyIncomeOverride ?? retirementGoals.desiredMonthlyIncome,
  }

  const scaledAccounts: Account[] = accounts.map((account) => {
    const scaledReturn = Math.max(0, account.expectedReturn + deltas.returnDeltaPts)

    if (account.monthlyContribution <= 0) {
      return { ...account, expectedReturn: scaledReturn }
    }

    const scaledContribution = Math.max(
      0,
      account.monthlyContribution * (1 + deltas.contributionScalePct / 100)
    )

    return {
      ...account,
      expectedReturn: scaledReturn,
      monthlyContribution: scaledContribution,
    }
  })

  return {
    accounts: scaledAccounts,
    personalInfo: scaledPersonalInfo,
    retirementGoals: scaledRetirementGoals,
  }
}
