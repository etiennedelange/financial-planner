/**
 * Golden-output regression harness for the deterministic projection engine.
 *
 * Purpose: Phase 10 refactors restructure the calculation layer without changing its
 * financial semantics. Unit tests alone cannot prove that — they assert the cases someone
 * thought to write. This harness pins the ENTIRE output surface across a scenario matrix,
 * so any unintended numerical drift fails loudly.
 *
 * Regenerating: when a change is *intended* to alter output, review the diff line by line
 * first, record the delta in the phase doc, then run:
 *
 *     UPDATE_GOLDEN=1 npx vitest run lib/calculations/__tests__/golden-projection.test.ts
 *
 * Never regenerate to make a red test go green without reviewing the diff — that defeats
 * the entire purpose of the harness.
 *
 * Monte Carlo is deliberately EXCLUDED: `runMonteCarloSimulation` draws from an unseeded
 * `Math.random`, so its output is not reproducible. `SimulationConfig.randomSeed` is
 * declared in the type but never read by the engine. Wiring that seed through is a
 * prerequisite for extending this harness to Monte Carlo.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { calculateProjection } from '../projection-engine'

const GOLDEN_PATH = path.resolve(__dirname, '__golden__/projection.json')
const UPDATE = process.env.UPDATE_GOLDEN === '1'

const ra: Account = {
  id: '1', name: 'RA', type: 'retirement_annuity', provider: 'P',
  currentBalance: 900000, monthlyContribution: 6000,
  expectedReturn: 11, annualFees: 1.2, contributionEscalation: 6,
}
const tfsa: Account = {
  id: '2', name: 'TFSA', type: 'tfsa', provider: 'P',
  currentBalance: 250000, monthlyContribution: 3000,
  expectedReturn: 10, annualFees: 0.8, contributionEscalation: 5,
}
const discretionary: Account = {
  id: '3', name: 'Discretionary', type: 'discretionary', provider: 'P',
  currentBalance: 400000, monthlyContribution: 2000,
  expectedReturn: 9, annualFees: 1.0, contributionEscalation: 5,
}

const strategies = [
  'fixed_percentage',
  'fixed_amount_inflation_adjusted',
  'variable_percentage',
  'guardrails',
] as const

// Spans desired income falling inside, below and above the [min, max] band, since that
// band is where the strategies diverge most.
const bands = [
  { minimumWithdrawal: 10000, maximumWithdrawal: 200000, label: 'inside-band' },
  { minimumWithdrawal: 90000, maximumWithdrawal: 200000, label: 'below-min' },
  { minimumWithdrawal: 5000, maximumWithdrawal: 20000, label: 'above-max' },
]

const personas: Array<{ label: string; p: PersonalInfo; g: RetirementGoals }> = [
  {
    label: 'mid-career',
    p: { currentAge: 40, retirementAge: 65, lifeExpectancy: 90, annualIncome: 750000 },
    g: { desiredMonthlyIncome: 35000, inflationRate: 5.5, legacyAmount: 0 },
  },
  {
    label: 'near-retirement',
    p: { currentAge: 60, retirementAge: 65, lifeExpectancy: 90, annualIncome: 1200000 },
    g: { desiredMonthlyIncome: 55000, inflationRate: 5.5, legacyAmount: 0 },
  },
  {
    label: 'underfunded',
    p: { currentAge: 45, retirementAge: 65, lifeExpectancy: 90, annualIncome: 400000 },
    g: { desiredMonthlyIncome: 40000, inflationRate: 5.5, legacyAmount: 0 },
  },
  {
    label: 'zero-inflation',
    p: { currentAge: 50, retirementAge: 65, lifeExpectancy: 85, annualIncome: 600000 },
    g: { desiredMonthlyIncome: 30000, inflationRate: 0, legacyAmount: 0 },
  },
]

function buildMatrix(): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  for (const persona of personas) {
    for (const strategy of strategies) {
      for (const band of bands) {
        for (const lumpSumPercentage of [0, 30]) {
          const cfg: DrawdownConfig = {
            strategy,
            initialWithdrawalRate: 4,
            minimumWithdrawal: band.minimumWithdrawal,
            maximumWithdrawal: band.maximumWithdrawal,
            lumpSumPercentage,
          }
          const key = `${persona.label}|${strategy}|${band.label}|lump${lumpSumPercentage}`
          const r = calculateProjection([ra, tfsa, discretionary], persona.p, persona.g, cfg)
          const firstDraw = persona.p.retirementAge - persona.p.currentAge

          out[key] = {
            portfolioAtRetirement: fx(r.portfolioAtRetirement),
            monthlyIncomeAtRetirement: fx(r.monthlyIncomeAtRetirement),
            monthlyNetIncomeAtRetirement: fx(r.monthlyNetIncomeAtRetirement),
            shortfallAmount: fx(r.shortfallAmount),
            surplusAmount: fx(r.surplusAmount),
            portfolioDepletionAge: r.portfolioDepletionAge,
            totalLifetimeIncomeTax: fx(r.totalLifetimeIncomeTax),
            totalLumpSumTax: fx(r.totalLumpSumTax),
            totalMedicalAidContributions: fx(r.totalMedicalAidContributions),
            averageEffectiveTaxRate: fx(r.averageEffectiveTaxRate),
            lumpSum: {
              amount: fx(r.lumpSumCommutation.lumpSumAmount),
              tax: fx(r.lumpSumCommutation.lumpSumTax),
              remainingPortfolio: fx(r.lumpSumCommutation.remainingPortfolio),
            },
            // Sample the drawdown phase rather than storing all 25-50 rows per scenario:
            // enough to catch drift in the withdrawal path without a 5MB golden file.
            rows: [0, 1, 5, 10, 20].map((offset) => {
              const y = r.yearlyProjections[firstDraw + offset]
              return y
                ? {
                    age: y.age,
                    withdrawals: fx(y.withdrawals),
                    incomeTax: fx(y.incomeTax),
                    netIncome: fx(y.netIncome),
                    endingBalance: fx(y.endingBalance),
                    inflationAdjustedWithdrawal: fx(y.inflationAdjustedWithdrawal),
                  }
                : null
            }),
          }
        }
      }
    }
  }
  return out
}

// Fixed 2dp so floating-point noise below a cent cannot produce spurious failures,
// while any real semantic change still surfaces.
function fx(n: number): number | string {
  if (!Number.isFinite(n)) return String(n)
  return Math.round(n * 100) / 100
}

describe('golden projection output', () => {
  it('matches the committed golden file across the scenario matrix', () => {
    const actual = buildMatrix()

    if (UPDATE) {
      mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true })
      writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n')
      return
    }

    expect(
      existsSync(GOLDEN_PATH),
      `Golden file missing. Generate it with:\n  UPDATE_GOLDEN=1 npx vitest run ${path.relative(process.cwd(), __filename)}`
    ).toBe(true)

    const expected = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8'))

    // Compare key-by-key so a failure names the offending scenario rather than
    // dumping the whole matrix.
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort())
    for (const key of Object.keys(expected)) {
      expect(actual[key], `scenario changed: ${key}`).toEqual(expected[key])
    }
  })

  it('covers every strategy and both lump-sum settings', () => {
    const keys = Object.keys(buildMatrix())
    for (const s of strategies) {
      expect(keys.some((k) => k.includes(`|${s}|`)), `no scenario for ${s}`).toBe(true)
    }
    expect(keys.some((k) => k.endsWith('lump30'))).toBe(true)
    expect(keys.length).toBe(personas.length * strategies.length * bands.length * 2)
  })
})
