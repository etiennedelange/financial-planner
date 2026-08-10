import type { Account, PersonalInfo, RetirementGoals, DrawdownConfig, MarketAssumptions } from "@/types"
import { calculateProjection } from "../projection-engine"
import {
  applySensitivityDeltas,
  DEFAULT_SENSITIVITY_DELTAS,
  type SensitivityDeltas,
} from "./apply-sensitivity-deltas"

export interface TornadoBar {
  key: string
  label: string
  lowLabel: string
  highLabel: string
  lowDelta: number // nest egg change in R for the "low" direction
  highDelta: number // nest egg change in R for the "high" direction
  lowPct: number // percent change for the "low" direction
  highPct: number // percent change for the "high" direction
}

interface BuildTornadoParams {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  assumptions: MarketAssumptions
}

const LEVERS: {
  key: string
  label: string
  lowLabel: string
  highLabel: string
  low: SensitivityDeltas
  high: SensitivityDeltas
}[] = [
  {
    key: "contribution",
    label: "Contributions",
    lowLabel: "-20%",
    highLabel: "+20%",
    low: { ...DEFAULT_SENSITIVITY_DELTAS, contributionScalePct: -20 },
    high: { ...DEFAULT_SENSITIVITY_DELTAS, contributionScalePct: 20 },
  },
  {
    key: "return",
    label: "Expected return",
    lowLabel: "-1 pt",
    highLabel: "+1 pt",
    low: { ...DEFAULT_SENSITIVITY_DELTAS, returnDeltaPts: -1 },
    high: { ...DEFAULT_SENSITIVITY_DELTAS, returnDeltaPts: 1 },
  },
  {
    key: "retirementAge",
    label: "Retirement age",
    lowLabel: "-2 yrs",
    highLabel: "+2 yrs",
    low: { ...DEFAULT_SENSITIVITY_DELTAS, retirementAgeOffset: -2 },
    high: { ...DEFAULT_SENSITIVITY_DELTAS, retirementAgeOffset: 2 },
  },
]

/**
 * Build the data for a tornado chart showing how much the projected nest egg at
 * retirement moves when each lever is pulled in either direction. Reuses the
 * shared sensitivity-delta transform and projection engine, so the chart can
 * never drift out of step with what the plan actually computes.
 */
export function buildSensitivityTornado({
  accounts,
  personalInfo,
  retirementGoals,
  drawdownConfig,
  assumptions,
}: BuildTornadoParams): TornadoBar[] {
  if (accounts.length === 0) return []

  const baseline = calculateProjection(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    assumptions
  ).portfolioAtRetirement

  if (baseline <= 0) return []

  const nestEggFor = (deltas: SensitivityDeltas): number => {
    const scaled = applySensitivityDeltas(accounts, personalInfo, retirementGoals, deltas)
    return calculateProjection(
      scaled.accounts,
      scaled.personalInfo,
      scaled.retirementGoals,
      drawdownConfig,
      assumptions
    ).portfolioAtRetirement
  }

  return LEVERS.map((lever) => {
    const low = nestEggFor(lever.low)
    const high = nestEggFor(lever.high)
    const lowDelta = low - baseline
    const highDelta = high - baseline
    return {
      key: lever.key,
      label: lever.label,
      lowLabel: lever.lowLabel,
      highLabel: lever.highLabel,
      lowDelta,
      highDelta,
      lowPct: (lowDelta / baseline) * 100,
      highPct: (highDelta / baseline) * 100,
    }
  })
}
