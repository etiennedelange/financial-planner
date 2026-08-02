import { describe, expect, it } from 'vitest'
import {
  deflate,
  deflateToToday,
  escalate,
  escalateToRetirement,
  inflationFactor,
  percentToRate,
  retirementRands,
  todayRands,
} from './money-time'

describe('money-time', () => {
  const RATE = 0.055

  describe('inflationFactor', () => {
    it('is 1 at zero years', () => {
      expect(inflationFactor(0, RATE)).toBe(1)
    })

    it('is 1 at zero inflation regardless of horizon', () => {
      expect(inflationFactor(30, 0)).toBe(1)
    })

    it('matches the compound formula', () => {
      expect(inflationFactor(30, RATE)).toBeCloseTo(Math.pow(1.055, 30), 12)
    })

    it('is 4.9840 over 30 years at 5.5% (SA default)', () => {
      expect(inflationFactor(30, RATE)).toBeCloseTo(4.9840, 4)
    })
  })

  describe('escalate / deflate', () => {
    it('escalate grows an amount to a future date', () => {
      expect(escalate(600000, 30, RATE)).toBeCloseTo(600000 * Math.pow(1.055, 30), 6)
    })

    it('deflate is the exact inverse of escalate', () => {
      const original = 902259
      expect(deflate(escalate(original, 30, RATE), 30, RATE)).toBeCloseTo(original, 6)
    })

    it('both are identity at zero years', () => {
      expect(escalate(1234, 0, RATE)).toBe(1234)
      expect(deflate(1234, 0, RATE)).toBe(1234)
    })

    it('both are identity at zero inflation', () => {
      expect(escalate(1234, 25, 0)).toBe(1234)
      expect(deflate(1234, 25, 0)).toBe(1234)
    })

    it('handles negative years by deflating (inverse direction)', () => {
      expect(escalate(1000, -1, RATE)).toBeCloseTo(1000 / 1.055, 9)
    })

    it('returns 0 for a 0 amount', () => {
      expect(escalate(0, 30, RATE)).toBe(0)
      expect(deflate(0, 30, RATE)).toBe(0)
    })
  })

  describe('percentToRate', () => {
    it('converts a percentage to a decimal rate', () => {
      expect(percentToRate(5.5)).toBeCloseTo(0.055, 12)
    })

    it('handles zero', () => {
      expect(percentToRate(0)).toBe(0)
    })

    it('returns 0 for non-finite input rather than propagating NaN', () => {
      expect(percentToRate(NaN)).toBe(0)
      expect(percentToRate(Infinity)).toBe(0)
    })
  })

  describe('basis-tagged helpers', () => {
    it('escalateToRetirement matches the untagged escalate', () => {
      const tagged = escalateToRetirement(todayRands(600000), 30, RATE)
      expect(tagged as number).toBeCloseTo(escalate(600000, 30, RATE), 9)
    })

    it('deflateToToday round-trips a retirement-basis amount', () => {
      const atRetirement = retirementRands(902259)
      const today = deflateToToday(atRetirement, 30, RATE)
      expect(today as number).toBeCloseTo(902259 / Math.pow(1.055, 30), 6)
    })

    it('round-trips today -> retirement -> today', () => {
      const start = todayRands(750000)
      const back = deflateToToday(escalateToRetirement(start, 20, RATE), 20, RATE)
      expect(back as number).toBeCloseTo(750000, 6)
    })
  })

  describe('Non-finite inputs', () => {
    it('escalate returns 0 for a non-finite amount', () => {
      expect(escalate(NaN, 10, RATE)).toBe(0)
      expect(escalate(Infinity, 10, RATE)).toBe(0)
    })

    it('escalate returns the amount unchanged for a non-finite rate', () => {
      // A broken rate must not silently poison a valid amount.
      expect(escalate(1000, 10, NaN)).toBe(1000)
    })

    it('inflationFactor returns 1 for non-finite inputs', () => {
      expect(inflationFactor(NaN, RATE)).toBe(1)
      expect(inflationFactor(10, NaN)).toBe(1)
    })

    it('deflate returns 0 for a non-finite amount', () => {
      expect(deflate(NaN, 10, RATE)).toBe(0)
      expect(deflate(-Infinity, 10, RATE)).toBe(0)
    })

    it('deflate returns the amount unchanged for a non-finite rate', () => {
      expect(deflate(1000, 10, NaN)).toBe(1000)
    })

    it('deflate returns 0 rather than Infinity when the growth factor collapses to 0', () => {
      // rate = -1 makes (1 + rate)^n zero for n > 0; dividing would yield Infinity
      // and poison every downstream figure.
      expect(deflate(1000, 5, -1)).toBe(0)
      expect(Number.isFinite(deflate(1000, 5, -1))).toBe(true)
    })
  })
})
