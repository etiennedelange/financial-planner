import { describe, expect, it } from "vitest"
import { initialSimState, simReducer } from "./use-monte-carlo-worker"
import type { SimulationResult } from "@/types"

const fakeResult = { runs: [], percentiles: {} } as unknown as SimulationResult

describe("simReducer", () => {
  it("starts a run, keeping any previous result while running", () => {
    const running = simReducer({ ...initialSimState, result: fakeResult }, { type: "START" })
    expect(running).toEqual({ result: fakeResult, isRunning: true, hasError: false })
  })

  it("stores the finished result and clears the running flag", () => {
    const done = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: true },
      { type: "DONE", result: fakeResult }
    )
    expect(done).toEqual({ result: fakeResult, isRunning: false, hasError: false })
  })

  it("marks a worker error without discarding the last good result", () => {
    const errored = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: true },
      { type: "ERROR" }
    )
    expect(errored).toEqual({ result: fakeResult, isRunning: false, hasError: true })
  })

  it("clears the error flag when a new run starts", () => {
    const running = simReducer(
      { ...initialSimState, result: fakeResult, isRunning: false, hasError: true },
      { type: "START" }
    )
    expect(running.hasError).toBe(false)
  })
})
