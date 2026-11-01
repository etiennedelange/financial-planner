"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useShallow } from "zustand/react/shallow"
import { Gauge, Hourglass, TrendingDown, Wallet } from "lucide-react"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { compareScenarios } from "@/lib/calculations/scenario-comparison"
import { computePortfolioTotals } from "@/lib/calculations/utils/portfolio-totals"
import { buildPlanVerdict, type PlanVerdictTone } from "@/lib/utils/plan-verdict"
import { getSuccessRateStyle } from "@/lib/utils/success-rate"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { DashboardMetricCard } from "@/components/dashboard/dashboard-metric-card"
import { VolatilityForm } from "@/components/inputs/volatility-form"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { ScenarioComparisonChart } from "@/components/charts/scenario-comparison-chart"
import { InvestmentScenariosCard } from "@/components/results/investment-scenarios-card"
import { MonteCarloMethodology } from "@/components/results/monte-carlo-methodology"

/** Matches the simulation size the calculator context requests from the worker. */
const NUMBER_OF_RUNS = 1000

const verdictToneStyles: Record<PlanVerdictTone, string> = {
  neutral: "text-muted-foreground",
  success: "text-chart-2",
  good: "text-chart-4",
  warning: "text-warning",
  danger: "text-destructive",
}

/**
 * Risk: everything about market ups and downs in one place — the volatility inputs, the
 * Monte Carlo results, the investment-scenario comparison and how the simulation works.
 * Every other page shows the deterministic projection, which assumes steady returns.
 * The simulation only runs while this page is open (see calculator-context.tsx).
 */
export function RiskPage() {
  const { projection, simulationResult, isSimulating, simulationError } = useCalculator()
  const { accounts, personalInfo, retirementGoals, drawdownConfig, assumptions, displayMode } =
    useCalculatorStore(
      useShallow((s) => ({
        accounts: s.accounts,
        personalInfo: s.personalInfo,
        retirementGoals: s.retirementGoals,
        drawdownConfig: s.drawdownConfig,
        assumptions: s.assumptions,
        displayMode: s.displayMode,
      })),
    )

  const totals = useMemo(() => computePortfolioTotals(accounts), [accounts])

  // Computed once and shared by the scenario chart and card: each call is 3 × 1,000
  // simulations on the main thread.
  const scenarios = useMemo(
    () =>
      accounts.length === 0
        ? null
        : compareScenarios({
            currentSavings: totals.totalBalance,
            monthlyContribution: totals.totalContribution,
            personalInfo,
            retirementGoals,
            drawdownConfig,
            contributionEscalation: totals.avgEscalation,
            fees: totals.weightedFees,
            compoundingMethod: assumptions.compoundingMethod,
          }),
    [accounts.length, totals, personalInfo, retirementGoals, drawdownConfig, assumptions],
  )

  const verdict = useMemo(
    () =>
      buildPlanVerdict({
        successRate: simulationResult?.successRate ?? null,
        depletionAge: projection?.portfolioDepletionAge ?? null,
      }),
    [simulationResult, projection],
  )

  if (accounts.length === 0) {
    return (
      <PageCard label="Risk" className="dashboard-card">
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your retirement accounts first — the simulation tests your actual portfolio against
            1,000 possible markets.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calculator/accounts">Add accounts →</Link>
          </Button>
        </div>
      </PageCard>
    )
  }

  const successRate = simulationResult?.successRate ?? null
  const pending = isSimulating ? "…" : "--"
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-prose">
        Every other page assumes your investments grow by the same amount every year. Markets
        don&apos;t. This page runs {NUMBER_OF_RUNS.toLocaleString()} simulated markets to show how
        good and bad stretches — especially early in retirement — could change whether your income
        lasts.
      </p>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span
          className={`font-mono text-lg font-semibold tabular-nums ${verdictToneStyles[verdict.tone]}`}
        >
          {verdict.tone === "neutral" ? "—" : "◆"}
        </span>
        <p className={`text-sm font-medium ${verdictToneStyles[verdict.tone]}`}>
          {verdict.headline}
        </p>
      </div>

      <div className="dashboard-grid grid-cols-1 sm:grid-cols-3">
        <DashboardMetricCard
          icon={Gauge}
          label="Plan Success Rate"
          value={successRate !== null ? `${successRate.toFixed(0)}%` : pending}
          description={
            successRate !== null
              ? getSuccessRateStyle(successRate).label
              : isSimulating
                ? "Simulating…"
                : "Waiting for simulation"
          }
          successRate={successRate ?? undefined}
          tooltip="Share of simulated markets in which your plan pays your full income every year to life expectancy."
        />
        <DashboardMetricCard
          icon={TrendingDown}
          label="Futures That Fall Short"
          value={successRate !== null ? `${(100 - successRate).toFixed(0)}%` : pending}
          description="Income could not be paid in full at some point"
          tooltip="Includes futures where money remains but a living annuity has reached its 17.5% legal maximum, so the full income cannot be drawn."
        />
        <DashboardMetricCard
          icon={Hourglass}
          label="Typical Shortfall Age"
          value={
            simulationResult
              ? simulationResult.medianDepletionAge !== null
                ? `Age ${simulationResult.medianDepletionAge}`
                : "None"
              : pending
          }
          description="Median first short year, among futures that fall short"
          tooltip="Among simulated futures that fall short, the median age at which the income first could not be paid in full."
        />
      </div>

      <VolatilityForm />

      <MonteCarloChart
        simulationResult={simulationResult}
        currentAge={personalInfo.currentAge}
        retirementAge={personalInfo.retirementAge}
        isRunning={isSimulating}
        hasError={simulationError}
        hasAccounts={accounts.length > 0}
      />

      {scenarios && (
        <div className="grid gap-6 lg:grid-cols-2">
          <ScenarioComparisonChart
            result={scenarios}
            hasAnyInput={totals.totalBalance > 0 || totals.totalContribution > 0}
            yearsToRetirement={yearsToRetirement}
            inflationRate={retirementGoals.inflationRate}
            displayMode={displayMode}
          />
          <InvestmentScenariosCard
            result={scenarios}
            displayMode={displayMode}
            yearsToRetirement={yearsToRetirement}
            inflationRate={retirementGoals.inflationRate / 100}
          />
        </div>
      )}

      <MonteCarloMethodology
        netReturn={totals.weightedReturn - totals.weightedFees}
        volatility={assumptions.equityVolatility}
        numberOfRuns={NUMBER_OF_RUNS}
      />
    </div>
  )
}
