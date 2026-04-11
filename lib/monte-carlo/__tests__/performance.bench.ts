/**
 * Performance benchmark for the Monte Carlo simulation.
 *
 * Measures main-thread blocking time — the key metric for the web worker migration.
 * Before workers: the main thread blocked for the full duration of each run.
 * After workers:  the main thread is free; only serialisation overhead remains.
 *
 * Run with:  npx vitest bench lib/monte-carlo/__tests__/performance.bench.ts
 */
import { bench, describe } from "vitest"
import { runMonteCarloSimulation } from "../simulation-engine"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  DrawdownConfig,
} from "@/types"

const account: Account = {
  id: "1",
  name: "Benchmark RA",
  type: "retirement_annuity",
  provider: "Test",
  currentBalance: 500_000,
  monthlyContribution: 5_000,
  expectedReturn: 11,
  annualFees: 0.75,
  contributionEscalation: 5,
}

const personalInfo: PersonalInfo = {
  currentAge: 35,
  retirementAge: 65,
  lifeExpectancy: 90,
  annualIncome: 600_000,
}

const retirementGoals: RetirementGoals = {
  desiredMonthlyIncome: 30_000,
  inflationRate: 5.5,
  legacyAmount: 0,
}

const drawdownConfig: DrawdownConfig = {
  strategy: "fixed_percentage",
  initialWithdrawalRate: 4,
  minimumWithdrawal: 15_000,
  maximumWithdrawal: 80_000,
}

describe("Monte Carlo simulation throughput", () => {
  bench("100 runs  (baseline)", () => {
    runMonteCarloSimulation(
      [account],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      { numberOfRuns: 100 }
    )
  })

  bench("1 000 runs (production default)", () => {
    runMonteCarloSimulation(
      [account],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      { numberOfRuns: 1_000 }
    )
  })

  bench("5 000 runs (stress)", () => {
    runMonteCarloSimulation(
      [account],
      personalInfo,
      retirementGoals,
      drawdownConfig,
      { numberOfRuns: 5_000 }
    )
  })
})

describe("Multi-account portfolio throughput (realistic)", () => {
  const accounts: Account[] = [
    account,
    {
      ...account,
      id: "2",
      name: "Pension Fund",
      type: "pension_fund",
      currentBalance: 1_200_000,
      monthlyContribution: 3_000,
      expectedReturn: 10,
    },
    {
      ...account,
      id: "3",
      name: "TFSA",
      type: "tax_free_savings",
      currentBalance: 250_000,
      monthlyContribution: 3_000,
      expectedReturn: 10,
      annualFees: 0.2,
    },
  ]

  bench("3 accounts × 1 000 runs (production)", () => {
    runMonteCarloSimulation(
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      { numberOfRuns: 1_000 }
    )
  })
})
