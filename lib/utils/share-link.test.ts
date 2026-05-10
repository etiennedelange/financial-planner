import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { encodeShareToken, decodeShareToken, buildShareUrl, copyShareUrl } from './share-link'
import type { ShareablePlan } from './share-link'

const plan: ShareablePlan = {
  personalInfo: {
    currentAge: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 600000,
  },
  retirementGoals: {
    desiredMonthlyIncome: 30000,
    inflationRate: 5.5,
    legacyAmount: 0,
  },
  assumptions: {
    equityReturn: 11,
    bondReturn: 8,
    cashReturn: 6.5,
    equityVolatility: 16.5,
    bondVolatility: 6,
    inflationRate: 5.5,
    compoundingMethod: 'compound',
  },
  drawdownConfig: {
    strategy: 'fixed_amount_inflation_adjusted',
    initialWithdrawalRate: 3.5,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  },
  displayMode: 'nominal',
  accounts: [
    {
      id: 'acc-1',
      name: 'My RA',
      provider: 'Allan Gray',
      type: 'retirement_annuity',
      currentBalance: 500000,
      monthlyContribution: 5000,
      expectedReturn: 11,
      annualFees: 1.5,
      contributionEscalation: 5,
    },
  ],
}

describe('encodeShareToken', () => {
  it('returns a non-empty string', () => {
    expect(encodeShareToken(plan)).toBeTruthy()
  })

  it('returns a valid base64 string', () => {
    const token = encodeShareToken(plan)
    expect(() => atob(token)).not.toThrow()
  })

  it('produces a different token for different plans', () => {
    const other: ShareablePlan = { ...plan, displayMode: 'real' }
    expect(encodeShareToken(plan)).not.toBe(encodeShareToken(other))
  })
})

describe('decodeShareToken', () => {
  it('round-trips: encode → decode returns original plan', () => {
    const token = encodeShareToken(plan)
    const decoded = decodeShareToken(token)
    expect(decoded).toEqual(plan)
  })

  it('preserves all percentage fields as-is (not converted to decimal)', () => {
    const token = encodeShareToken(plan)
    const decoded = decodeShareToken(token)!
    // These are stored as raw percentages (e.g. 5.5, not 0.055)
    expect(decoded.assumptions.inflationRate).toBe(5.5)
    expect(decoded.assumptions.equityReturn).toBe(11)
    expect(decoded.accounts[0].expectedReturn).toBe(11)
    expect(decoded.accounts[0].annualFees).toBe(1.5)
    expect(decoded.accounts[0].contributionEscalation).toBe(5)
  })

  it('preserves displayMode', () => {
    const realPlan: ShareablePlan = { ...plan, displayMode: 'real' }
    const decoded = decodeShareToken(encodeShareToken(realPlan))!
    expect(decoded.displayMode).toBe('real')
  })

  it('returns null for an empty string', () => {
    expect(decodeShareToken('')).toBeNull()
  })

  it('returns null for invalid base64', () => {
    expect(decodeShareToken('not-valid-base64!!!')).toBeNull()
  })

  it('returns null for valid base64 but non-JSON content', () => {
    const garbage = btoa('hello world')
    expect(decodeShareToken(garbage)).toBeNull()
  })

  it('preserves accounts array with all fields', () => {
    const token = encodeShareToken(plan)
    const decoded = decodeShareToken(token)!
    expect(decoded.accounts).toHaveLength(1)
    expect(decoded.accounts[0].id).toBe('acc-1')
    expect(decoded.accounts[0].currentBalance).toBe(500000)
    expect(decoded.accounts[0].type).toBe('retirement_annuity')
  })
})

describe('buildShareUrl', () => {
  it('includes the share param', () => {
    const url = buildShareUrl(plan)
    expect(url).toContain('?share=')
  })

  it('produces a decodable token in the URL', () => {
    const url = buildShareUrl(plan)
    const token = new URL(url, 'http://localhost').searchParams.get('share')!
    const decoded = decodeShareToken(token)
    expect(decoded).toEqual(plan)
  })
})

describe('copyShareUrl', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('writes the share URL to the clipboard', async () => {
    await copyShareUrl(plan)
    expect(navigator.clipboard.writeText).toHaveBeenCalledOnce()
    const written = (navigator.clipboard.writeText as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(written).toContain('?share=')
  })
})

describe('percentage unit conventions', () => {
  it('all rate fields in MarketAssumptions are stored as percentages (not decimals)', () => {
    // The plan fixture uses values like 5.5, 11, 8 — not 0.055, 0.11, 0.08
    // This test documents and guards the unit contract used throughout the app
    const token = encodeShareToken(plan)
    const decoded = decodeShareToken(token)!
    expect(decoded.assumptions.inflationRate).toBeGreaterThan(1)    // 5.5, not 0.055
    expect(decoded.assumptions.equityReturn).toBeGreaterThan(1)     // 11, not 0.11
    expect(decoded.assumptions.bondReturn).toBeGreaterThan(1)       // 8, not 0.08
    expect(decoded.assumptions.cashReturn).toBeGreaterThan(1)       // 6.5, not 0.065
  })

  it('account rate fields are stored as percentages (not decimals)', () => {
    const token = encodeShareToken(plan)
    const decoded = decodeShareToken(token)!
    const acc = decoded.accounts[0]
    expect(acc.expectedReturn).toBeGreaterThan(1)       // 11, not 0.11
    expect(acc.annualFees).toBeGreaterThan(0.1)         // 1.5, not 0.015
    expect(acc.contributionEscalation).toBeGreaterThan(1) // 5, not 0.05
  })
})
