import { describe, expect, it } from 'vitest'
import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from './defaults'

describe('SA_DEFAULTS_DISPLAY', () => {
  /**
   * `0.035 * 100` is `3.5000000000000004` in IEEE-754. That artefact was not display-only:
   * `calculator-store.ts` seeds `drawdownConfig.initialWithdrawalRate` from
   * `safeWithdrawalRate`, so it reached application state, every serialised plan built
   * from it, and rendered verbatim in the debug window as "3.5000000000000004%".
   */
  it('has no floating-point tail on any value', () => {
    Object.entries(SA_DEFAULTS_DISPLAY).forEach(([key, value]) => {
      expect(
        String(value),
        `${key} has a floating-point tail: ${value}`
      ).not.toMatch(/\.\d{5,}/)
    })
  })

  it('converts safeWithdrawalRate to exactly 3.5', () => {
    // The specific value that regressed.
    expect(SA_DEFAULTS_DISPLAY.safeWithdrawalRate).toBe(3.5)
  })

  it('round-trips back to the source decimals', () => {
    // Guards against the rounding being coarse enough to change a rate.
    const pairs: Array<[keyof typeof SA_DEFAULTS_DISPLAY, keyof typeof SA_DEFAULTS]> = [
      ['inflation', 'inflation'],
      ['medicalInflation', 'medicalInflation'],
      ['equityReturn', 'equityReturn'],
      ['bondReturn', 'bondReturn'],
      ['cashReturn', 'cashReturn'],
      ['equityVolatility', 'equityVolatility'],
      ['bondVolatility', 'bondVolatility'],
      ['safeWithdrawalRate', 'safeWithdrawalRate'],
      ['contributionEscalation', 'contributionEscalation'],
    ]
    pairs.forEach(([displayKey, sourceKey]) => {
      expect(
        SA_DEFAULTS_DISPLAY[displayKey] / 100,
        `${displayKey} does not round-trip`
      ).toBeCloseTo(SA_DEFAULTS[sourceKey], 10)
    })
  })

  it('exposes a display percentage for every rate it claims to cover', () => {
    // A new SA_DEFAULTS rate silently missing from the display map would render as
    // `undefined%` rather than failing.
    Object.values(SA_DEFAULTS_DISPLAY).forEach((v) => {
      expect(Number.isFinite(v)).toBe(true)
      expect(v).toBeGreaterThan(0)
    })
  })
})
