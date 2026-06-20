export interface SimulationConfig {
  numberOfRuns: number // 1000-10000
  randomSeed?: number // for reproducibility
}

export interface SimulationRun {
  runId: number
  yearlyBalances: number[]
  finalBalance: number
  depletionAge: number | null
  success: boolean // funds lasted until life expectancy
  lifetimeIncomeTax?: number // sum of annual income/CGT tax over the drawdown phase, for reporting only
}

export interface SimulationResult {
  runs: SimulationRun[]
  successRate: number // % of successful runs
  percentiles: {
    p10: number[] // 10th percentile balances by year
    p25: number[]
    p50: number[] // median
    p75: number[]
    p90: number[]
  }
  medianDepletionAge: number | null
  averageFinalBalance: number
  averageLifetimeIncomeTax?: number // mean of SimulationRun.lifetimeIncomeTax across runs
}
