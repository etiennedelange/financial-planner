"use client"

import { DashboardMetricsGrid } from "@/components/dashboard/dashboard-metrics-grid"
import { GettingStarted } from "@/components/dashboard/getting-started"
import { KeyInsightsSummary } from "@/components/dashboard/key-insights-summary"
import { PlanNarrativeCard } from "@/components/dashboard/plan-narrative-card"
import { SimulationRunStatus } from "@/components/dashboard/simulation-run-status"
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
  hasAccounts: boolean
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
  hasAccounts,
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

      <SimulationRunStatus
        simulationResult={simulationResult}
        isSimulating={isSimulating}
        hasAccounts={hasAccounts}
      />

      {projection ? (
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
      ) : (
        <GettingStarted />
      )}

      <PlanNarrativeCard />
    </div>
  )
}
