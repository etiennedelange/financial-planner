import { describe, expect, it, vi } from "vite-plus/test"
import type { SimulationResult } from "@/types"
import { CAUTIOUS_VOLATILITY_FACTOR } from "@/lib/constants/investment-types"
import {
  buildRangeRequest,
  createRangeWorkerClient,
  newRangeSeed,
  RANGE_VOLATILITY_SCALES,
  type RangeInputs,
  type WorkerLike,
} from "./range-worker-client"
import type { WorkerRequest, WorkerResponse } from "./simulation.worker"
import { runMonteCarloSimulation } from "./simulation-engine"

const result = (successRate: number) =>
  ({ successRate, runs: [], percentiles: {} }) as unknown as SimulationResult

const inputs: RangeInputs = {
  accounts: [
    {
      id: "a",
      name: "RA",
      provider: "",
      type: "retirement_annuity",
      currentBalance: 1_000_000,
      monthlyContribution: 5000,
      expectedReturn: 10,
      annualFees: 1,
      contributionEscalation: 5,
    },
  ],
  personalInfo: { currentAge: 50, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600_000 },
  retirementGoals: { desiredMonthlyIncome: 20_000, inflationRate: 5.5, legacyAmount: 0 },
  drawdownConfig: {
    strategy: "fixed_amount_inflation_adjusted",
    initialWithdrawalRate: 4,
    minimumWithdrawal: 0,
    maximumWithdrawal: 1e12,
    lumpSumPercentage: 0,
  },
  numberOfRuns: 50,
  marketAssumptions: { compoundingMethod: "compound", equityVolatility: 16.5 } as never,
}

/** A fake worker that records posts and lets the test deliver replies or errors */
function fakeWorker() {
  const posted: WorkerRequest[] = []
  const worker: WorkerLike & {
    reply: (id: number, results: SimulationResult[] | undefined) => void
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
    reply(id, results) {
      this.onmessage?.({ data: { id, results } as WorkerResponse } as MessageEvent<WorkerResponse>)
    },
    fail() {
      this.onerror?.({ message: "boom" } as ErrorEvent)
    },
  }
  return { worker, posted }
}

describe("buildRangeRequest", () => {
  describe("Critical SA scenarios", () => {
    it("runs central then cautious volatility on the SAME seed (common random numbers)", () => {
      const req = buildRangeRequest(7, inputs, 12345)
      expect(req.id).toBe(7)
      expect(req.configs).toEqual([
        { numberOfRuns: 50, randomSeed: 12345, volatilityScale: 1 },
        { numberOfRuns: 50, randomSeed: 12345, volatilityScale: CAUTIOUS_VOLATILITY_FACTOR },
      ])
      expect(RANGE_VOLATILITY_SCALES).toEqual([1, CAUTIOUS_VOLATILITY_FACTOR])
    })

    it("the request runs end to end in the real engine, cautious never above central", () => {
      // What simulation.worker.ts does with the request, run inline
      const req = buildRangeRequest(1, inputs, 99)
      const [central, cautious] = req.configs.map((config) =>
        runMonteCarloSimulation(
          req.accounts,
          req.personalInfo,
          req.retirementGoals,
          req.drawdownConfig,
          config,
          req.marketAssumptions,
        ),
      )
      expect(cautious.successRate).toBeLessThanOrEqual(central.successRate)
    })
  })

  it("passes every plan input through unchanged", () => {
    const req = buildRangeRequest(1, inputs, 1)
    expect(req.accounts).toBe(inputs.accounts)
    expect(req.personalInfo).toBe(inputs.personalInfo)
    expect(req.retirementGoals).toBe(inputs.retirementGoals)
    expect(req.drawdownConfig).toBe(inputs.drawdownConfig)
    expect(req.marketAssumptions).toBe(inputs.marketAssumptions)
  })
})

describe("newRangeSeed", () => {
  it("defaults to Math.random and gives a 31-bit non-negative integer", () => {
    const seed = newRangeSeed()
    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThan(2 ** 31)
  })
})

describe("createRangeWorkerClient", () => {
  describe("Lifecycle", () => {
    it("creates the worker lazily on the first run and reuses it", () => {
      const { worker, posted } = fakeWorker()
      const create = vi.fn(() => worker)
      const client = createRangeWorkerClient(create, vi.fn(), vi.fn())
      expect(create).not.toHaveBeenCalled()
      client.run(inputs, 1)
      client.run(inputs, 2)
      expect(create).toHaveBeenCalledTimes(1)
      expect(posted.map((p) => p.id)).toEqual([1, 2])
      expect(posted.map((p) => p.configs[0].randomSeed)).toEqual([1, 2])
    })

    it("uses a fresh seed per run when none is given", () => {
      const { worker, posted } = fakeWorker()
      const client = createRangeWorkerClient(() => worker, vi.fn(), vi.fn())
      client.run(inputs)
      expect(Number.isInteger(posted[0].configs[0].randomSeed)).toBe(true)
      expect(posted[0].configs[0].randomSeed).toBe(posted[0].configs[1].randomSeed)
    })

    it("dispose terminates the worker; the next run creates a new one", () => {
      const first = fakeWorker()
      const second = fakeWorker()
      const create = vi.fn().mockReturnValueOnce(first.worker).mockReturnValueOnce(second.worker)
      const client = createRangeWorkerClient(create, vi.fn(), vi.fn())
      client.run(inputs, 1)
      client.dispose()
      expect(first.worker.terminated).toBe(true)
      client.run(inputs, 2)
      expect(create).toHaveBeenCalledTimes(2)
      expect(second.posted).toHaveLength(1)
    })

    it("dispose before any run is a no-op", () => {
      const client = createRangeWorkerClient(() => fakeWorker().worker, vi.fn(), vi.fn())
      expect(() => client.dispose()).not.toThrow()
    })
  })

  describe("Replies", () => {
    it("delivers the latest run's central and cautious results", () => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const client = createRangeWorkerClient(() => worker, onResult, vi.fn())
      const id = client.run(inputs, 1)
      worker.reply(id, [result(82), result(74)])
      expect(onResult).toHaveBeenCalledWith({ central: result(82), cautious: result(74) })
    })

    it("drops a reply for a superseded run, so a slow old result never overwrites a new one", () => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const client = createRangeWorkerClient(() => worker, onResult, vi.fn())
      const oldId = client.run(inputs, 1)
      const newId = client.run(inputs, 2)
      worker.reply(oldId, [result(50), result(40)])
      expect(onResult).not.toHaveBeenCalled()
      worker.reply(newId, [result(90), result(85)])
      expect(onResult).toHaveBeenCalledTimes(1)
      expect(onResult.mock.calls[0][0].central.successRate).toBe(90)
    })
  })

  describe("Edge cases", () => {
    it.each([
      ["one result", [result(80)]],
      ["no results", []],
      ["a missing results field", undefined],
    ])("reports %s as an error instead of a half range", (_label, results) => {
      const { worker } = fakeWorker()
      const onResult = vi.fn()
      const onError = vi.fn()
      const client = createRangeWorkerClient(() => worker, onResult, onError)
      const id = client.run(inputs, 1)
      worker.reply(id, results as SimulationResult[] | undefined)
      expect(onResult).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledTimes(1)
      expect(String(onError.mock.calls[0][0])).toMatch(/of 2 results/)
    })

    it("forwards a worker error", () => {
      const { worker } = fakeWorker()
      const onError = vi.fn()
      const client = createRangeWorkerClient(() => worker, vi.fn(), onError)
      client.run(inputs, 1)
      worker.fail()
      expect(onError).toHaveBeenCalledWith({ message: "boom" })
    })
  })
})
