import type {
  ScenarioComparisonParams,
  ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"
import type { ScenarioWorkerRequest, ScenarioWorkerResponse } from "./simulation.worker"

/** The part of the Worker API the client uses, so tests can pass a fake */
export interface ScenarioWorkerLike {
  postMessage(message: ScenarioWorkerRequest): void
  terminate(): void
  onmessage: ((event: MessageEvent<ScenarioWorkerResponse>) => void) | null
  onerror: ((event: ErrorEvent) => void) | null
}

export interface ScenarioWorkerClient {
  /** Post a new comparison; any reply to an earlier request is ignored from now on */
  run(params: ScenarioComparisonParams): number
  /** Terminate the worker; a later `run` creates a fresh one */
  dispose(): void
}

/**
 * The scenario-comparison worker lifecycle, without React — the same contract as
 * `createRangeWorkerClient`: the worker is created lazily on the first run and reused;
 * each run is tagged with an increasing id and replies for superseded runs are dropped,
 * so a slow old result can never overwrite a newer one; a worker error, or a reply
 * without a result, is reported through `onError`.
 */
export function createScenarioWorkerClient(
  createWorker: () => ScenarioWorkerLike,
  onResult: (result: ScenarioComparisonResult) => void,
  onError: (error: unknown) => void,
): ScenarioWorkerClient {
  let worker: ScenarioWorkerLike | null = null
  let latestId = 0

  const ensureWorker = (): ScenarioWorkerLike => {
    if (worker) return worker
    const created = createWorker()
    created.onmessage = (event) => {
      const { id, result } = event.data
      if (id !== latestId) return
      if (!result) {
        onError(new Error("Scenario worker returned no result"))
        return
      }
      onResult(result)
    }
    created.onerror = (event) => onError(event)
    worker = created
    return created
  }

  return {
    run(params) {
      const target = ensureWorker()
      const id = ++latestId
      target.postMessage({ kind: "scenarios", id, params })
      return id
    },
    dispose() {
      worker?.terminate()
      worker = null
    },
  }
}
