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
  config: SimulationConfig
  marketAssumptions?: MarketAssumptions
}

export interface WorkerResponse {
  id: number
  result: SimulationResult
}

addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const {
    id,
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    config,
    marketAssumptions,
  } = event.data

  const result = runMonteCarloSimulation(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    config,
    marketAssumptions
  )

  postMessage({ id, result } as WorkerResponse)
})
