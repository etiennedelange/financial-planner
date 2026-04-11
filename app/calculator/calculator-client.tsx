"use client"

import { AccountList } from "@/components/accounts/account-list"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import { ColorThemeToggle } from "@/components/color-theme-toggle"
import { CollapsibleSection } from "@/components/dashboard/collapsible-section"
import { DashboardMetricsGrid } from "@/components/dashboard/dashboard-metrics-grid"
import { KeyInsightsSummary } from "@/components/dashboard/key-insights-summary"
import { QuickActionsCard } from "@/components/dashboard/quick-actions-card"
import { DebugWindow } from "@/components/debug/debug-window"
import { AssumptionsForm } from "@/components/inputs/assumptions-form"
import { PersonalInfoForm } from "@/components/inputs/personal-info-form"
import { RetirementGoalsForm } from "@/components/inputs/retirement-goals-form"
import { CalculationsBreakdown } from "@/components/results/calculations-breakdown"
import { InsightsPanel } from "@/components/results/insights-panel"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult } from "@/types"
import { BarChart3, BookOpen, Calculator, RotateCcw, Settings, TrendingDown } from "lucide-react"
import { useDeferredValue, useMemo, useRef, useState } from "react"
import { useShallow } from "zustand/react/shallow"

export function CalculatorClient() {
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
  } = useCalculatorStore(
    useShallow(state => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      displayMode: state.displayMode,
      setAssumptions: state.setAssumptions,
      setDisplayMode: state.setDisplayMode,
      resetToDefaults: state.resetToDefaults,
    }))
  )

  // Deferred inputs: React will re-render with the previous values while new
  // values are still processing, so the expensive Monte Carlo useMemo only
  // runs once inputs have "settled" — no setTimeout debounce needed.
  const deferredAccounts = useDeferredValue(accounts)
  const deferredPersonalInfo = useDeferredValue(personalInfo)
  const deferredRetirementGoals = useDeferredValue(retirementGoals)
  const deferredAssumptions = useDeferredValue(assumptions)
  const deferredDrawdownConfig = useDeferredValue(drawdownConfig)

  // Monte Carlo runs in a Web Worker — deferred inputs are passed so the worker
  // only triggers once inputs have "settled", matching the previous useMemo behaviour.
  const { simulationResult, isRunning: isWorkerRunning } = useMonteCarloWorker(
    deferredAccounts,
    deferredPersonalInfo,
    deferredRetirementGoals,
    deferredDrawdownConfig,
    10000,
    deferredAssumptions
  )

  // True while inputs have changed but the worker hasn't returned the result yet
  const isSimulating =
    isWorkerRunning ||
    deferredAccounts !== accounts ||
    deferredPersonalInfo !== personalInfo ||
    deferredRetirementGoals !== retirementGoals ||
    deferredAssumptions !== assumptions ||
    deferredDrawdownConfig !== drawdownConfig

  // State for controlling collapsible sections
  const [openSections, setOpenSections] = useState({
    accounts: true,
    planningInputs: false,
    detailedInsights: false,
    calculations: false,
  })

  // Refs for scrolling to sections
  const accountsRef = useRef<HTMLDivElement>(null)
  const detailedInsightsRef = useRef<HTMLDivElement>(null)

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

  const handleReset = () => {
    resetToDefaults()
    // simulationResult recomputes automatically via useMemo + useDeferredValue
  }

  // Quick Actions handlers
  const handleAddAccount = () => {
    setOpenSections((prev) => ({ ...prev, accounts: true }))
    setTimeout(() => {
      accountsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleViewInsights = () => {
    setOpenSections((prev) => ({ ...prev, detailedInsights: true }))
    setTimeout(() => {
      detailedInsightsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const handleExportReport = () => {
    if (!projection) return

    const exportData = {
      generatedAt: new Date().toISOString(),
      personalInfo,
      retirementGoals,
      assumptions,
      accounts: accounts.map(acc => ({
        name: acc.name,
        type: acc.type,
        currentBalance: acc.currentBalance,
        monthlyContribution: acc.monthlyContribution,
      })),
      projection: {
        portfolioAtRetirement: projection.portfolioAtRetirement,
        monthlyIncomeAtRetirement: projection.monthlyIncomeAtRetirement,
        monthlyNetIncomeAtRetirement: projection.monthlyNetIncomeAtRetirement,
        portfolioDepletionAge: projection.portfolioDepletionAge,
        shortfallAmount: projection.shortfallAmount,
        surplusAmount: projection.surplusAmount,
        totalLifetimeIncomeTax: projection.totalLifetimeIncomeTax,
        totalLumpSumTax: projection.totalLumpSumTax,
        averageEffectiveTaxRate: projection.averageEffectiveTaxRate,
        replacementRatio: projection.replacementRatio,
      },
      monteCarloSimulation: simulationResult ? {
        successRate: simulationResult.successRate,
        averageFinalBalance: simulationResult.averageFinalBalance,
        medianDepletionAge: simulationResult.medianDepletionAge,
        percentiles: {
          p10: simulationResult.percentiles.p10[simulationResult.percentiles.p10.length - 1],
          p50: simulationResult.percentiles.p50[simulationResult.percentiles.p50.length - 1],
          p90: simulationResult.percentiles.p90[simulationResult.percentiles.p90.length - 1],
        },
      } : null,
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `retirement-plan-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Calculate totals for dashboard metrics
  const totalCurrentBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0)
  const totalMonthlyContributions = accounts.reduce((sum, acc) => sum + (acc.monthlyContribution || 0), 0)

  return (
    <div className="dashboard-container">
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

      {/* Dashboard Metrics Grid */}
      {projection && (
        <div className="dashboard-section">
          <DashboardMetricsGrid
            projection={projection}
            simulationResult={simulationResult}
            retirementAge={personalInfo.retirementAge}
            currentAge={personalInfo.currentAge}
            lifeExpectancy={personalInfo.lifeExpectancy}
            inflationRate={retirementGoals.inflationRate}
            totalCurrentBalance={totalCurrentBalance}
            totalMonthlyContributions={totalMonthlyContributions}
          />
        </div>
      )}

      {/* Primary Charts */}
      <div className="dashboard-section grid gap-8 lg:grid-cols-2">
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

      {/* Secondary Widgets */}
      {projection && (
        <div className="dashboard-section grid gap-8 lg:grid-cols-2">
          <QuickActionsCard
            onAddAccount={handleAddAccount}
            onViewInsights={handleViewInsights}
            onExportReport={handleExportReport}
          />
          <KeyInsightsSummary
            projection={projection}
            currentAge={personalInfo.currentAge}
            retirementAge={personalInfo.retirementAge}
            lifeExpectancy={personalInfo.lifeExpectancy}
            currentMonthlyIncome={personalInfo.annualIncome / 12}
            desiredMonthlyIncome={retirementGoals.desiredMonthlyIncome}
            inflationRate={retirementGoals.inflationRate}
            monteCarloSuccessRate={simulationResult?.successRate}
          />
        </div>
      )}

      {/* Collapsible Sections */}
      <div className="dashboard-section space-y-0">
        <div ref={accountsRef}>
          <CollapsibleSection
            id="accounts"
            title="Accounts"
            icon={TrendingDown}
            badge={accounts.length > 0 ? accounts.length : undefined}
            open={openSections.accounts}
            onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, accounts: open }))}
          >
            <AccountList />
          </CollapsibleSection>
        </div>

        <CollapsibleSection
          id="planning-inputs"
          title="Planning Inputs"
          icon={Settings}
          open={openSections.planningInputs}
          onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, planningInputs: open }))}
        >
          <div className="space-y-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
              <PersonalInfoForm />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Retirement Goals</h3>
              <RetirementGoalsForm />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-4">Investment Assumptions</h3>
              <AssumptionsForm />
            </div>
          </div>
        </CollapsibleSection>

        <div ref={detailedInsightsRef}>
          <CollapsibleSection
            id="detailed-insights"
            title="Detailed Insights"
            icon={BarChart3}
            open={openSections.detailedInsights}
            onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, detailedInsights: open }))}
          >
            <InsightsPanel />
          </CollapsibleSection>
        </div>

        <CollapsibleSection
          id="calculations"
          title="Calculations Breakdown"
          icon={BookOpen}
          open={openSections.calculations}
          onOpenChange={(open) => setOpenSections((prev) => ({ ...prev, calculations: open }))}
        >
          <CalculationsBreakdown />
        </CollapsibleSection>
      </div>
    </div>
  )
}
