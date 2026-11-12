/**
 * Monte Carlo Web Worker: the app's ONLY worker entry
 *
 * Runs simulations off the main thread so the UI stays responsive. It answers two kinds
 * of request: the Risk page's success range (`WorkerRequest`) and the investment-scenario
 * comparison (`ScenarioWorkerRequest`, tagged `kind: "scenarios"`).
 *
 * Keep it to one entry file. With two (`simulation.worker.ts` and a separate
 * `scenario-comparison.worker.ts`), the production Turbopack build crossed them when both
 * workers started together on the Risk page: the range worker ran the scenario code and
 * vice versa, so the success rate never arrived ("Waiting for simulation"). With one
 * entry every worker instance runs the same code, so a crossed load is harmless.
 * `single-worker-entry.test.ts` fails if a second entry appears.
 */

import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
  SimulationConfig,
  SimulationResult,
} from "@/types"
import {
  compareScenarios,
  type ScenarioComparisonParams,
  type ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"
import { runMonteCarloSimulation } from "./simulation-engine"

export interface WorkerRequest {
  id: number
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  /**
   * One simulation per entry, in order. Every simulation uses the same `randomSeed`
   * (common random numbers), so results for different volatility scales differ only
   * because of volatility, not sampling noise.
   */
  configs: SimulationConfig[]
  marketAssumptions?: MarketAssumptions
}

export interface WorkerResponse {
  id: number
  /** Same order as `WorkerRequest.configs` */
  results: SimulationResult[]
}

/** `compareScenarios` (3 × 1,000 simulations) for the Risk page's scenario cards */
export interface ScenarioWorkerRequest {
  kind: "scenarios"
  id: number
  params: ScenarioComparisonParams
}

export interface ScenarioWorkerResponse {
  id: number
  result: ScenarioComparisonResult
}

/** The worker's message handler, exported so tests can drive it without a Worker */
export function handleWorkerMessage(
  data: WorkerRequest | ScenarioWorkerRequest,
): WorkerResponse | ScenarioWorkerResponse {
  if ("kind" in data && data.kind === "scenarios") {
    return { id: data.id, result: compareScenarios(data.params) }
  }

  const {
    id,
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    configs,
    marketAssumptions,
  } = data as WorkerRequest

  const results = configs.map((config) =>
    runMonteCarloSimulation(
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      config,
      marketAssumptions,
    ),
  )
  return { id, results }
}

addEventListener("message", (event: MessageEvent<WorkerRequest | ScenarioWorkerRequest>) => {
  postMessage(handleWorkerMessage(event.data))
})
