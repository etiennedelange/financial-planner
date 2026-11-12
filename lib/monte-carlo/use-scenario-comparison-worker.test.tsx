import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test"
import type {
  ScenarioComparisonParams,
  ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"
import {
  initialScenarioState,
  scenarioReducer,
  useScenarioComparisonWorker,
} from "./use-scenario-comparison-worker"
import type { ScenarioWorkerRequest, ScenarioWorkerResponse } from "./simulation.worker"

const fakeResult = { recommendation: "r" } as unknown as ScenarioComparisonResult

const params: ScenarioComparisonParams = {
  currentSavings: 500_000,
  monthlyContribution: 3000,
  personalInfo: { currentAge: 40, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600_000 },
  retirementGoals: { desiredMonthlyIncome: 25_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 1e12,
    lumpSumPercentage: 0,
  },
  contributionEscalation: 0.05,
  fees: 0.01,
  compoundingMethod: "nominal",
}

describe("scenarioReducer", () => {
  it("starts a run, keeping any previous result while running", () => {
    const running = scenarioReducer(
      { ...initialScenarioState, result: fakeResult },
      { type: "START" },
    )
    expect(running).toEqual({ result: fakeResult, isRunning: true, hasError: false })
  })

  it("stores the finished result and clears the running flag", () => {
    const done = scenarioReducer(
      { ...initialScenarioState, isRunning: true },
      { type: "DONE", result: fakeResult },
    )
    expect(done).toEqual({ result: fakeResult, isRunning: false, hasError: false })
  })

  it("marks a worker error without discarding the last good result", () => {
    const errored = scenarioReducer(
      { result: fakeResult, isRunning: true, hasError: false },
      { type: "ERROR" },
    )
    expect(errored).toEqual({ result: fakeResult, isRunning: false, hasError: true })
  })
})

/** Stand-in for the browser Worker: records every instance and what was posted to it */
class FakeWorker {
  static instances: FakeWorker[] = []
  posted: ScenarioWorkerRequest[] = []
  terminated = false
  onmessage: ((event: MessageEvent<ScenarioWorkerResponse>) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  constructor() {
    FakeWorker.instances.push(this)
  }
  postMessage(message: ScenarioWorkerRequest) {
    this.posted.push(message)
  }
  terminate() {
    this.terminated = true
  }
}

describe("useScenarioComparisonWorker", () => {
  let container: HTMLDivElement
  let root: Root

  /** Renders the hook's state into the DOM so the test reads it without render side effects */
  function Probe({ input }: { input: ScenarioComparisonParams | null }) {
    const { result, isRunning, hasError } = useScenarioComparisonWorker(input)
    return (
      <output
        data-result={result?.recommendation ?? ""}
        data-running={String(isRunning)}
        data-error={String(hasError)}
      />
    )
  }

  const latest = () => {
    const el = container.querySelector("output")!
    return {
      result: el.dataset.result || null,
      isRunning: el.dataset.running === "true",
      hasError: el.dataset.error === "true",
    }
  }

  const render = (input: ScenarioComparisonParams | null) =>
    act(() => root.render(<Probe input={input} />))

  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal("Worker", FakeWorker)
    container = document.createElement("div")
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it("posts nothing and reports nothing when there is nothing to compare", () => {
    render(null)
    expect(FakeWorker.instances).toHaveLength(0)
    expect(latest()).toEqual({ result: null, isRunning: false, hasError: false })
  })

  it("runs the comparison off the main thread and delivers the worker's result", () => {
    render(params)
    expect(FakeWorker.instances).toHaveLength(1)
    const worker = FakeWorker.instances[0]
    expect(worker.posted).toEqual([{ kind: "scenarios", id: 1, params }])
    expect(latest().isRunning).toBe(true)

    act(() =>
      worker.onmessage?.({
        data: { id: 1, result: fakeResult },
      } as MessageEvent<ScenarioWorkerResponse>),
    )
    expect(latest()).toEqual({ result: "r", isRunning: false, hasError: false })
  })

  it("a re-render with the same params object posts nothing new (one run per input change)", () => {
    render(params)
    render(params)
    expect(FakeWorker.instances[0].posted).toHaveLength(1)
    render({ ...params, currentSavings: 600_000 })
    expect(FakeWorker.instances[0].posted).toHaveLength(2)
  })

  it("reports a worker error", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    render(params)
    act(() => FakeWorker.instances[0].onerror?.({ message: "boom" } as ErrorEvent))
    expect(latest().hasError).toBe(true)
    expect(latest().isRunning).toBe(false)
    consoleError.mockRestore()
  })

  it("terminates the worker on unmount", () => {
    render(params)
    act(() => root.unmount())
    expect(FakeWorker.instances[0].terminated).toBe(true)
    // afterEach unmounts again; give it a fresh root so that is a no-op
    root = createRoot(container)
  })
})
