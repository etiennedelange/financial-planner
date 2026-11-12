/**
 * Investment-scenario Web Worker
 *
 * `compareScenarios` runs 3 × 1,000 Monte Carlo simulations. On the main thread that
 * blocked the UI for 100–600 ms per call, and because Next keeps recently visited routes
 * mounted (hidden) under `cacheComponents`, a hidden Risk page re-ran it on every Plan
 * keystroke — the page freezes in issue #34. Running it here keeps the main thread free.
 */

import {
  compareScenarios,
  type ScenarioComparisonParams,
  type ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"

export interface ScenarioWorkerRequest {
  id: number
  params: ScenarioComparisonParams
}

export interface ScenarioWorkerResponse {
  id: number
  result: ScenarioComparisonResult
}

addEventListener("message", (event: MessageEvent<ScenarioWorkerRequest>) => {
  const { id, params } = event.data
  postMessage({ id, result: compareScenarios(params) } as ScenarioWorkerResponse)
})
