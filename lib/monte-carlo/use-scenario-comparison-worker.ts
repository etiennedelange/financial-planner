"use client"

import { useEffect, useReducer, useRef } from "react"
import type {
  ScenarioComparisonParams,
  ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"
import { createScenarioWorkerClient, type ScenarioWorkerClient } from "./scenario-worker-client"

type ScenarioState = {
  result: ScenarioComparisonResult | null
  isRunning: boolean
  hasError: boolean
}
type ScenarioAction =
  | { type: "START" }
  | { type: "DONE"; result: ScenarioComparisonResult }
  | { type: "ERROR" }

export const initialScenarioState: ScenarioState = {
  result: null,
  isRunning: false,
  hasError: false,
}

export function scenarioReducer(state: ScenarioState, action: ScenarioAction): ScenarioState {
  switch (action.type) {
    case "START":
      return { result: state.result, isRunning: true, hasError: false }
    case "DONE":
      return { result: action.result, isRunning: false, hasError: false }
    case "ERROR":
      return { ...state, isRunning: false, hasError: true }
  }
}

/**
 * Runs `compareScenarios` (3 × 1,000 Monte Carlo simulations) in a Web Worker so it never
 * blocks the main thread. Pass `null` when there is nothing to compare (no accounts).
 *
 * The run lives in an effect on purpose: when Next hides the Risk route after navigation
 * (`cacheComponents` keeps it mounted inside a hidden `<Activity>`), React tears its effects
 * down, so a hidden Risk page posts nothing while the user edits inputs elsewhere. It runs
 * once with the latest inputs when the page is shown again.
 */
export function useScenarioComparisonWorker(params: ScenarioComparisonParams | null): {
  result: ScenarioComparisonResult | null
  isRunning: boolean
  hasError: boolean
} {
  const [{ result, isRunning, hasError }, dispatch] = useReducer(
    scenarioReducer,
    initialScenarioState,
  )
  const clientRef = useRef<ScenarioWorkerClient | null>(null)

  useEffect(() => {
    return () => {
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!params) return
    clientRef.current ??= createScenarioWorkerClient(
      // The same entry file as useMonteCarloWorker, on purpose: see simulation.worker.ts
      () => new Worker(new URL("./simulation.worker.ts", import.meta.url)),
      (comparison) => dispatch({ type: "DONE", result: comparison }),
      (error) => {
        console.error("Scenario comparison worker error:", error)
        dispatch({ type: "ERROR" })
      },
    )
    dispatch({ type: "START" })
    clientRef.current.run(params)
  }, [params])

  const isEmpty = params === null
  return {
    result: isEmpty ? null : result,
    isRunning: isEmpty ? false : isRunning,
    hasError: isEmpty ? false : hasError,
  }
}
