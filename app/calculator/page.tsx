"use client"

import { useState, useEffect, useMemo } from "react"
import { Play, RotateCcw } from "lucide-react"
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
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { runMonteCarloSimulation } from "@/lib/monte-carlo/simulation-engine"
import type { ProjectionResult, SimulationResult } from "@/types"

export default function CalculatorPage() {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    resetToDefaults,
  } = useCalculatorStore()

  const [simulationResult, setSimulationResult] =
    useState<SimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)

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

  // Clear simulation results when inputs change
  useEffect(() => {
    setSimulationResult(null)
  }, [accounts, personalInfo, retirementGoals, drawdownConfig])

  const handleRunSimulation = () => {
    if (accounts.length === 0) return

    setIsSimulating(true)

    // Run simulation in next tick to allow UI to update
    setTimeout(() => {
      const result = runMonteCarloSimulation(
        accounts,
        personalInfo,
        retirementGoals,
        drawdownConfig,
        { numberOfRuns: 1000 }
      )
      setSimulationResult(result)
      setIsSimulating(false)
    }, 50)
  }

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
        <div className="flex gap-2">
          <Button
            onClick={handleRunSimulation}
            disabled={accounts.length === 0 || isSimulating}
          >
            <Play className="mr-2 h-4 w-4" />
            {isSimulating ? "Simulating..." : "Run Simulation"}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
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
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="personal">Personal</TabsTrigger>
          <TabsTrigger value="goals">Goals</TabsTrigger>
          <TabsTrigger value="assumptions">Assumptions</TabsTrigger>
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
      </Tabs>
    </div>
  )
}
