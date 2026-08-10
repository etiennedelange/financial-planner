export type PlanVerdictTone = "neutral" | "success" | "good" | "warning" | "danger"

export interface PlanVerdict {
  tone: PlanVerdictTone
  headline: string
}

interface PlanVerdictInput {
  successRate: number | null
  depletionAge: number | null
}

const LIFE_EXPECTANCY = 90

/**
 * Build the one-line page-level verdict for the charts gallery: does the plan
 * hold? The Monte Carlo success rate sets the base tone, and an income
 * depletion that happens before life expectancy overrides the verdict —
 * running out of money is always the headline even when the median succeeds.
 */
export function buildPlanVerdict({
  successRate,
  depletionAge,
}: PlanVerdictInput): PlanVerdict {
  if (depletionAge !== null && depletionAge < LIFE_EXPECTANCY) {
    return {
      tone: "danger",
      headline: `Income runs out at age ${depletionAge}`,
    }
  }

  if (successRate === null) {
    return { tone: "neutral", headline: "Run the simulation to see whether your plan holds" }
  }

  if (successRate >= 90) {
    return { tone: "success", headline: "Your plan holds" }
  }
  if (successRate >= 75) {
    return { tone: "good", headline: "Your plan is likely to hold" }
  }
  if (successRate >= 60) {
    return { tone: "warning", headline: "Your plan is at risk" }
  }
  if (successRate >= 40) {
    return { tone: "warning", headline: "Your plan is under pressure" }
  }
  return { tone: "danger", headline: "Your plan is unlikely to hold" }
}
