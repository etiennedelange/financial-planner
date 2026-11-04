/**
 * Monte Carlo Web Worker
 *
 * Runs the simulation off the main thread so the UI stays responsive
 * during the 1,000+ iteration computation.
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

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const {
    id,
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    configs,
    marketAssumptions,
  } = event.data

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

  postMessage({ id, results } as WorkerResponse)
})
