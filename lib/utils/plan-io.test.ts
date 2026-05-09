import { describe, it, expect, vi, beforeEach } from 'vitest'
import { exportPlan, parsePlanFile } from './plan-io'
import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from '@/types'

const personalInfo: PersonalInfo = {
  currentAge: 39,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 1200000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 35000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const assumptions: MarketAssumptions = {
  equityReturn: 11,
  bondReturn: 8,
  cashReturn: 6.5,
  equityVolatility: 16.5,
  bondVolatility: 6,
  inflationRate: 5.5,
  compoundingMethod: 'compound',
}

const drawdownConfig: DrawdownConfig = {
  strategy: 'fixed_amount_inflation_adjusted',
  initialWithdrawalRate: 3.5,
  minimumWithdrawal: 15000,
  maximumWithdrawal: 60000,
  lumpSumPercentage: 10,
}

const accounts: Account[] = [
  {
    id: 'acc-1',
    name: 'My RA',
    provider: 'Sanlam',
    type: 'retirement_annuity',
    currentBalance: 1750000,
    monthlyContribution: 14500,
    expectedReturn: 11,
    annualFees: 1,
    contributionEscalation: 6,
  },
  {
    id: 'acc-2',
    name: 'TFSA',
    provider: 'EasyEquities',
    type: 'tfsa',
    currentBalance: 80000,
    monthlyContribution: 2000,
    expectedReturn: 12,
    annualFees: 1,
    contributionEscalation: 6,
    tfsaContributionsToDate: 80000,
  },
]

function makePlanFile(content: unknown, filename = 'plan.json'): File {
  const blob = new Blob([JSON.stringify(content)], { type: 'application/json' })
  return new File([blob], filename, { type: 'application/json' })
}

describe('exportPlan', () => {
  beforeEach(() => {
    // Mock DOM APIs used by exportPlan
    const anchor = { href: '', download: '', click: vi.fn(), style: {} } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => anchor)
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => anchor)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('triggers a download', () => {
    exportPlan(personalInfo, retirementGoals, assumptions, drawdownConfig, 'nominal', accounts)
    expect(document.createElement).toHaveBeenCalledWith('a')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('sets filename with today\'s date', () => {
    const anchor = { href: '', download: '', click: vi.fn() } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    exportPlan(personalInfo, retirementGoals, assumptions, drawdownConfig, 'nominal', accounts)
    expect(anchor.download).toMatch(/^retirement-plan-\d{4}-\d{2}-\d{2}\.json$/)
  })
})

describe('parsePlanFile', () => {
  it('parses a valid plan file', async () => {
    const file = makePlanFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: { personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode: 'real', accounts },
    })
    const result = await parsePlanFile(file)
    expect(result.plan.personalInfo).toEqual(personalInfo)
    expect(result.plan.accounts).toHaveLength(2)
    expect(result.plan.displayMode).toBe('real')
  })

  it('preserves TFSA contributions to date', async () => {
    const file = makePlanFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      plan: { personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode: 'nominal', accounts },
    })
    const result = await parsePlanFile(file)
    const tfsa = result.plan.accounts.find((a) => a.type === 'tfsa')
    expect(tfsa?.tfsaContributionsToDate).toBe(80000)
  })

  it('rejects a file missing the plan key', async () => {
    const file = makePlanFile({ version: 1 })
    await expect(parsePlanFile(file)).rejects.toThrow('missing version or plan data')
  })

  it('rejects a file missing the version key', async () => {
    const file = makePlanFile({ plan: {} })
    await expect(parsePlanFile(file)).rejects.toThrow('missing version or plan data')
  })

  it('rejects an unsupported version', async () => {
    const file = makePlanFile({ version: 99, plan: {} })
    await expect(parsePlanFile(file)).rejects.toThrow('Unsupported plan version 99')
  })

  it('rejects a plan missing required fields', async () => {
    const file = makePlanFile({
      version: 1,
      plan: { personalInfo, retirementGoals },
    })
    await expect(parsePlanFile(file)).rejects.toThrow('missing required fields')
  })

  it('rejects malformed JSON', async () => {
    const blob = new Blob(['not json {{{'], { type: 'application/json' })
    const file = new File([blob], 'bad.json')
    await expect(parsePlanFile(file)).rejects.toThrow('Could not parse file')
  })
})
