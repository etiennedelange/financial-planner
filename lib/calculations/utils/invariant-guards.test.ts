import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertNonNegativeBalance } from './invariant-guards'

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
