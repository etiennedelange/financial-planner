import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vite-plus/test"
import { compareScenarios } from "@/lib/calculations/scenario-comparison"
import type { ScenarioComparisonParams } from "@/lib/calculations/scenario-comparison"
import {
  handleWorkerMessage,
  type ScenarioWorkerRequest,
  type ScenarioWorkerResponse,
  type WorkerRequest,
  type WorkerResponse,
} from "./simulation.worker"
import { runMonteCarloSimulation } from "./simulation-engine"

const plan = {
  personalInfo: { currentAge: 50, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600_000 },
  retirementGoals: { desiredMonthlyIncome: 20_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_amount_inflation_adjusted" as const,
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 1e12,
    lumpSumPercentage: 0,
  },
}

const rangeRequest: WorkerRequest = {
  id: 3,
  accounts: [
    {
      id: "a",
      name: "RA",
      provider: "",
      type: "retirement_annuity",
      currentBalance: 1_000_000,
      monthlyContribution: 5000,
      expectedReturn: 10,
      annualFees: 1,
      contributionEscalation: 5,
    },
  ],
  ...plan,
  configs: [
    { numberOfRuns: 40, randomSeed: 7, volatilityScale: 1 },
    { numberOfRuns: 40, randomSeed: 7, volatilityScale: 1.3 },
  ],
}

const scenarioParams: ScenarioComparisonParams = {
  currentSavings: 1_000_000,
  monthlyContribution: 5000,
  ...plan,
  contributionEscalation: 0.05,
  fees: 0.01,
  compoundingMethod: "compound",
}

describe("handleWorkerMessage", () => {
  describe("malformed requests (page and worker from different builds)", () => {
    it("names the received keys when a range request has no configs", () => {
      const { configs: _configs, ...old } = rangeRequest
      expect(() => handleWorkerMessage(old as unknown as WorkerRequest)).toThrow(
        /no configs array \(keys: id, accounts/,
      )
    })

    it("rejects a scenarios request without params", () => {
      expect(() =>
        handleWorkerMessage({ kind: "scenarios", id: 1 } as unknown as ScenarioWorkerRequest),
      ).toThrow(/no params \(keys: kind, id\)/)
    })

    it("rejects a non-object message", () => {
      expect(() => handleWorkerMessage(null as unknown as WorkerRequest)).toThrow(/got null/)
      expect(() => handleWorkerMessage("x" as unknown as WorkerRequest)).toThrow(/got string/)
    })
  })

  it("runs a success-range request exactly as the engine does, one result per config", () => {
    const reply = handleWorkerMessage(rangeRequest) as WorkerResponse
    expect(reply.id).toBe(3)
    expect(reply.results).toHaveLength(2)
    // Seeded, so the worker's results must equal direct engine calls bit for bit
    rangeRequest.configs.forEach((config, i) => {
      const direct = runMonteCarloSimulation(
        rangeRequest.accounts,
        rangeRequest.personalInfo,
        rangeRequest.retirementGoals,
        rangeRequest.drawdownConfig,
        config,
        rangeRequest.marketAssumptions,
      )
      expect(reply.results[i].successRate).toBe(direct.successRate)
    })
  })

  it("routes a request tagged kind: scenarios to compareScenarios", () => {
    const reply = handleWorkerMessage({
      kind: "scenarios",
      id: 9,
      params: scenarioParams,
    }) as ScenarioWorkerResponse
    expect(reply.id).toBe(9)
    expect("results" in reply).toBe(false)
    const direct = compareScenarios(scenarioParams)
    expect(reply.result.balanced.projectedNestEgg).toBe(direct.balanced.projectedNestEgg)
    expect(reply.result.recommendedScenario).toBeDefined()
  })
})

/** Every source file under these roots, skipping tests */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) return sourceFiles(full)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : []
  })
}

describe("single worker entry (production Turbopack build)", () => {
  it("every `new Worker(new URL(...))` in the app uses simulation.worker.ts", () => {
    // Two worker entry files were crossed in the production build when both started
    // together on the Risk page, leaving the success rate at "Waiting for simulation".
    // See the header of simulation.worker.ts before adding a second entry.
    const root = path.resolve(__dirname, "../..")
    const entries = ["app", "components", "lib"]
      .flatMap((d) => sourceFiles(path.join(root, d)))
      .flatMap((file) =>
        [
          ...readFileSync(file, "utf8").matchAll(/new Worker\(\s*new URL\(\s*["']([^"']+)["']/g),
        ].map((m) => path.basename(m[1])),
      )
    expect(entries.length).toBeGreaterThanOrEqual(2)
    expect(new Set(entries)).toEqual(new Set(["simulation.worker.ts"]))
  })
})
