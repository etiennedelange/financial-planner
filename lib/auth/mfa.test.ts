import { describe, it, expect, vi, beforeEach } from 'vitest'

const mfa = {
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
  listFactors: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
}
const rpc = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { mfa }, rpc }),
}))

import {
  enrollTotp,
  verifyEnrollment,
  listFactors,
  unenrollTotp,
  unenrollAbandonedFactors,
  currentAal,
  recoveryCodesRemaining,
  elevateWithTotp,
} from './mfa'

beforeEach(() => vi.clearAllMocks())

describe('enrollTotp', () => {
  it('returns the factor id, QR code and secret', async () => {
    mfa.enroll.mockResolvedValue({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml;…', secret: 'JBSWY3DP' } },
      error: null,
    })

    await expect(enrollTotp()).resolves.toEqual({
      factorId: 'factor-1', qrCode: 'data:image/svg+xml;…', secret: 'JBSWY3DP',
    })
  })

  it('throws when Supabase rejects enrolment', async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: 'MFA not enabled' } })
    await expect(enrollTotp()).rejects.toThrow('MFA not enabled')
  })
})

describe('verifyEnrollment', () => {
  it('stores ten recovery codes and returns them on success', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: {}, error: null })
    rpc.mockResolvedValue({ error: null })

    const codes = await verifyEnrollment('factor-1', '123456')

    expect(codes).toHaveLength(10)
    expect(rpc).toHaveBeenCalledWith('store_recovery_codes', { codes })
  })

  it('throws when the challenge cannot be created', async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: { message: 'too many attempts' } })
    await expect(verifyEnrollment('factor-1', '123456')).rejects.toThrow('too many attempts')
    expect(mfa.verify).not.toHaveBeenCalled()
  })

  it('does not generate recovery codes when the TOTP code is wrong', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } })

    await expect(verifyEnrollment('factor-1', '000000')).rejects.toThrow('Invalid TOTP code')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('unenrolls the factor if storing recovery codes fails', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: {}, error: null })
    rpc.mockResolvedValue({ error: { message: 'db down' } })
    mfa.unenroll.mockResolvedValue({ error: null })

    await expect(verifyEnrollment('factor-1', '123456')).rejects.toThrow('db down')
    // Leaving a verified factor with no recovery codes is a lockout waiting to happen.
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' })
  })
})

describe('listFactors', () => {
  it('returns only verified TOTP factors', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f1', friendly_name: 'Phone', status: 'verified' }] }, error: null,
    })
    await expect(listFactors()).resolves.toEqual([{ id: 'f1', friendlyName: 'Phone' }])
  })

  it('excludes abandoned (unverified) factors from the result', async () => {
    mfa.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: 'f1', friendly_name: 'Phone', status: 'verified' },
          { id: 'f2', friendly_name: null, status: 'unverified' },
        ],
      },
      error: null,
    })
    await expect(listFactors()).resolves.toEqual([{ id: 'f1', friendlyName: 'Phone' }])
  })

  it('returns an empty list when nothing is enrolled', async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    await expect(listFactors()).resolves.toEqual([])
  })
})

describe('unenrollAbandonedFactors', () => {
  it('unenrolls every unverified factor and leaves verified ones alone', async () => {
    mfa.listFactors.mockResolvedValue({
      data: {
        totp: [
          { id: 'f1', friendly_name: 'Phone', status: 'verified' },
          { id: 'f2', friendly_name: null, status: 'unverified' },
          { id: 'f3', friendly_name: null, status: 'unverified' },
        ],
      },
      error: null,
    })
    mfa.unenroll.mockResolvedValue({ error: null })

    await unenrollAbandonedFactors()

    expect(mfa.unenroll).toHaveBeenCalledTimes(2)
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f2' })
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'f3' })
  })

  it('does nothing when there are no abandoned factors', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f1', friendly_name: 'Phone', status: 'verified' }] }, error: null,
    })
    await unenrollAbandonedFactors()
    expect(mfa.unenroll).not.toHaveBeenCalled()
  })

  it('throws when Supabase rejects listing factors', async () => {
    mfa.listFactors.mockResolvedValue({ data: null, error: { message: 'not authenticated' } })
    await expect(unenrollAbandonedFactors()).rejects.toThrow('not authenticated')
  })

  it('throws when an unenrol call fails', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f2', friendly_name: null, status: 'unverified' }] }, error: null,
    })
    mfa.unenroll.mockResolvedValue({ error: { message: 'aal2 required' } })
    await expect(unenrollAbandonedFactors()).rejects.toThrow('aal2 required')
  })
})

describe('unenrollTotp', () => {
  it('throws when unenrolment fails', async () => {
    mfa.unenroll.mockResolvedValue({ error: { message: 'aal2 required' } })
    await expect(unenrollTotp('f1')).rejects.toThrow('aal2 required')
  })
})

describe('currentAal', () => {
  it('returns the current and next assurance levels', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' }, error: null,
    })
    await expect(currentAal()).resolves.toEqual({ current: 'aal1', next: 'aal2' })
  })

  it('throws when Supabase rejects the request', async () => {
    mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: null, error: { message: 'not authenticated' } })
    await expect(currentAal()).rejects.toThrow('not authenticated')
  })
})

describe('elevateWithTotp', () => {
  it('challenges and verifies the factor', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: {}, error: null })

    await expect(elevateWithTotp('factor-1', '123456')).resolves.toBeUndefined()
    expect(mfa.challenge).toHaveBeenCalledWith({ factorId: 'factor-1' })
    expect(mfa.verify).toHaveBeenCalledWith({ factorId: 'factor-1', challengeId: 'challenge-1', code: '123456' })
  })

  it('throws when the challenge cannot be created', async () => {
    mfa.challenge.mockResolvedValue({ data: null, error: { message: 'too many attempts' } })
    await expect(elevateWithTotp('factor-1', '123456')).rejects.toThrow('too many attempts')
    expect(mfa.verify).not.toHaveBeenCalled()
  })

  it('throws when the code is wrong, without touching recovery codes', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } })

    await expect(elevateWithTotp('factor-1', '000000')).rejects.toThrow('Invalid TOTP code')
    expect(rpc).not.toHaveBeenCalled()
    expect(mfa.unenroll).not.toHaveBeenCalled()
  })
})

describe('recoveryCodesRemaining', () => {
  it('returns the remaining count', async () => {
    rpc.mockResolvedValue({ data: 7, error: null })
    await expect(recoveryCodesRemaining()).resolves.toBe(7)
    expect(rpc).toHaveBeenCalledWith('recovery_codes_remaining')
  })

  it('defaults to zero when Supabase returns null', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await expect(recoveryCodesRemaining()).resolves.toBe(0)
  })

  it('throws when the RPC fails', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    await expect(recoveryCodesRemaining()).rejects.toThrow('db down')
  })
})
