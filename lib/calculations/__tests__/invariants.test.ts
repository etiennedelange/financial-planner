/**
 * Invariant tests — logical constraints that must ALWAYS hold.
 *
 * REWRITTEN 2026-07-26 (Phase 1.5 P0). The previous version had 19 invariants that
 * amounted to roughly 4 real checks. A calculation regression shipped in 75f68f7 with
 * 100% line coverage and every test green, because the commit that introduced it also
 * rewrote the assertion that guarded it. Coverage measures reach, not falsifiability.
 *
 * RULES FOR THIS FILE — an assertion that cannot fail is worse than no assertion,
 * because it reads as protection:
 *
 *   1. NEVER write `if (condition) expect(...)`. If the condition is false the test
 *      silently asserts nothing. Assert the condition instead — as a precondition.
 *   2. Every fixture states its preconditions up front, so a fixture that drifts and
 *      stops exercising the scenario fails loudly rather than passing vacuously.
 *   3. Prefer ABSOLUTE MAGNITUDES over relationships between two outputs of the same
 *      function. `expect(a).toBe(0)` when the code says `a = 0` proves nothing.
 *   4. Never recompute the implementation formula in the test body to compare against
 *      itself. Use an independently-derived expected value.
 *   5. Beware clamps. `Math.max(0, x) >= 0` is guaranteed by the clamp, not the logic.
 */

import { describe, it, expect } from 'vitest'
import { calculateProjection } from '../projection-engine'
import { calculateReplacementRatio } from '../retirement-tax'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { todayRands } from '../utils/money-time'

const basePersonalInfo: PersonalInfo = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 600000,
}

const baseRetirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const baseDrawdownConfig: DrawdownConfig = {
  strategy: 'fixed_percentage',
  initialWithdrawalRate: 4,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 0,
}

const RETIREMENT_IDX = basePersonalInfo.retirementAge - basePersonalInfo.currentAge

/** Well-funded: survives to life expectancy with a large surplus, never depletes. */
const survivingAccount: Account = {
  id: '1',
  name: 'Test RA',
  type: 'retirement_annuity',
  provider: 'Test Provider',
  currentBalance: 500000,
  monthlyContribution: 5000,
  expectedReturn: 10,
  annualFees: 1,
  contributionEscalation: 5,
}

/**
 * Genuinely depletes. Uses `fixed_amount_inflation_adjusted` deliberately: the
 * percentage-of-balance strategies decay geometrically and never reach zero, so they
 * cannot produce a depletion at all. A fixture that fails to deplete would make every
 * depletion test below vacuous — which is exactly what happened in the old file.
 */
const depletingAccount: Account = {
  ...survivingAccount,
  currentBalance: 200000,
  monthlyContribution: 500,
}
const depletingConfig: DrawdownConfig = {
  ...baseDrawdownConfig,
  strategy: 'fixed_amount_inflation_adjusted',
}

const surviving = () =>
  calculateProjection([survivingAccount], basePersonalInfo, baseRetirementGoals, baseDrawdownConfig)

const depleting = () =>
  calculateProjection([depletingAccount], basePersonalInfo, baseRetirementGoals, depletingConfig)

describe('Projection Invariants', () => {
  describe('Fixture preconditions', () => {
    // If these fail, every test below is testing something other than what it claims.
    it('the surviving fixture really does survive with a surplus', () => {
      const r = surviving()
      expect(r.portfolioDepletionAge).toBeNull()
      expect(r.surplusAmount).toBeGreaterThan(50_000_000)
    })

    it('the depleting fixture really does run out of money', () => {
      const r = depleting()
      expect(typeof r.portfolioDepletionAge).toBe('number')
      expect(r.portfolioDepletionAge).toBe(67)
      expect(r.surplusAmount).toBe(0)
    })
  })

  describe('Conservation of money', () => {
    /**
     * The strongest invariant available: money cannot appear or vanish.
     *
     *   startingBalance + contributions + growth - withdrawals === endingBalance
     *
     * Verified against the engine before being asserted. NOTE that `fees` is NOT a term:
     * `growth` is already net of fees because netReturn = (expectedReturn - annualFees)/100.
     * The `fees` field is reporting-only. A future refactor that starts subtracting fees
     * twice — an easy and expensive mistake — fails here.
     */
    it('INV-001: every year balances exactly (accumulation and drawdown)', () => {
      const rows = surviving().yearlyProjections
      expect(rows.length).toBeGreaterThan(50)

      rows.forEach((y) => {
        const expected = y.startingBalance + y.contributions + y.growth - y.withdrawals
        expect(
          Math.abs(y.endingBalance - expected),
          `year at age ${y.age} does not balance: ` +
            `start ${y.startingBalance} + contrib ${y.contributions} + growth ${y.growth} ` +
            `- withdrawals ${y.withdrawals} != end ${y.endingBalance}`
        ).toBeLessThan(0.01)
      })
    })

    it('INV-002: the same identity holds for a portfolio that depletes', () => {
      const rows = depleting().yearlyProjections
      rows.forEach((y) => {
        const expected = y.startingBalance + y.contributions + y.growth - y.withdrawals
        expect(Math.abs(y.endingBalance - expected), `age ${y.age}`).toBeLessThan(0.01)
      })
    })

    it('INV-003: year N starting balance equals year N-1 ending balance', () => {
      const rows = surviving().yearlyProjections
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].startingBalance).toBeCloseTo(rows[i - 1].endingBalance, 2)
      }
    })
  })

  describe('Depletion semantics', () => {
    it('INV-004: a depleted portfolio reports zero surplus and a real depletion age', () => {
      const r = depleting()
      // Asserted unconditionally — the preconditions above guarantee this fixture depletes.
      expect(r.surplusAmount).toBe(0)
      expect(r.portfolioDepletionAge).toBeGreaterThanOrEqual(basePersonalInfo.retirementAge)
      expect(r.portfolioDepletionAge).toBeLessThanOrEqual(basePersonalInfo.lifeExpectancy)
    })

    it('INV-005: a surviving portfolio reports no depletion age and positive surplus', () => {
      const r = surviving()
      expect(r.portfolioDepletionAge).toBeNull()
      expect(r.surplusAmount).toBeGreaterThan(0)
    })

    it('INV-006: balances stay at zero for every year after depletion', () => {
      const r = depleting()
      const depletionAge = r.portfolioDepletionAge as number
      const after = r.yearlyProjections.filter((y) => y.age > depletionAge)

      // The fixture depletes at 67 with life expectancy 90, so there must be a
      // substantial tail to check. Without this the forEach below could pass on [].
      expect(after.length).toBeGreaterThan(20)
      after.forEach((y) => {
        expect(y.endingBalance, `age ${y.age}`).toBe(0)
        expect(y.withdrawals, `age ${y.age}`).toBe(0)
      })
    })

    it('INV-007: a depleted plan reports a materially large shortfall', () => {
      // Absolute magnitude, not a relationship. If the shortfall metric silently
      // collapses to 0 again — the 75f68f7 regression — this fails.
      const r = depleting()
      expect(r.shortfallAmount).toBeGreaterThan(50_000_000)
    })
  })

  describe('Withdrawals', () => {
    it('INV-008: drawdown withdrawals are substantial and never negative', () => {
      const rows = surviving().yearlyProjections.slice(RETIREMENT_IDX)
      expect(rows.length).toBe(basePersonalInfo.lifeExpectancy - basePersonalInfo.retirementAge)

      const total = rows.reduce((sum, y) => sum + y.withdrawals, 0)
      // Independently anchored: a R22.5m portfolio drawn at 4% over 25 years with
      // growth must deliver tens of millions, not a token amount.
      expect(total).toBeGreaterThan(30_000_000)
      rows.forEach((y) => expect(y.withdrawals).toBeGreaterThanOrEqual(0))
    })

    it('INV-009: no withdrawals occur before retirement', () => {
      const rows = surviving().yearlyProjections.slice(0, RETIREMENT_IDX)
      expect(rows.length).toBe(RETIREMENT_IDX)
      rows.forEach((y) => expect(y.withdrawals, `age ${y.age}`).toBe(0))
    })
  })

  describe('Replacement ratio', () => {
    it('INV-010: ratio is computed against an independently derived value', () => {
      // 1,601,625 / 1,275,000 = 1.2562... -> 125.6%. Derived by hand, NOT by
      // recomputing the implementation formula in the test body.
      const ratio = calculateReplacementRatio(todayRands(1601625), todayRands(1275000))
      expect(ratio).toBeCloseTo(125.6, 1)
    })

    it('INV-011: a 60% ratio is reported as 60', () => {
      expect(calculateReplacementRatio(todayRands(240000), todayRands(400000))).toBeCloseTo(60, 6)
    })

    it('INV-012: a negative retirement income yields a negative ratio, not a clamped 0', () => {
      // The old INV-011 was titled "always non-negative" but only tested one positive
      // pair, so it asserted nothing about the property in its own name. The function
      // does NOT clamp, and this pins that actual behaviour.
      expect(calculateReplacementRatio(todayRands(-100000), todayRands(600000))).toBeCloseTo(
        -16.667,
        3
      )
    })

    it('INV-013: ratio is 0 when EITHER income is 0', () => {
      // The old INV-012 claimed "0 only when pre-retirement income is 0", which is false:
      // a zero retirement income also gives 0.
      expect(calculateReplacementRatio(todayRands(100000), todayRands(0))).toBe(0)
      expect(calculateReplacementRatio(todayRands(0), todayRands(600000))).toBe(0)
    })
  })

  describe('Projection shape', () => {
    it('INV-014: projections cover every year from current age to life expectancy', () => {
      const r = surviving()
      expect(r.yearlyProjections.length).toBe(
        basePersonalInfo.lifeExpectancy - basePersonalInfo.currentAge
      )
      expect(r.yearlyProjections[0].age).toBe(basePersonalInfo.currentAge)
      expect(r.yearlyProjections[r.yearlyProjections.length - 1].age).toBe(
        basePersonalInfo.lifeExpectancy - 1
      )
    })

    it('INV-015: ages increase by exactly one year per row', () => {
      const rows = surviving().yearlyProjections
      for (let i = 1; i < rows.length; i++) {
        expect(rows[i].age).toBe(rows[i - 1].age + 1)
      }
    })
  })

  describe('Tax and fees', () => {
    it('INV-016: net income equals withdrawals minus income tax and medical aid', () => {
      // Asserted only over drawdown years, and only against fields the engine actually
      // populates. `lumpSumTax` is deliberately NOT an operand here — see INV-018.
      const rows = surviving()
        .yearlyProjections.slice(RETIREMENT_IDX)
        .filter((y) => y.withdrawals > 0)
      expect(rows.length).toBeGreaterThan(20)

      rows.forEach((y) => {
        const expected = y.withdrawals - y.incomeTax - y.medicalAidContribution
        expect(Math.abs(y.netIncome - expected), `age ${y.age}`).toBeLessThan(0.01)
      })
    })

    it('INV-017: drawdown years incur real, non-negative income tax', () => {
      const rows = surviving().yearlyProjections.slice(RETIREMENT_IDX)
      rows.forEach((y) => expect(y.incomeTax).toBeGreaterThanOrEqual(0))

      // Magnitude check: a multi-million-rand annual pension withdrawal must attract
      // material tax. A bug that zeroed income tax would pass a >= 0 check alone.
      const totalTax = rows.reduce((sum, y) => sum + y.incomeTax, 0)
      expect(totalTax).toBeGreaterThan(1_000_000)
    })

    it('INV-018: lump-sum tax is reported in the total but NOT attributed per-year', () => {
      // KNOWN MODELLING GAP, pinned deliberately rather than asserted away.
      // `totalLumpSumTax` is populated, but `yearlyProjections[].lumpSumTax` is 0 for
      // EVERY year including the retirement year. The old INV-017 claimed to verify
      // "lump sum tax is only non-zero at retirement year" while both of its branches
      // passed on the constant 0 — it could never have detected this.
      //
      // If per-year attribution is implemented later, this test fails and must be
      // rewritten to assert the retirement year carries the tax. That failure is the
      // point: it marks the gap instead of hiding it.
      const r = calculateProjection(
        [survivingAccount],
        basePersonalInfo,
        baseRetirementGoals,
        { ...baseDrawdownConfig, lumpSumPercentage: 30 }
      )

      expect(r.totalLumpSumTax).toBeGreaterThan(1_000_000)
      const perYearNonZero = r.yearlyProjections.filter((y) => y.lumpSumTax !== 0)
      expect(perYearNonZero.length).toBe(0)
    })

    it('INV-019: accumulation growth is positive and fees are reported non-negative', () => {
      const rows = surviving().yearlyProjections.slice(0, RETIREMENT_IDX)
      expect(rows.length).toBe(RETIREMENT_IDX)

      rows.forEach((y) => {
        expect(y.growth, `age ${y.age}`).toBeGreaterThan(0)
        expect(y.fees, `age ${y.age}`).toBeGreaterThanOrEqual(0)
      })

      // Growth compounds, so the final accumulation year must dwarf the first.
      expect(rows[rows.length - 1].growth).toBeGreaterThan(rows[0].growth * 10)
    })
  })
})
