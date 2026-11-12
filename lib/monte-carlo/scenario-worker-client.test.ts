import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import {
  compareScenarios,
  type ScenarioComparisonParams,
  type ScenarioComparisonResult,
} from "@/lib/calculations/scenario-comparison"
import { createScenarioWorkerClient, type ScenarioWorkerLike } from "./scenario-worker-client"
import type { ScenarioWorkerRequest, ScenarioWorkerResponse } from "./scenario-comparison.worker"

const params: ScenarioComparisonParams = {
  currentSavings: 1_000_000,
  monthlyContribution: 5000,
  personalInfo: { currentAge: 50, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600_000 },
  retirementGoals: { desiredMonthlyIncome: 20_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_percentage",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 1e12,
    lumpSumPercentage: 0,
  },
  contributionEscalation: 0.05,
  fees: 0.01,
  compoundingMethod: "compound",
}

const result = (recommendation: string) =>
  ({ recommendation, recommendedScenario: "balanced" }) as unknown as ScenarioComparisonResult

/** A fake worker that records posts and lets the test deliver replies or errors */
function fakeWorker() {
  const posted: ScenarioWorkerRequest[] = []
  const worker: ScenarioWorkerLike & {
    reply: (id: number, result: ScenarioComparisonResult | undefined) => void
    fail: () => void
    terminated: boolean
  } = {
    onmessage: null,
    onerror: null,
    terminated: false,
    postMessage: (m) => void posted.push(m),
    terminate() {
      this.terminated = true
    },
    reply(id, reply) {
      this.onmessage?.({
        data: { id, result: reply } as ScenarioWorkerResponse,
      } as MessageEvent<ScenarioWorkerResponse>)
    },
    fail() {
      this.onerror?.({ message: "boom" } as ErrorEvent)
    },
  }
  return { worker, posted }
}

describe("createScenarioWorkerClient", () => {
  describe("Lifecycle", () => {
    it("creates the worker lazily on the first run and reuses it", () => {
      const { worker, posted } = fakeWorker()
      const create = vi.fn(() => worker)
      const client = createScenarioWorkerClient(create, vi.fn(), vi.fn())
      expect(create).not.toHaveBeenCalled()
      client.run(params)
      client.run(params)
      expect(create).toHaveBeenCalledTimes(1)
      expect(posted.map((p) => p.id)).toEqual([1, 2])
      expect(posted[0].params).toBe(params)
    })

    it("dispose terminates the worker; the next run creates a new one", () => {
      const first = fakeWorker()
      const second = fakeWorker()
      const create = vi.fn().mockReturnValueOnce(first.worker).mockReturnValueOnce(second.worker)
      const client = createScenarioWorkerClient(create, vi.fn(), vi.fn())
      client.run(params)
      client.dispose()
      expect(first.worker.terminated).toBe(true)
      client.run(params)
      expect(create).toHaveBeenCalledTimes(2)
      expect(second.posted).toHaveLength(1)
    })

    it("dispose before any run is a no-op", () => {
      const client = createScenarioWorkerClient(() => fakeWorker().worker, vi.fn(), vi.fn())
      expect(() => client.dispose()).not.toThrow()
    })
  })

  describe("Replies", () => {
    it("delivers the latest run's result", () => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const client = createScenarioWorkerClient(() => worker, onResult, vi.fn())
      const id = client.run(params)
      worker.reply(id, result("latest"))
      expect(onResult).toHaveBeenCalledWith(result("latest"))
    })

    it("drops a reply for a superseded run, so a slow old result never overwrites a new one", () => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const client = createScenarioWorkerClient(() => worker, onResult, vi.fn())
      const oldId = client.run(params)
      const newId = client.run(params)
      worker.reply(oldId, result("old"))
      expect(onResult).not.toHaveBeenCalled()
      worker.reply(newId, result("new"))
      expect(onResult).toHaveBeenCalledTimes(1)
      expect(onResult.mock.calls[0][0].recommendation).toBe("new")
    })
  })

  describe("Edge cases", () => {
    it("reports a reply without a result as an error", () => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const onError = vi.fn()
      const client = createScenarioWorkerClient(() => worker, onResult, onError)
      const id = client.run(params)
      worker.reply(id, undefined)
      expect(onResult).not.toHaveBeenCalled()
      expect(String(onError.mock.calls[0][0])).toMatch(/no result/)
    })

    it("forwards a worker error", () => {
      const { worker } = fakeWorker()
      const onError = vi.fn()
      const client = createScenarioWorkerClient(() => worker, vi.fn(), onError)
      client.run(params)
      worker.fail()
      expect(onError).toHaveBeenCalledWith({ message: "boom" })
    })
  })
})

describe("scenario-comparison.worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it("answers a request with compareScenarios for the same params and the request id", async () => {
    let handler: ((event: MessageEvent<ScenarioWorkerRequest>) => void) | undefined
    const postMessage = vi.fn()
    vi.stubGlobal("addEventListener", (type: string, fn: typeof handler) => {
      if (type === "message") handler = fn
    })
    vi.stubGlobal("postMessage", postMessage)

    await import("./scenario-comparison.worker")
    handler!({ data: { id: 42, params } } as MessageEvent<ScenarioWorkerRequest>)

    expect(postMessage).toHaveBeenCalledTimes(1)
    const reply = postMessage.mock.calls[0][0] as ScenarioWorkerResponse
    expect(reply.id).toBe(42)
    // The Monte Carlo success rates are random; every deterministic field must match the
    // main-thread function exactly — the worker adds no logic of its own.
    const direct = compareScenarios(params)
    for (const key of ["conservative", "balanced", "aggressive"] as const) {
      expect(reply.result[key].projectedNestEgg).toBe(direct[key].projectedNestEgg)
      expect(reply.result[key].yearsLasts).toBe(direct[key].yearsLasts)
      expect(reply.result[key].successProbability).toBeGreaterThanOrEqual(0)
      expect(reply.result[key].successProbability).toBeLessThanOrEqual(100)
    }
  })
})
