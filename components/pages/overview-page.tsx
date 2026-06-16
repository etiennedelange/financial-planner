"use client"

import { DashboardMetricsGrid } from "@/components/dashboard/dashboard-metrics-grid"
import { GettingStarted } from "@/components/dashboard/getting-started"
import { KeyInsightsSummary } from "@/components/dashboard/key-insights-summary"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import type { ProjectionResult, SimulationResult } from "@/types"

interface OverviewPageProps {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  totalCurrentBalance: number
  totalMonthlyContributions: number
  desiredMonthlyIncome: number
  annualIncome: number
}

export function OverviewPage({
  projection,
  simulationResult,
  isSimulating,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
  desiredMonthlyIncome,
  annualIncome,
}: OverviewPageProps) {
  return (
    <div className="space-y-6">
      <DashboardMetricsGrid
        projection={projection}
        simulationResult={simulationResult}
        isSimulating={isSimulating}
        retirementAge={retirementAge}
        currentAge={currentAge}
        lifeExpectancy={lifeExpectancy}
        inflationRate={inflationRate}
        totalCurrentBalance={totalCurrentBalance}
        totalMonthlyContributions={totalMonthlyContributions}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <PortfolioGrowthChart
          projections={projection?.yearlyProjections || []}
          retirementAge={retirementAge}
        />
        <MonteCarloChart
          simulationResult={simulationResult}
          currentAge={currentAge}
          retirementAge={retirementAge}
          isRunning={isSimulating}
        />
      </div>

      <KeyInsightsSummary
        projection={projection}
        currentAge={currentAge}
        retirementAge={retirementAge}
        lifeExpectancy={lifeExpectancy}
        currentMonthlyIncome={annualIncome / 12}
        desiredMonthlyIncome={desiredMonthlyIncome}
        inflationRate={inflationRate}
        monteCarloSuccessRate={simulationResult?.successRate}
      />

      {!projection && <GettingStarted />}
    </div>
  )
}
