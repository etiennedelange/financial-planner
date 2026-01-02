"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AccountList } from "@/components/accounts/account-list"
import { PersonalInfoForm } from "@/components/inputs/personal-info-form"
import { RetirementGoalsForm } from "@/components/inputs/retirement-goals-form"
import { AssumptionsForm } from "@/components/inputs/assumptions-form"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { SuccessGauge } from "@/components/charts/success-gauge"
import { ProjectionSummary } from "@/components/results/projection-summary"
import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { runMonteCarloSimulation } from "@/lib/monte-carlo/simulation-engine"
import type { ProjectionResult, SimulationResult } from "@/types"

export default function CalculatorPage() {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    resetToDefaults,
  } = useCalculatorStore()

  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const simulationTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Calculate projection whenever inputs change
  const projection: ProjectionResult | null = useMemo(() => {
    if (accounts.length === 0) return null
    return calculateProjection(
      accounts,
      personalInfo,
      retirementGoals,
      drawdownConfig
    )
  }, [accounts, personalInfo, retirementGoals, drawdownConfig])

  // Auto-run Monte Carlo simulation when inputs change (debounced)
  useEffect(() => {
    // Clear any pending simulation
    if (simulationTimeoutRef.current) {
      clearTimeout(simulationTimeoutRef.current)
    }

    // Don't run if no accounts
    if (accounts.length === 0) {
      setSimulationResult(null)
      return
    }

    setIsSimulating(true)

    // Debounce simulation by 300ms to avoid running while user is typing
    simulationTimeoutRef.current = setTimeout(() => {
      const result = runMonteCarloSimulation(
        accounts,
        personalInfo,
        retirementGoals,
        drawdownConfig,
        { numberOfRuns: 1000 },
        assumptions
      )
      setSimulationResult(result)
      setIsSimulating(false)
    }, 300)

    // Cleanup on unmount or before next effect
    return () => {
      if (simulationTimeoutRef.current) {
        clearTimeout(simulationTimeoutRef.current)
      }
    }
  }, [accounts, personalInfo, retirementGoals, assumptions, drawdownConfig])

  const handleReset = () => {
    resetToDefaults()
    setSimulationResult(null)
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">SA Retirement Calculator</h1>
          <p className="text-muted-foreground">
            Plan your retirement with Monte Carlo simulations
          </p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset
        </Button>
      </div>

      {/* Results Summary */}
      {projection && (
        <div className="mb-8">
          <ProjectionSummary
            projection={projection}
            retirementAge={personalInfo.retirementAge}
          />
        </div>
      )}

      {/* Charts */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <PortfolioGrowthChart
          projections={projection?.yearlyProjections || []}
          retirementAge={personalInfo.retirementAge}
        />
        <div className="space-y-4">
          <MonteCarloChart
            simulationResult={simulationResult}
            currentAge={personalInfo.currentAge}
            retirementAge={personalInfo.retirementAge}
            isRunning={isSimulating}
          />
          {simulationResult && (
            <SuccessGauge successRate={simulationResult.successRate} />
          )}
        </div>
      </div>

      {/* Input Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="calculations">Calculations</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts">
          <AccountList />
        </TabsContent>

        <TabsContent value="personal">
          <PersonalInfoForm />
        </TabsContent>

        <TabsContent value="goals">
          <RetirementGoalsForm />
        </TabsContent>

        <TabsContent value="assumptions">
          <AssumptionsForm />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsPanel />
        </TabsContent>

        <TabsContent value="calculations">
          <CalculationsBreakdown />
        </TabsContent>
      </Tabs>
    </div>
  )
}
