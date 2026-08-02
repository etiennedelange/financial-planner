import { describe, it, expect } from 'vitest'
import { generateRecoveryCodes, normaliseRecoveryCode, RECOVERY_CODE_COUNT } from './recovery-codes'

describe('generateRecoveryCodes', () => {
  it('returns exactly ten codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT)
  })

  it('formats codes as xxxxx-xxxxx in Crockford base32', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/)
    }
  })

  it('excludes ambiguous characters I, L, O and U', () => {
    const joined = generateRecoveryCodes().join('')
    expect(joined).not.toMatch(/[ILOU]/)
  })

  it('returns distinct codes within a batch', () => {
    const codes = generateRecoveryCodes()
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT)
  })

  it('does not repeat across batches', () => {
    const a = new Set(generateRecoveryCodes())
    const b = generateRecoveryCodes()
    expect(b.some((c) => a.has(c))).toBe(false)
  })
})

describe('normaliseRecoveryCode', () => {
  it('uppercases a hyphenated mixed-case code and preserves the hyphen', () => {
    expect(normaliseRecoveryCode('abcde-fghjk')).toBe('ABCDE-FGHJK')
  })

  it('inserts a hyphen at the midpoint when the input has none', () => {
    expect(normaliseRecoveryCode('abcdefghjk')).toBe('ABCDE-FGHJK')
  })

  it('strips surrounding and internal whitespace', () => {
    expect(normaliseRecoveryCode(' abcde fghjk ')).toBe('ABCDE-FGHJK')
  })

  it('returns an invalid-length input uppercased without forcing a hyphen', () => {
    expect(normaliseRecoveryCode('abc')).toBe('ABC')
    expect(normaliseRecoveryCode('abcdefghjklmno')).toBe('ABCDEFGHJKLMNO')
  })
})
