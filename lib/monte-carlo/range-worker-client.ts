import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  RetirementGoals,
  SimulationResult,
} from "@/types"
import { CAUTIOUS_VOLATILITY_FACTOR } from "@/lib/constants/investment-types"
import type { WorkerRequest, WorkerResponse } from "./simulation.worker"

/** Central (researched) and cautious (stressed) volatility, run together */
export interface SimulationRange {
  central: SimulationResult
  cautious: SimulationResult
}

/** The two volatility scales the Risk page runs, central first */
export const RANGE_VOLATILITY_SCALES = [1, CAUTIOUS_VOLATILITY_FACTOR] as const

/**
 * A fresh seed per request, shared by both simulations in it. Each request still samples
 * new futures (as the unseeded engine did), but the central and cautious runs see the
 * SAME futures, so the range reflects volatility alone.
 */
export function newRangeSeed(random: () => number = Math.random): number {
  return Math.floor(random() * 2 ** 31)
}

export interface RangeInputs {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  numberOfRuns: number
  marketAssumptions?: MarketAssumptions
}

/** The worker request for one range: one config per scale, all with the same seed */
export function buildRangeRequest(id: number, inputs: RangeInputs, seed: number): WorkerRequest {
  return {
    id,
    accounts: inputs.accounts,
    personalInfo: inputs.personalInfo,
    retirementGoals: inputs.retirementGoals,
    drawdownConfig: inputs.drawdownConfig,
    configs: RANGE_VOLATILITY_SCALES.map((volatilityScale) => ({
      numberOfRuns: inputs.numberOfRuns,
      randomSeed: seed,
      volatilityScale,
    })),
    marketAssumptions: inputs.marketAssumptions,
  }
}

/** The part of the Worker API the client uses, so tests can pass a fake */
export interface WorkerLike {
  postMessage(message: WorkerRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface RangeWorkerClient {
  /** Post a new range request; any reply to an earlier request is ignored from now on */
  run(inputs: RangeInputs, seed?: number): number
  /** Terminate the worker; a later `run` creates a fresh one */
  dispose(): void
}

/**
 * The Monte Carlo worker lifecycle, without React: the worker is created lazily on the
 * first run and reused; each run is tagged with an increasing id and replies for
 * superseded runs are dropped, so a slow old result can never overwrite a newer one; a
 * worker error, or a reply without both results, is reported through `onError`.
 * `useMonteCarloWorker` is a thin wrapper around this.
 */
export function createRangeWorkerClient(
  createWorker: () => WorkerLike,
  onResult: (range: SimulationRange) => void,
  onError: (error: unknown) => void,
): RangeWorkerClient {
  let worker: WorkerLike | null = null
  let latestId = 0
  // True from posting a run until its reply arrives: a worker still busy when the next
  // run is requested is terminated, because it cannot skip messages it already holds
  let busy = false

  const discard = () => {
    worker?.terminate()
    worker = null
    busy = false
  }

  const ensureWorker = (): WorkerLike => {
    if (worker) return worker
    const created = createWorker()
    created.onmessage = (event) => {
      const { id, results } = event.data
      if (id !== latestId) return
      busy = false
      const [central, cautious] = results ?? []
      if (!central || !cautious) {
        onError(new Error(`Monte Carlo worker returned ${results?.length ?? 0} of 2 results`))
        return
      }
      onResult({ central, cautious })
    }
    created.onerror = (event) => {
      // A worker that errored (failed to load, threw) is dead: drop it so the next run
      // gets a fresh one instead of posting into the void
      if (worker === created) discard()
      onError(event)
    }
    worker = created
    return created
  }

  return {
    run(inputs, seed = newRangeSeed()) {
      // Cancel superseded work: terminating stops the queued simulations from running
      if (busy) discard()
      const target = ensureWorker()
      const id = ++latestId
      busy = true
      target.postMessage(buildRangeRequest(id, inputs, seed))
      return id
    },
    dispose: discard,
  }
}
