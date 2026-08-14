/**
 * NaN/Infinity guard tests (Phase 9.1).
 *
 * The engines can be called directly (tests, debug tools, saved plans, imports),
 * so a non-finite input must not be able to poison every downstream division
 * into NaN/Infinity. The guards return a degenerate-but-finite result rather
 * than throwing, matching the negative-years guard's behaviour.
 */
import { describe, expect, it } from 'vitest'
import { calculateProjection, runAccumulationPhase, runDrawdownPhase } from '../projection-engine'
import { runMonteCarloSimulation } from '@/lib/monte-carlo/simulation-engine'
import { calculateOptimalContribution } from '../optimal-contribution'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'

const account: Account = {
  id: '1', name: 'RA', provider: 'P', type: 'retirement_annuity',
  currentBalance: 100000, monthlyContribution: 2000,
  expectedReturn: 12, annualFees: 1, contributionEscalation: 5,
}
const personalInfo: PersonalInfo = {
  currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000,
}
const goals: RetirementGoals = {
  desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0,
}
const config: DrawdownConfig = {
  strategy: 'fixed_percentage', initialWithdrawalRate: 4,
  minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0,
}

const finite = (v: number) => Number.isFinite(v)

describe('calculateProjection — non-finite inputs', () => {
  it('returns a finite result when an account balance is NaN', () => {
    const r = calculateProjection([{ ...account, currentBalance: NaN }], personalInfo, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
    expect(finite(r.shortfallAmount)).toBe(true)
    expect(finite(r.surplusAmount)).toBe(true)
    expect(r.yearlyProjections.every((y) => finite(y.endingBalance))).toBe(true)
  })

  it('returns a finite result when an account balance is Infinity', () => {
    const r = calculateProjection([{ ...account, currentBalance: Infinity }], personalInfo, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
    expect(finite(r.shortfallAmount)).toBe(true)
  })

  it('returns a finite result when expectedReturn is NaN', () => {
    const r = calculateProjection([{ ...account, expectedReturn: NaN }], personalInfo, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })

  it('returns a finite result when expectedReturn is Infinity', () => {
    const r = calculateProjection([{ ...account, expectedReturn: Infinity }], personalInfo, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })

  it('returns a finite result when annualFees is NaN', () => {
    const r = calculateProjection([{ ...account, annualFees: NaN }], personalInfo, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })

  it('returns the degenerate empty result when currentAge is NaN (NaN slips past < 0 guards)', () => {
    const r = calculateProjection([account], { ...personalInfo, currentAge: NaN }, goals, config)
    expect(r.yearlyProjections).toHaveLength(0)
    expect(r.portfolioAtRetirement).toBe(0)
  })

  it('returns the degenerate empty result when retirementAge is NaN', () => {
    const r = calculateProjection([account], { ...personalInfo, retirementAge: NaN }, goals, config)
    expect(r.yearlyProjections).toHaveLength(0)
    expect(r.portfolioAtRetirement).toBe(0)
  })

  it('returns the degenerate empty result when lifeExpectancy is NaN', () => {
    const r = calculateProjection([account], { ...personalInfo, lifeExpectancy: NaN }, goals, config)
    expect(r.yearlyProjections).toHaveLength(0)
    expect(r.portfolioAtRetirement).toBe(0)
  })

  it('returns a finite result when inflationRate is NaN', () => {
    const r = calculateProjection([account], personalInfo, { ...goals, inflationRate: NaN }, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })

  it('returns a finite result when desiredMonthlyIncome is NaN', () => {
    const r = calculateProjection([account], personalInfo, { ...goals, desiredMonthlyIncome: NaN }, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })

  it('returns a finite result when annualIncome is NaN', () => {
    const r = calculateProjection([account], { ...personalInfo, annualIncome: NaN }, goals, config)
    expect(finite(r.portfolioAtRetirement)).toBe(true)
  })
})

describe('runAccumulationPhase — non-finite inputs', () => {
  it('keeps every row finite when an account balance is NaN', () => {
    const r = runAccumulationPhase([{ ...account, currentBalance: NaN }], personalInfo, 30, 0.055, 'nominal')
    expect(r.rows.every((row) => finite(row.endingBalance) && finite(row.growth))).toBe(true)
  })
})

describe('runDrawdownPhase — non-finite inputs', () => {
  const drawdownAccounts = [
    { id: '1', name: 'RA', type: 'retirement_annuity' as const, balance: 500000, costBasis: 500000, netReturn: 0.1, feeRate: 0.01 },
    { id: '2', name: 'Disc', type: 'discretionary' as const, balance: NaN, costBasis: 100000, netReturn: 0.09, feeRate: 0.01 },
  ]

  it('keeps every row finite when a discretionary balance is NaN (gainFraction division)', () => {
    const r = runDrawdownPhase(
      drawdownAccounts, personalInfo, goals, config, 30, 25, 0.055, 120000, 0
    )
    expect(r.rows.every((row) => finite(row.endingBalance) && finite(row.withdrawals))).toBe(true)
  })

  it('does not return NaN for cgtTaxableAmount when balance is NaN', () => {
    const r = runDrawdownPhase(
      drawdownAccounts, personalInfo, goals, config, 30, 25, 0.055, 120000, 0
    )
    expect(r.rows.every((row) => row.cgtTaxableAmount === undefined || finite(row.cgtTaxableAmount))).toBe(true)
  })
})

describe('runMonteCarloSimulation — non-finite inputs', () => {
  it('returns a finite success rate when an account balance is NaN', () => {
    const r = runMonteCarloSimulation(
      [{ ...account, currentBalance: NaN }],
      personalInfo, goals, config, { numberOfRuns: 10, randomSeed: 1 }
    )
    expect(finite(r.successRate)).toBe(true)
    expect(r.percentiles.p50.every((v) => finite(v))).toBe(true)
  })

  it('returns finite percentile values when expectedReturn is Infinity', () => {
    const r = runMonteCarloSimulation(
      [{ ...account, expectedReturn: Infinity }],
      personalInfo, goals, config, { numberOfRuns: 10, randomSeed: 1 }
    )
    for (const key of ['p10', 'p25', 'p50', 'p75', 'p90'] as const) {
      expect(r.percentiles[key].every((v) => finite(v))).toBe(true)
    }
    expect(finite(r.averageFinalBalance)).toBe(true)
  })

  it('returns the empty result when currentAge is NaN', () => {
    const r = runMonteCarloSimulation(
      [account],
      { ...personalInfo, currentAge: NaN }, goals, config, { numberOfRuns: 10, randomSeed: 1 }
    )
    expect(r.runs).toHaveLength(0)
    expect(r.successRate).toBe(0)
  })
})

describe('calculateOptimalContribution — non-finite inputs', () => {
  it('does not return an infinite targetNestEgg when the withdrawal rate is 0%', () => {
    const r = calculateOptimalContribution({
      currentSavings: 100000,
      personalInfo, retirementGoals: goals,
      drawdownConfig: { ...config, initialWithdrawalRate: 0 },
      expectedReturn: 0.12, fees: 0.01, contributionEscalation: 0.06,
      compoundingMethod: 'nominal',
    })
    expect(finite(r.targetNestEgg)).toBe(true)
    expect(finite(r.projectedNestEgg)).toBe(true)
    expect(finite(r.optimalMonthlyContribution)).toBe(true)
  })

  it('returns a finite result when expectedReturn is NaN', () => {
    const r = calculateOptimalContribution({
      currentSavings: 100000,
      personalInfo, retirementGoals: goals, drawdownConfig: config,
      expectedReturn: NaN, fees: 0.01, contributionEscalation: 0.06,
      compoundingMethod: 'nominal',
    })
    expect(finite(r.targetNestEgg)).toBe(true)
    expect(finite(r.projectedNestEgg)).toBe(true)
  })

  it('returns a finite result when desiredMonthlyIncome is NaN', () => {
    const r = calculateOptimalContribution({
      currentSavings: 100000,
      personalInfo, retirementGoals: { ...goals, desiredMonthlyIncome: NaN }, drawdownConfig: config,
      expectedReturn: 0.12, fees: 0.01, contributionEscalation: 0.06,
      compoundingMethod: 'nominal',
    })
    expect(finite(r.targetNestEgg)).toBe(true)
    expect(finite(r.optimalMonthlyContribution)).toBe(true)
  })
})
