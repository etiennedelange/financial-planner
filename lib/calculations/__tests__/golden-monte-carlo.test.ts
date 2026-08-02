/**
 * Golden-output regression harness for the Monte Carlo engine.
 *
 * This was impossible before Phase 10 Step 2.5: `SimulationConfig.randomSeed` existed in
 * the type but was never read, so simulation output could not be reproduced and had to be
 * compared statistically (see the Step 1 write-up, where a real semantic change had to be
 * teased out of ~1-3pp of sampling noise across 2000-run repeats).
 *
 * With the seed wired through, the same seed and inputs now produce identical output, so
 * Monte Carlo can be pinned exactly like the deterministic engine.
 *
 * Regenerating: review the diff, record the delta in the phase doc, then run
 *
 *     UPDATE_GOLDEN=1 npx vitest run lib/calculations/__tests__/golden-monte-carlo.test.ts
 */
import { describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import path from 'path'
import type { Account, DrawdownConfig, PersonalInfo, RetirementGoals } from '@/types'
import { runMonteCarloSimulation } from '@/lib/monte-carlo/simulation-engine'

const GOLDEN_PATH = path.resolve(__dirname, '__golden__/monte-carlo.json')
const UPDATE = process.env.UPDATE_GOLDEN === '1'
const SEED = 20260726

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

const strategies = [
  'fixed_percentage',
  'fixed_amount_inflation_adjusted',
  'variable_percentage',
  'guardrails',
] as const

// The min/max band is where the deterministic and Monte Carlo engines diverged at year 0
// before Step 1, so it stays in the matrix as a regression guard.
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
    label: 'underfunded',
    p: { currentAge: 45, retirementAge: 65, lifeExpectancy: 90, annualIncome: 400000 },
    g: { desiredMonthlyIncome: 40000, inflationRate: 5.5, legacyAmount: 0 },
  },
]

function fx(n: number | null): number | string | null {
  if (n === null) return null
  if (!Number.isFinite(n)) return String(n)
  return Math.round(n * 100) / 100
}

function buildMatrix(): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const persona of personas) {
    for (const strategy of strategies) {
      for (const band of bands) {
        const cfg: DrawdownConfig = {
          strategy,
          initialWithdrawalRate: 4,
          minimumWithdrawal: band.minimumWithdrawal,
          maximumWithdrawal: band.maximumWithdrawal,
          lumpSumPercentage: 0,
        }
        const key = `${persona.label}|${strategy}|${band.label}`
        const r = runMonteCarloSimulation(
          [ra, tfsa], persona.p, persona.g, cfg,
          { numberOfRuns: 200, randomSeed: SEED }
        )
        const atRetirement = persona.p.retirementAge - persona.p.currentAge
        out[key] = {
          successRate: fx(r.successRate),
          medianDepletionAge: fx(r.medianDepletionAge),
          averageFinalBalance: fx(r.averageFinalBalance),
          p10AtRetirement: fx(r.percentiles.p10[atRetirement] ?? 0),
          p50AtRetirement: fx(r.percentiles.p50[atRetirement] ?? 0),
          p90AtRetirement: fx(r.percentiles.p90[atRetirement] ?? 0),
          p50Final: fx(r.percentiles.p50[r.percentiles.p50.length - 1] ?? 0),
        }
      }
    }
  }
  return out
}

describe('golden monte carlo output', () => {
  it('is reproducible: the same seed yields identical output', () => {
    // Precondition for the golden comparison below to mean anything at all.
    expect(buildMatrix()).toEqual(buildMatrix())
  })

  it('matches the committed golden file across the scenario matrix', () => {
    const actual = buildMatrix()

    if (UPDATE) {
      mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true })
      writeFileSync(GOLDEN_PATH, JSON.stringify(actual, null, 2) + '\n')
      return
    }

    expect(
      existsSync(GOLDEN_PATH),
      'Golden file missing. Generate it with UPDATE_GOLDEN=1.'
    ).toBe(true)

    const expected = JSON.parse(readFileSync(GOLDEN_PATH, 'utf-8'))
    expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort())
    for (const key of Object.keys(expected)) {
      expect(actual[key], `scenario changed: ${key}`).toEqual(expected[key])
    }
  })
})
