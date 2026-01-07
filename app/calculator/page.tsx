"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { RotateCcw, Calculator, TrendingDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { COMPOUNDING_METHOD_LABELS } from "@/types"
import type { CompoundingMethod } from "@/types"
import { AccountList } from "@/components/accounts/account-list"
import { PersonalInfoForm } from "@/components/inputs/personal-info-form"
import { RetirementGoalsForm } from "@/components/inputs/retirement-goals-form"
import { AssumptionsForm } from "@/components/inputs/assumptions-form"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { ProjectionSummary } from "@/components/results/projection-summary"
import { InsightsPanel } from "@/components/results/insights-panel"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { DebugWindow } from "@/components/debug/debug-window"
import { ThemeToggle } from "@/components/theme-toggle"
import { ColorThemeToggle } from "@/components/color-theme-toggle"
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
    displayMode,
    setAssumptions,
    setDisplayMode,
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
      drawdownConfig,
      assumptions
    )
  }, [accounts, personalInfo, retirementGoals, drawdownConfig, assumptions])

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
    <div className="container mx-auto py-4 px-3 md:py-8 md:px-4">
      <div className="mb-6 space-y-4 md:mb-8 md:space-y-0">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">SA Retirement Calculator</h1>
            <p className="text-sm text-muted-foreground md:text-base">
              Plan your retirement with Monte Carlo simulations
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:flex-nowrap">
            <DebugWindow projection={projection} simulationResult={simulationResult} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="md:w-auto md:px-4">
                  <TrendingDown className="h-4 w-4" />
                  <span className="ml-2 hidden md:inline">
                    {displayMode === 'real' ? "Today's Value" : 'Future Value'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Display Values As</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setDisplayMode('nominal')}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${displayMode === 'nominal' ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="font-medium">Future Value (Nominal)</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-4">
                    Show values in future Rands. R1M at retirement will actually be R1M then.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDisplayMode('real')}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${displayMode === 'real' ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="font-medium">Today&apos;s Value (Real)</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-4">
                    Adjust all values to today&apos;s purchasing power. Easier to understand long-term values.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  This affects how monetary values are displayed across all tabs.
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="md:w-auto md:px-4">
                  <Calculator className="h-4 w-4" />
                  <span className="ml-2 hidden md:inline">
                    {assumptions.compoundingMethod === 'compound' ? 'Compound' : 'Nominal'}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Return Calculation Method</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setAssumptions({ compoundingMethod: 'nominal' })}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${assumptions.compoundingMethod === 'nominal' ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="font-medium">Nominal (Excel-compatible)</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-4">
                    12% ÷ 12 = 1%/month. Matches Excel FV but overstates returns by ~0.7% annually.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setAssumptions({ compoundingMethod: 'compound' })}
                  className="flex flex-col items-start gap-1 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${assumptions.compoundingMethod === 'compound' ? 'bg-primary' : 'bg-muted'}`} />
                    <span className="font-medium">Compound (Actuarially correct)</span>
                  </div>
                  <span className="text-xs text-muted-foreground pl-4">
                    (1.12)^(1/12) - 1 = 0.95%/month. Mathematically precise for long-term projections.
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  This setting affects all calculations across all tabs.
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="icon" onClick={handleReset} className="md:w-auto md:px-4">
              <RotateCcw className="h-4 w-4" />
              <span className="ml-2 hidden md:inline">Reset</span>
            </Button>

            <ColorThemeToggle />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* Results Summary */}
      {projection && (
        <div className="mb-8">
          <ProjectionSummary
            projection={projection}
            retirementAge={personalInfo.retirementAge}
            currentAge={personalInfo.currentAge}
            lifeExpectancy={personalInfo.lifeExpectancy}
            inflationRate={retirementGoals.inflationRate}
            simulationResult={simulationResult}
          />
        </div>
      )}

      {/* Charts */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <PortfolioGrowthChart
          projections={projection?.yearlyProjections || []}
          retirementAge={personalInfo.retirementAge}
        />
        <MonteCarloChart
          simulationResult={simulationResult}
          currentAge={personalInfo.currentAge}
          retirementAge={personalInfo.retirementAge}
          isRunning={isSimulating}
        />
      </div>

      {/* Input Tabs */}
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 gap-1 md:flex md:justify-center lg:grid lg:grid-cols-6">
          <TabsTrigger value="accounts" className="text-xs md:text-sm">
            <span className="md:hidden">Accts</span>
            <span className="hidden md:inline">Accounts</span>
          </TabsTrigger>
          <TabsTrigger value="personal" className="text-xs md:text-sm">
            <span className="md:hidden">Info</span>
            <span className="hidden md:inline">Personal</span>
          </TabsTrigger>
          <TabsTrigger value="goals" className="text-xs md:text-sm">
            Goals
          </TabsTrigger>
          <TabsTrigger value="assumptions" className="text-xs md:text-sm">
            <span className="md:hidden">Calc</span>
            <span className="hidden md:inline">Assumptions</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs md:text-sm">
            <span className="md:hidden">Stats</span>
            <span className="hidden md:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="calculations" className="text-xs md:text-sm">
            <span className="md:hidden">Math</span>
            <span className="hidden md:inline">Calculations</span>
          </TabsTrigger>
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
