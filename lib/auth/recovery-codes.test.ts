import { describe, it, expect } from 'vitest'
import { generateRecoveryCodes, RECOVERY_CODE_COUNT } from './recovery-codes'

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
