/**
 * Phase-boundary contract tests (Phase 10 Step 3).
 *
 * `calculateProjection` was a single 630-line function whose accumulation and drawdown
 * loops shared mutable locals, so accumulation-phase state could leak into drawdown. The
 * two phases are now separate functions with an explicit value passed between them; these
 * tests pin that boundary directly, which was not possible before.
 */
import { describe, expect, it } from 'vitest'
import {
  runAccumulationPhase,
  runDrawdownPhase,
  type DrawdownAccount,
} from '../projection-engine'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'

const accounts: Account[] = [
  {
    id: '1', name: 'RA', type: 'retirement_annuity', provider: 'P',
    currentBalance: 500000, monthlyContribution: 5000,
    expectedReturn: 10, annualFees: 1, contributionEscalation: 5,
  },
  {
    id: '2', name: 'TFSA', type: 'tfsa', provider: 'P',
    currentBalance: 100000, monthlyContribution: 3000,
    expectedReturn: 9, annualFees: 0.8, contributionEscalation: 5,
  },
]

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

const YEARS_TO_RETIREMENT = 30
const INFLATION = 0.055

const accumulate = () =>
  runAccumulationPhase(accounts, personalInfo, YEARS_TO_RETIREMENT, INFLATION, 'nominal')

describe('runAccumulationPhase', () => {
  it('produces exactly one row per accumulation year', () => {
    const r = accumulate()
    expect(r.rows).toHaveLength(YEARS_TO_RETIREMENT)
    expect(r.rows[0].age).toBe(personalInfo.currentAge)
    expect(r.rows[r.rows.length - 1].age).toBe(personalInfo.retirementAge - 1)
  })

  it('never records a withdrawal — that is the drawdown phase’s job', () => {
    // The single strongest guard against the two phases bleeding into each other.
    accumulate().rows.forEach((row) => {
      expect(row.withdrawals, `age ${row.age}`).toBe(0)
      expect(row.incomeTax, `age ${row.age}`).toBe(0)
      expect(row.netIncome, `age ${row.age}`).toBe(0)
    })
  })

  it('returns per-account balances aligned with the input accounts', () => {
    const r = accumulate()
    expect(r.accountBalances).toHaveLength(accounts.length)
    expect(r.accountCostBases).toHaveLength(accounts.length)
    r.accountBalances.forEach((b) => expect(b).toBeGreaterThan(0))
  })

  it('portfolioAtRetirement equals the sum of the per-account balances', () => {
    const r = accumulate()
    const summed = r.accountBalances.reduce((s, b) => s + b, 0)
    expect(r.portfolioAtRetirement).toBeCloseTo(summed, 2)
  })

  it('cost basis never exceeds balance for a growing portfolio', () => {
    // Cost basis is contributions + opening balance; with positive growth the balance
    // must exceed it, otherwise CGT on discretionary accounts would be computed wrong.
    const r = accumulate()
    r.accountBalances.forEach((balance, i) => {
      expect(r.accountCostBases[i]).toBeLessThan(balance)
    })
  })

  it('is pure: calling it twice yields identical results', () => {
    expect(accumulate()).toEqual(accumulate())
  })

  it('does not mutate the accounts it is given', () => {
    const snapshot = JSON.parse(JSON.stringify(accounts))
    accumulate()
    expect(accounts).toEqual(snapshot)
  })
})

describe('runDrawdownPhase', () => {
  const buildDrawdownAccounts = (): DrawdownAccount[] => {
    const acc = accumulate()
    return accounts.map((a, i) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      balance: acc.accountBalances[i],
      costBasis: acc.accountCostBases[i],
      netReturn: (a.expectedReturn - a.annualFees) / 100,
      feeRate: a.annualFees / 100,
    }))
  }

  const drawdown = (initialWithdrawal: number) =>
    runDrawdownPhase(
      buildDrawdownAccounts(), personalInfo, goals, config,
      YEARS_TO_RETIREMENT, 25, INFLATION, initialWithdrawal, 0
    )

  it('produces exactly one row per drawdown year', () => {
    const r = drawdown(900000)
    expect(r.rows).toHaveLength(25)
    expect(r.rows[0].age).toBe(personalInfo.retirementAge)
    expect(r.rows[r.rows.length - 1].age).toBe(personalInfo.lifeExpectancy - 1)
  })

  it('never records a contribution — accumulation is over', () => {
    drawdown(900000).rows.forEach((row) => {
      expect(row.contributions, `age ${row.age}`).toBe(0)
    })
  })

  it('reports totals consistent with its own rows', () => {
    const r = drawdown(900000)
    const rowTax = r.rows.reduce((s, y) => s + y.incomeTax, 0)
    const rowWithdrawals = r.rows.reduce((s, y) => s + y.withdrawals, 0)
    expect(r.totalLifetimeIncomeTax).toBeCloseTo(rowTax, 2)
    expect(r.totalGrossWithdrawals).toBeCloseTo(rowWithdrawals, 2)
  })

  it('survives with a positive final balance on a well-funded portfolio', () => {
    const r = drawdown(900000)
    expect(r.portfolioDepletionAge).toBeNull()
    expect(r.finalBalance).toBeGreaterThan(0)
  })

  it('records a depletion age when the portfolio arrives at retirement already empty', () => {
    // Covers the START-OF-YEAR depletion check, which is a distinct code path from the
    // post-withdrawal one: when a drawdown year opens at zero the loop emits a zeroed row
    // and `continue`s, so the post-withdrawal check never runs. Mutation testing found
    // this path was uncovered by all 673 tests — the start-of-year assignment could be
    // deleted entirely and the suite stayed green.
    const emptyAccounts: DrawdownAccount[] = [
      {
        id: '1', name: 'Empty', type: 'retirement_annuity',
        balance: 0, costBasis: 0, netReturn: 0.09, feeRate: 0.01,
      },
    ]
    const r = runDrawdownPhase(
      emptyAccounts, personalInfo, goals, config,
      YEARS_TO_RETIREMENT, 25, INFLATION, 300000, 0
    )

    expect(r.portfolioDepletionAge).toBe(personalInfo.retirementAge)
    expect(r.finalBalance).toBe(0)
    expect(r.totalGrossWithdrawals).toBe(0)
    expect(r.rows).toHaveLength(25)
    r.rows.forEach((row) => expect(row.endingBalance, `age ${row.age}`).toBe(0))
  })

  it('depletes and records an age when the withdrawal is ruinous', () => {
    // A withdrawal far beyond what the portfolio can sustain must exhaust it.
    const r = drawdown(50_000_000)
    expect(typeof r.portfolioDepletionAge).toBe('number')
    expect(r.finalBalance).toBe(0)
    expect(r.portfolioDepletionAge).toBeGreaterThanOrEqual(personalInfo.retirementAge)
    expect(r.portfolioDepletionAge).toBeLessThanOrEqual(personalInfo.lifeExpectancy)
  })
})
