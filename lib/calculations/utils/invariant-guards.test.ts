import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertNonNegativeBalance, finiteOrZero, safePositiveDivide, sanitizeAccounts } from './invariant-guards'

describe('assertNonNegativeBalance', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the value unchanged when non-negative', () => {
    expect(assertNonNegativeBalance(1000, 'ctx')).toBe(1000)
    expect(assertNonNegativeBalance(0, 'ctx')).toBe(0)
  })

  it('throws on a negative balance so the bug cannot be silently clamped away', () => {
    expect(() => assertNonNegativeBalance(-0.01, 'drawdown year age 70')).toThrow(
      /negative balance/i
    )
  })

  it('names the context in the error so the failing year is identifiable', () => {
    expect(() => assertNonNegativeBalance(-5000, 'account acc-1 at age 82')).toThrow(
      /account acc-1 at age 82/
    )
  })

  it('includes the offending value in the error', () => {
    expect(() => assertNonNegativeBalance(-1234.5, 'ctx')).toThrow(/-1234\.5/)
  })

  it('treats -0 as non-negative', () => {
    // -0 arises from ordinary float arithmetic and is not a defect.
    expect(assertNonNegativeBalance(-0, 'ctx')).toBe(-0)
  })

  it('passes NaN through rather than throwing', () => {
    // NaN is a different defect with its own guards; this one must not misreport it
    // as a negative balance, which would send a debugger down the wrong path.
    expect(() => assertNonNegativeBalance(NaN, 'ctx')).not.toThrow()
  })
})

describe('finiteOrZero', () => {
  it('returns finite values unchanged', () => {
    expect(finiteOrZero(0)).toBe(0)
    expect(finiteOrZero(123.45)).toBe(123.45)
    expect(finiteOrZero(-7)).toBe(-7)
  })

  it('coerces NaN to 0', () => {
    expect(finiteOrZero(NaN)).toBe(0)
  })

  it('coerces Infinity and -Infinity to 0', () => {
    expect(finiteOrZero(Infinity)).toBe(0)
    expect(finiteOrZero(-Infinity)).toBe(0)
  })
})

describe('safePositiveDivide', () => {
  it('divides when the denominator is positive and finite', () => {
    expect(safePositiveDivide(10, 4)).toBe(2.5)
    expect(safePositiveDivide(-6, 3)).toBe(-2)
  })

  it('returns the fallback for a zero denominator', () => {
    expect(safePositiveDivide(10, 0)).toBe(0)
    expect(safePositiveDivide(10, 0, -1)).toBe(-1)
  })

  it('returns the fallback for a negative denominator', () => {
    expect(safePositiveDivide(10, -2)).toBe(0)
  })

  it('returns the fallback for NaN/Infinity operands', () => {
    expect(safePositiveDivide(NaN, 4)).toBe(0)
    expect(safePositiveDivide(10, NaN)).toBe(0)
    expect(safePositiveDivide(10, Infinity)).toBe(0)
    expect(safePositiveDivide(Infinity, 4)).toBe(0)
  })
})

describe('sanitizeAccounts', () => {
  const base = {
    id: '1', name: 'RA', provider: 'P', type: 'retirement_annuity' as const,
    currentBalance: 100000, monthlyContribution: 2000,
    expectedReturn: 12, annualFees: 1, contributionEscalation: 5,
  }

  it('leaves fully-finite accounts unchanged', () => {
    const out = sanitizeAccounts([base])
    expect(out[0]).toEqual(base)
  })

  it('coerces non-finite numeric fields to 0', () => {
    const out = sanitizeAccounts([{ ...base, currentBalance: NaN, expectedReturn: Infinity }])
    expect(out[0].currentBalance).toBe(0)
    expect(out[0].expectedReturn).toBe(0)
    expect(out[0].monthlyContribution).toBe(2000)
  })

  it('preserves an undefined tfsaContributionsToDate and coerces a non-finite one', () => {
    const undef = sanitizeAccounts([{ ...base, tfsaContributionsToDate: undefined }])
    expect(undef[0].tfsaContributionsToDate).toBeUndefined()

    const nan = sanitizeAccounts([{ ...base, tfsaContributionsToDate: NaN }])
    expect(nan[0].tfsaContributionsToDate).toBe(0)
  })

  it('does not mutate the input accounts', () => {
    const input = [{ ...base, currentBalance: NaN }]
    sanitizeAccounts(input)
    expect(input[0].currentBalance).toBe(NaN)
  })
})
