import { describe, expect, it } from 'vitest'
import { MAX_MONETARY_AMOUNT } from '@/lib/constants/limits'
import { clampMonetaryAmount, isAllowedMonetaryInput, predictInsertedValue } from './monetary'

describe('clampMonetaryAmount', () => {
  it('keeps values within the allowed range untouched', () => {
    expect(clampMonetaryAmount(0)).toBe(0)
    expect(clampMonetaryAmount(1)).toBe(1)
    expect(clampMonetaryAmount(600_000)).toBe(600_000)
    expect(clampMonetaryAmount(MAX_MONETARY_AMOUNT)).toBe(MAX_MONETARY_AMOUNT)
  })

  it('clamps absurdly large values to the cap', () => {
    expect(clampMonetaryAmount(MAX_MONETARY_AMOUNT + 1)).toBe(MAX_MONETARY_AMOUNT)
    expect(clampMonetaryAmount(1e39)).toBe(MAX_MONETARY_AMOUNT)
    expect(clampMonetaryAmount(Number.MAX_SAFE_INTEGER)).toBe(MAX_MONETARY_AMOUNT)
    expect(clampMonetaryAmount(Infinity)).toBe(0)
  })

  it('clamps negatives to zero', () => {
    expect(clampMonetaryAmount(-1)).toBe(0)
    expect(clampMonetaryAmount(-1e30)).toBe(0)
    expect(clampMonetaryAmount(-Infinity)).toBe(0)
  })

  it('collapses non-finite values to zero', () => {
    expect(clampMonetaryAmount(NaN)).toBe(0)
  })

  it('keeps the cap below Number.MAX_SAFE_INTEGER', () => {
    // The whole point of the cap: any accepted value round-trips without
    // IEEE-754 precision loss.
    expect(MAX_MONETARY_AMOUNT).toBeLessThan(Number.MAX_SAFE_INTEGER)
  })
})

describe('isAllowedMonetaryInput', () => {
  it('allows empty strings so a field can be cleared', () => {
    expect(isAllowedMonetaryInput('')).toBe(true)
    expect(isAllowedMonetaryInput('   ')).toBe(true)
  })

  it('allows values within the range', () => {
    expect(isAllowedMonetaryInput('0')).toBe(true)
    expect(isAllowedMonetaryInput('600000')).toBe(true)
    expect(isAllowedMonetaryInput(String(MAX_MONETARY_AMOUNT))).toBe(true)
    expect(isAllowedMonetaryInput('0.5')).toBe(true)
  })

  it('allows formatted input the commit handlers also accept', () => {
    expect(isAllowedMonetaryInput('1 000')).toBe(true)
    expect(isAllowedMonetaryInput('1,000')).toBe(true)
    expect(isAllowedMonetaryInput('1 000 000 000 000')).toBe(true)
  })

  it('rejects values above the cap', () => {
    expect(isAllowedMonetaryInput(String(MAX_MONETARY_AMOUNT + 1))).toBe(false)
    expect(isAllowedMonetaryInput('8798456465498798465498794654547987654987')).toBe(false)
    expect(isAllowedMonetaryInput('1e39')).toBe(false)
    expect(isAllowedMonetaryInput('10000000000000')).toBe(false)
  })

  it('rejects negatives and non-finite values', () => {
    expect(isAllowedMonetaryInput('-1')).toBe(false)
    expect(isAllowedMonetaryInput('Infinity')).toBe(false)
    expect(isAllowedMonetaryInput('abc')).toBe(false)
  })

  it('respects a custom max', () => {
    expect(isAllowedMonetaryInput('600000', 500_000)).toBe(false)
    expect(isAllowedMonetaryInput('400000', 500_000)).toBe(true)
  })
})

describe('predictInsertedValue', () => {
  it('appends at the end when the selection is unavailable (number inputs)', () => {
    expect(predictInsertedValue('600000', '5', null, null)).toBe('6000005')
    expect(predictInsertedValue('', '5', null, null)).toBe('5')
  })

  it('inserts at the caret for text inputs', () => {
    expect(predictInsertedValue('600000', '5', 2, 2)).toBe('6050000')
  })

  it('replaces the selected range', () => {
    expect(predictInsertedValue('600000', '5', 1, 4)).toBe('6500')
  })

  it('rejects when the predicted value would exceed the cap', () => {
    const candidate = predictInsertedValue('555555555555', '5', null, null)
    expect(candidate).toBe('5555555555555')
    expect(isAllowedMonetaryInput(candidate)).toBe(false)
  })
})
