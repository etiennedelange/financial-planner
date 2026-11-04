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
import { CAUTIOUS_VOLATILITY_FACTOR } from "@/lib/constants/investment-types"
import type { WorkerRequest, WorkerResponse } from "./simulation.worker"

/** Central (researched) and cautious (stressed) volatility, run together */
export interface SimulationRange {
  central: SimulationResult
  cautious: SimulationResult
}

type SimState = { result: SimulationRange | null; isRunning: boolean; hasError: boolean }
type SimAction = { type: "START" } | { type: "DONE"; result: SimulationRange } | { type: "ERROR" }

export const initialSimState: SimState = { result: null, isRunning: false, hasError: false }

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

  const workerRef = useRef<Worker | null>(null)
  const latestIdRef = useRef(0)

  // Tear down the worker when the component unmounts
  useEffect(() => {
    return () => {
      workerRef.current?.terminate()
      workerRef.current = null
    }
  }, [])

  // (Re-)run the simulation whenever any input changes
  useEffect(() => {
    if (!enabled || accounts.length === 0) return

    // Lazily create the worker once
    if (!workerRef.current) {
      const worker = new Worker(new URL("./simulation.worker.ts", import.meta.url))
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, results } = e.data
        // Ignore responses for superseded runs
        if (id === latestIdRef.current) {
          dispatch({ type: "DONE", result: { central: results[0], cautious: results[1] } })
        }
      }
      worker.onerror = (e) => {
        console.error("Monte Carlo worker error:", e)
        dispatch({ type: "ERROR" })
      }
      workerRef.current = worker
    }

    const id = ++latestIdRef.current
    const seed = newRangeSeed()
    dispatch({ type: "START" })

    const request: WorkerRequest = {
      id,
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      configs: RANGE_VOLATILITY_SCALES.map((volatilityScale) => ({
        numberOfRuns,
        randomSeed: seed,
        volatilityScale,
      })),
      marketAssumptions,
    }
    workerRef.current.postMessage(request)
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
