/**
 * Summary-metric selector tests (Phase 10 Step 4).
 *
 * These metrics were previously computed inline at the end of `calculateProjection` and
 * could only be reached through a full projection. As named selectors they can be driven
 * directly with the exact row shapes that matter, including the boundaries a full
 * projection rarely produces.
 */
import { describe, expect, it } from 'vitest'
import {
  selectAverageEffectiveTaxRate,
  selectMonthlyNetIncomeAtRetirement,
  selectRawIncomeGap,
  selectShortfallAmount,
  selectSurplusAmount,
} from '../projection-engine'
import type { YearlyProjection } from '@/types'

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

describe('selectAverageEffectiveTaxRate', () => {
  it('expresses lifetime tax as a percentage of gross withdrawals', () => {
    expect(selectAverageEffectiveTaxRate(250_000, 1_000_000)).toBe(25)
  })

  it('returns 0 rather than dividing by zero when nothing was withdrawn', () => {
    expect(selectAverageEffectiveTaxRate(0, 0)).toBe(0)
    expect(selectAverageEffectiveTaxRate(5_000, 0)).toBe(0)
  })
})

describe('selectMonthlyNetIncomeAtRetirement', () => {
  it('divides the first drawdown year net income by 12', () => {
    const rows = [row({ age: 64 }), row({ age: 65, netIncome: 1_200_000 })]
    expect(selectMonthlyNetIncomeAtRetirement(rows, 1)).toBe(100_000)
  })

  it('returns 0 when there is no drawdown row at that index', () => {
    // A projection that ends at the retirement date has no first drawdown year.
    expect(selectMonthlyNetIncomeAtRetirement([row()], 5)).toBe(0)
    expect(selectMonthlyNetIncomeAtRetirement([], 0)).toBe(0)
  })
})

describe('selectRawIncomeGap', () => {
  const INFLATION = 0.055

  it('is zero when every year meets the desired income exactly', () => {
    // R10 000/month today, retiring immediately => R120 000 in year 0, escalating.
    const rows = [
      row({ withdrawals: 120_000 }),
      row({ withdrawals: 120_000 * 1.055 }),
      row({ withdrawals: 120_000 * Math.pow(1.055, 2) }),
    ]
    expect(selectRawIncomeGap(rows, 0, 10_000, INFLATION)).toBeCloseTo(0, 6)
  })

  it('sums the per-year shortfall when withdrawals fall short', () => {
    // Two years, each R20 000 short of a flat R120 000 target (zero inflation).
    const rows = [row({ withdrawals: 100_000 }), row({ withdrawals: 100_000 })]
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(40_000, 6)
  })

  it('never counts an over-withdrawal as a negative gap', () => {
    // Drawing more than desired must not offset a shortfall in another year.
    const rows = [row({ withdrawals: 500_000 }), row({ withdrawals: 0 })]
    expect(selectRawIncomeGap(rows, 0, 10_000, 0)).toBeCloseTo(120_000, 6)
  })

  it('ignores accumulation-phase rows', () => {
    const rows = [
      row({ age: 64, withdrawals: 0 }), // accumulation — must not count as a gap
      row({ age: 65, withdrawals: 120_000 }),
    ]
    expect(selectRawIncomeGap(rows, 1, 10_000, 0)).toBeCloseTo(0, 6)
  })

  it('escalates the target each drawdown year', () => {
    // Flat withdrawals against an escalating target produce a growing gap.
    const rows = [row({ withdrawals: 120_000 }), row({ withdrawals: 120_000 })]
    const gap = selectRawIncomeGap(rows, 0, 10_000, INFLATION)
    expect(gap).toBeCloseTo(120_000 * 1.055 - 120_000, 6)
  })
})

describe('selectSurplusAmount', () => {
  it('reports a surviving balance', () => {
    expect(selectSurplusAmount(1_500_000)).toBe(1_500_000)
  })

  it('floors a depleted portfolio at zero', () => {
    expect(selectSurplusAmount(0)).toBe(0)
    expect(selectSurplusAmount(-1)).toBe(0)
  })
})

describe('selectShortfallAmount', () => {
  /**
   * SETTLED SEMANTICS — shortfall means "the money ran out before I died", not
   * "cumulative income gap". A surviving portfolio therefore reports no shortfall even
   * when the plan delivered less income than was asked for. These tests pin that decision
   * so a future change to it has to be deliberate.
   */
  it('reports the full gap when the portfolio depleted', () => {
    expect(selectShortfallAmount(9_000_000, 0)).toBe(9_000_000)
  })

  it('reports zero when the portfolio survived, however large the income gap', () => {
    expect(selectShortfallAmount(91_000_000, 1)).toBe(0)
  })

  it('treats a surplus of exactly zero as depleted', () => {
    // The boundary: R0 left means the money ran out.
    expect(selectShortfallAmount(500_000, 0)).toBe(500_000)
  })
})
