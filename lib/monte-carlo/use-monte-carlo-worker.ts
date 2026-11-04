"use client"

import { useReducer, useEffect, useRef } from "react"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
  SimulationResult,
} from "@/types"
import {
  createRangeWorkerClient,
  type RangeWorkerClient,
  type SimulationRange,
} from "./range-worker-client"

export { RANGE_VOLATILITY_SCALES, newRangeSeed, type SimulationRange } from "./range-worker-client"

type SimState = { result: SimulationRange | null; isRunning: boolean; hasError: boolean }
type SimAction = { type: "START" } | { type: "DONE"; result: SimulationRange } | { type: "ERROR" }

export const initialSimState: SimState = { result: null, isRunning: false, hasError: false }

export function simReducer(state: SimState, action: SimAction): SimState {
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
 * Runs Monte Carlo simulations in a Web Worker to keep the main thread free: the central
 * and cautious volatility profiles, with common random numbers (Feature 2, 2026-11-04).
 *
 * A single worker is lazily created and reused across runs. Each run is tagged
 * with a monotonically increasing id; responses for superseded runs are silently
 * dropped so the component never shows stale data.
 *
 * @param numberOfRuns - primitive so it doesn't cause spurious effect triggers
 */
export function useMonteCarloWorker(
  accounts: Account[],
  personalInfo: PersonalInfo,
  retirementGoals: RetirementGoals,
  drawdownConfig: DrawdownConfig,
  numberOfRuns: number,
  marketAssumptions?: MarketAssumptions,
  enabled = true,
): {
  simulationResult: SimulationResult | null
  cautiousResult: SimulationResult | null
  isRunning: boolean
  hasError: boolean
} {
  const [{ result, isRunning, hasError }, dispatch] = useReducer(simReducer, initialSimState)

  const clientRef = useRef<RangeWorkerClient | null>(null)

  // Tear down the worker when the component unmounts
  useEffect(() => {
    return () => {
      clientRef.current?.dispose()
      clientRef.current = null
    }
  }, [])

  // (Re-)run the simulation whenever any input changes
  useEffect(() => {
    if (!enabled || accounts.length === 0) return

    clientRef.current ??= createRangeWorkerClient(
      () => new Worker(new URL("./simulation.worker.ts", import.meta.url)),
      (range) => dispatch({ type: "DONE", result: range }),
      (error) => {
        console.error("Monte Carlo worker error:", error)
        dispatch({ type: "ERROR" })
      },
    )
    dispatch({ type: "START" })
    clientRef.current.run({
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      numberOfRuns,
      marketAssumptions,
    })
  }, [
    enabled,
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    numberOfRuns,
    marketAssumptions,
  ])

  // When there are no accounts the result and running flag are always reset
  // without needing a setState call inside the effect body.
  const isEmpty = accounts.length === 0
  return {
    simulationResult: isEmpty ? null : (result?.central ?? null),
    cautiousResult: isEmpty ? null : (result?.cautious ?? null),
    isRunning: isEmpty ? false : isRunning,
    hasError: isEmpty ? false : hasError,
  }
}
