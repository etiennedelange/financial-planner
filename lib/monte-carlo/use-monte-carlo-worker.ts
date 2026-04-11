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
import type { WorkerRequest, WorkerResponse } from "./simulation.worker"

type SimState = { result: SimulationResult | null; isRunning: boolean }
type SimAction =
  | { type: "START" }
  | { type: "DONE"; result: SimulationResult }
  | { type: "ERROR" }

function simReducer(state: SimState, action: SimAction): SimState {
  switch (action.type) {
    case "START":
      return { result: state.result, isRunning: true }
    case "DONE":
      return { result: action.result, isRunning: false }
    case "ERROR":
      return { ...state, isRunning: false }
  }
}

/**
 * Runs Monte Carlo simulations in a Web Worker to keep the main thread free.
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
  marketAssumptions?: MarketAssumptions
): { simulationResult: SimulationResult | null; isRunning: boolean } {
  const [{ result, isRunning }, dispatch] = useReducer(simReducer, {
    result: null,
    isRunning: false,
  })

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
    // Don't start a run with no accounts — derived return values handle the reset
    if (accounts.length === 0) return

    // Lazily create the worker once
    if (!workerRef.current) {
      const worker = new Worker(
        new URL("./simulation.worker.ts", import.meta.url)
      )
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const { id, result: workerResult } = e.data
        // Ignore responses for superseded runs
        if (id === latestIdRef.current) {
          dispatch({ type: "DONE", result: workerResult })
        }
      }
      worker.onerror = (e) => {
        console.error("Monte Carlo worker error:", e)
        dispatch({ type: "ERROR" })
      }
      workerRef.current = worker
    }

    const id = ++latestIdRef.current
    dispatch({ type: "START" })

    const request: WorkerRequest = {
      id,
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig,
      config: { numberOfRuns },
      marketAssumptions,
    }
    workerRef.current.postMessage(request)
  }, [
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
    simulationResult: isEmpty ? null : result,
    isRunning: isEmpty ? false : isRunning,
  }
}
