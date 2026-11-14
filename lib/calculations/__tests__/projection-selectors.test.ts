/**
 * Summary-metric selector tests (Phase 10 Step 4).
 *
 * These metrics were previously computed inline at the end of `calculateProjection` and
 * could only be reached through a full projection. As named selectors they can be driven
 * directly with the exact row shapes that matter, including the boundaries a full
 * projection rarely produces.
 */
import { describe, expect, it } from "vite-plus/test"
import {
  selectAverageEffectiveTaxRate,
  selectIncomeGoalShortfallAge,
  selectMonthlyGrossIncomeAtRetirement,
  selectMonthlyNetIncomeAtRetirement,
  selectRawIncomeGap,
  incomeGoalForDrawdownYear,
  selectShortfallAmount,
  selectSurplusAmount,
} from "../projection-engine"
import type { YearlyProjection } from "@/types"

const row = (over: Partial<YearlyProjection> = {}): YearlyProjection => ({
  year: 1,
  age: 65,
  startingBalance: 0,
  contributions: 0,
  growth: 0,
  fees: 0,
  withdrawals: 0,
  incomeTax: 0,
  lumpSumTax: 0,
  medicalAidContribution: 0,
  netIncome: 0,
  endingBalance: 0,
  inflationAdjustedWithdrawal: 0,
  ...over,
})

describe("selectAverageEffectiveTaxRate", () => {
  it("expresses lifetime tax as a percentage of gross withdrawals", () => {
    expect(selectAverageEffectiveTaxRate(250_000, 1_000_000)).toBe(25)
  })

  it("returns 0 rather than dividing by zero when nothing was withdrawn", () => {
    expect(selectAverageEffectiveTaxRate(0, 0)).toBe(0)
    expect(selectAverageEffectiveTaxRate(5_000, 0)).toBe(0)
  })
})

describe("selectMonthlyNetIncomeAtRetirement", () => {
  it("divides the first drawdown year net income by 12", () => {
    const rows = [row({ age: 64 }), row({ age: 65, netIncome: 1_200_000 })]
    expect(selectMonthlyNetIncomeAtRetirement(rows, 1)).toBe(100_000)
  })

  it("returns 0 when there is no drawdown row at that index", () => {
    // A projection that ends at the retirement date has no first drawdown year.
    expect(selectMonthlyNetIncomeAtRetirement([row()], 5)).toBe(0)
    expect(selectMonthlyNetIncomeAtRetirement([], 0)).toBe(0)
  })
})

describe("selectRawIncomeGap", () => {
  const INFLATION = 0.055

  it("is zero when every year meets the desired income exactly", () => {
    // R10 000/month today, retiring immediately => R120 000 in year 0, escalating.
    const rows = [
      row({ withdrawals: 120_000 }),
      row({ withdrawals: 120_000 * 1.055 }),
      row({ withdrawals: 120_000 * Math.pow(1.055, 2) }),
    ]
    expect(selectRawIncomeGap(rows, 0, 10_000, INFLATION)).toBeCloseTo(0, 6)
  })

  it("sums the per-year shortfall when withdrawals fall short", () => {
    // Two years, each R20 000 short of a flat R120 000 target (zero inflation).
    const rows = [row({ withdrawals: 100_000 }), row({ withdrawals: 100_000 })]
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(40_000, 6)
  })

  it("never counts an over-withdrawal as a negative gap", () => {
    // Drawing more than desired must not offset a shortfall in another year.
    const rows = [row({ withdrawals: 500_000 }), row({ withdrawals: 0 })]
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(120_000, 6)
  })

  it("ignores accumulation-phase rows", () => {
    const rows = [
      row({ age: 64, withdrawals: 0 }), // accumulation — must not count as a gap
      row({ age: 65, withdrawals: 120_000 }),
    ]
    expect(selectRawIncomeGap(rows, 1, 10_000, 0)).toBeCloseTo(0, 6)
  })

  it("escalates the target each drawdown year", () => {
    // Flat withdrawals against an escalating target produce a growing gap.
    const rows = [row({ withdrawals: 120_000 }), row({ withdrawals: 120_000 })]
    const gap = selectRawIncomeGap(rows, 0, 10_000, INFLATION)
    expect(gap).toBeCloseTo(120_000 * 1.055 - 120_000, 6)
  })
})

describe("selectRawIncomeGap spending phases", () => {
  it("measures each year against the same goal as the shortfall age, slow-go reduction included", () => {
    // Zero inflation, R10 000/month. Drawdown year 16 is a slow-go year (goal x0.8 = R96 000).
    const rows = Array.from({ length: 17 }, (_, i) =>
      row({ withdrawals: i === 16 ? 96_000 : 120_000 }),
    )
    // Withdrawing exactly the (reduced) goal in the slow-go year is NOT a shortfall.
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(0, 6)
  })

  it("counts only the shortfall below the reduced goal in a slow-go year", () => {
    const rows = Array.from({ length: 17 }, (_, i) =>
      row({ withdrawals: i === 16 ? 90_000 : 120_000 }),
    )
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(6_000, 6)
  })

  it("agrees with incomeGoalForDrawdownYear for every drawdown year, with inflation", () => {
    const yearsToRetirement = 3
    const rows = Array.from({ length: 3 + 30 }, () => row({ withdrawals: 0 }))
    const expected = rows
      .slice(yearsToRetirement)
      .reduce(
        (sum, _r, y) => sum + incomeGoalForDrawdownYear(10_000, yearsToRetirement, y, 0.055),
        0,
      )
    expect(selectRawIncomeGap(rows, yearsToRetirement, 10_000, 0.055)).toBeCloseTo(expected, 4)
  })
})

describe("selectSurplusAmount", () => {
  it("reports a surviving balance", () => {
    expect(selectSurplusAmount(1_500_000)).toBe(1_500_000)
  })

  it("floors a depleted portfolio at zero", () => {
    expect(selectSurplusAmount(0)).toBe(0)
    expect(selectSurplusAmount(-1)).toBe(0)
  })
})

describe("selectShortfallAmount", () => {
  /**
   * SETTLED SEMANTICS — shortfall means "the money ran out before I died", not
   * "cumulative income gap". A plan that funded its income to life expectancy therefore
   * reports no shortfall even when the strategy delivered less income than was asked for.
   * These tests pin that decision so a future change to it has to be deliberate.
   */
  it("reports the full gap when the portfolio depleted", () => {
    expect(selectShortfallAmount(9_000_000, 78)).toBe(9_000_000)
  })

  it("reports zero when the plan never ran short, however large the income gap", () => {
    expect(selectShortfallAmount(91_000_000, null)).toBe(0)
  })

  it("reports the gap even when a residual balance survives", () => {
    // A living annuity at its 17.5% ceiling cannot fund the income, yet keeps a balance.
    // The old surplus-based rule reported R0 shortfall for that plan.
    expect(selectShortfallAmount(2_500_000, 84)).toBe(2_500_000)
  })
})

describe("selectMonthlyGrossIncomeAtRetirement", () => {
  it("reads the gross income actually paid in the first drawdown year", () => {
    const rows = [row({ age: 64 }), row({ age: 65, withdrawals: 175_000 })]
    expect(selectMonthlyGrossIncomeAtRetirement(rows, 1)).toBeCloseTo(175_000 / 12, 9)
  })

  it("is 0 when there is no drawdown year", () => {
    expect(selectMonthlyGrossIncomeAtRetirement([row()], 1)).toBe(0)
  })
})

describe("selectIncomeGoalShortfallAge", () => {
  // Retiring now (no years to escalate); R10,000/month goal = R120,000 a year at 0% inflation
  const flat = (withdrawals: number[]) =>
    withdrawals.map((w, i) => row({ age: 65 + i, withdrawals: w }))

  it("is null when every year pays the goal", () => {
    expect(selectIncomeGoalShortfallAge(flat([120_000, 120_000, 130_000]), 0, 10_000, 0)).toBeNull()
  })

  it("returns the first age paying less than the goal, even if money remains", () => {
    expect(selectIncomeGoalShortfallAge(flat([120_000, 119_000, 120_000]), 0, 10_000, 0)).toBe(66)
  })

  it("escalates the goal with inflation from today to each drawdown year", () => {
    // 2 years to retirement at 10%: goal R145,200 in the first drawdown year
    const rows = [row({ age: 63 }), row({ age: 64 }), row({ age: 65, withdrawals: 145_000 })]
    expect(selectIncomeGoalShortfallAge(rows, 2, 10_000, 0.1)).toBe(65)
    rows[2].withdrawals = 145_200
    expect(selectIncomeGoalShortfallAge(rows, 2, 10_000, 0.1)).toBeNull()
  })

  it("applies the spending-phase multiplier: 80% of the goal is enough from year 16", () => {
    const withdrawals = Array.from({ length: 20 }, (_, y) => (y <= 15 ? 120_000 : 96_000))
    expect(selectIncomeGoalShortfallAge(flat(withdrawals), 0, 10_000, 0)).toBeNull()
  })

  it("no goal (R0 or negative) means no shortfall", () => {
    expect(selectIncomeGoalShortfallAge(flat([0, 0]), 0, 0, 0.05)).toBeNull()
    expect(selectIncomeGoalShortfallAge(flat([0, 0]), 0, -5, 0.05)).toBeNull()
  })
})
