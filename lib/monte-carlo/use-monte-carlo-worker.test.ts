import { describe, expect, it } from "vite-plus/test"
import {
  RANGE_VOLATILITY_SCALES,
  initialSimState,
  newRangeSeed,
  simReducer,
  type SimulationRange,
} from "./use-monte-carlo-worker"
import { CAUTIOUS_VOLATILITY_FACTOR } from "@/lib/constants/investment-types"
import type { SimulationResult } from "@/types"

const one = { runs: [], percentiles: {} } as unknown as SimulationResult
const fakeResult: SimulationRange = { central: one, cautious: one }

describe("simReducer", () => {
  it("starts a run, keeping any previous result while running", () => {
    const running = simReducer({ ...initialSimState, result: fakeResult }, { type: "START" })
    expect(running).toEqual({ result: fakeResult, isRunning: true, hasError: false })
  })

  it("stores the finished result and clears the running flag", () => {
    const done = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: true },
      { type: "DONE", result: fakeResult },
    )
    expect(done).toEqual({ result: fakeResult, isRunning: false, hasError: false })
  })

  it("marks a worker error without discarding the last good result", () => {
    const errored = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: true },
      { type: "ERROR" },
    )
    expect(errored).toEqual({ result: fakeResult, isRunning: false, hasError: true })
  })

  it("clears the error flag when a new run starts", () => {
    const running = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: false, hasError: true },
      { type: "START" },
    )
    expect(running.hasError).toBe(false)
  })
})

describe("success range request", () => {
  it("runs central first, then cautious at the documented factor", () => {
    expect(RANGE_VOLATILITY_SCALES).toEqual([1, CAUTIOUS_VOLATILITY_FACTOR])
  })

  it("newRangeSeed gives a non-negative 31-bit integer from the random source", () => {
    expect(newRangeSeed(() => 0)).toBe(0)
    expect(newRangeSeed(() => 0.5)).toBe(2 ** 30)
    const seed = newRangeSeed(() => 0.999999999)
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeLessThan(2 ** 31)
  })
})
