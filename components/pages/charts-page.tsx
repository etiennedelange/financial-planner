"use client"

import { useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import { MonteCarloChart } from "@/components/charts/monte-carlo-chart"
import { IncomeSustainabilityChart } from "@/components/charts/income-sustainability-chart"
import { SensitivityTornadoChart } from "@/components/charts/sensitivity-tornado-chart"
import { ScenarioComparisonChart } from "@/components/charts/scenario-comparison-chart"
import { CostOfDelayChart } from "@/components/charts/cost-of-delay-chart"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { buildPlanVerdict, type PlanVerdictTone } from "@/lib/utils/plan-verdict"
import { Wallet } from "lucide-react"
import Link from "next/link"

const verdictToneStyles: Record<PlanVerdictTone, { text: string; icon: string }> = {
  neutral: { text: "text-muted-foreground", icon: "text-muted-foreground" },
  success: { text: "text-chart-2", icon: "text-chart-2" },
  good: { text: "text-chart-4", icon: "text-chart-4" },
  warning: { text: "text-warning", icon: "text-warning" },
  danger: { text: "text-destructive", icon: "text-destructive" },
}

export function ChartsPage() {
  const { projection, simulationResult, isSimulating, simulationError } = useCalculator()

  const {
    displayMode,
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    assumptions,
  } = useCalculatorStore(
    useShallow((s) => ({
      displayMode: s.displayMode,
      accounts: s.accounts,
      personalInfo: s.personalInfo,
      retirementGoals: s.retirementGoals,
      drawdownConfig: s.drawdownConfig,
      assumptions: s.assumptions,
    }))
  )

  const totals = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
    const totalContribution = accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
    const weightedReturn =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) => sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : 0.1
    const weightedFees =
      totalBalance > 0
        ? accounts.reduce(
            (sum, acc) => sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
            0
          )
        : 0.01
    const avgEscalation =
      accounts.length > 0
        ? accounts.reduce((sum, acc) => sum + acc.contributionEscalation / 100, 0) /
          accounts.length
        : 0.06
    return { totalBalance, totalContribution, weightedReturn, weightedFees, avgEscalation }
  }, [accounts])

  const verdict = useMemo(
    () =>
      buildPlanVerdict({
        successRate: simulationResult?.successRate ?? null,
        depletionAge: projection?.portfolioDepletionAge ?? null,
      }),
    [simulationResult, projection]
  )

  if (accounts.length === 0) {
    return (
      <PageCard label="Charts" className="dashboard-card">
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your retirement accounts first — every chart here is built from your actual portfolio,
            goals, and assumptions.
          </p>
          <Button asChild size="sm" variant="outline">
            <Link href="/calculator/accounts">Add accounts →</Link>
          </Button>
        </div>
      </PageCard>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground max-w-prose">
        Every visualization your plan can produce. Review each one, then jump
        back to Overview or Projections to act on what you see.
      </p>

      <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <span className={`font-mono text-lg font-semibold tabular-nums ${verdictToneStyles[verdict.tone].text}`}>
          {verdict.tone === "neutral" ? "—" : "◆"}
        </span>
        <p className={`text-sm font-medium ${verdictToneStyles[verdict.tone].text}`}>
          {verdict.headline}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <MonteCarloChart
          simulationResult={simulationResult}
          currentAge={personalInfo.currentAge}
          retirementAge={personalInfo.retirementAge}
          isRunning={isSimulating}
          hasError={simulationError}
          hasAccounts={accounts.length > 0}
        />
        {projection && (
          <IncomeSustainabilityChart
            projection={projection}
            desiredMonthlyIncome={retirementGoals.desiredMonthlyIncome}
            currentAge={personalInfo.currentAge}
            retirementAge={personalInfo.retirementAge}
            inflationRate={retirementGoals.inflationRate}
            displayMode={displayMode}
          />
        )}
        <PortfolioGrowthChart
          projections={projection?.yearlyProjections || []}
          retirementAge={personalInfo.retirementAge}
        />
        <CostOfDelayChart
          currentSavings={totals.totalBalance}
          monthlyContribution={totals.totalContribution}
          personalInfo={personalInfo}
          retirementGoals={retirementGoals}
          expectedReturn={totals.weightedReturn}
          fees={totals.weightedFees}
          contributionEscalation={totals.avgEscalation}
          compoundingMethod={assumptions.compoundingMethod}
        />
        <ScenarioComparisonChart
          currentSavings={totals.totalBalance}
          monthlyContribution={totals.totalContribution}
          personalInfo={personalInfo}
          retirementGoals={retirementGoals}
          drawdownConfig={drawdownConfig}
          contributionEscalation={totals.avgEscalation}
          fees={totals.weightedFees}
          compoundingMethod={assumptions.compoundingMethod}
          displayMode={displayMode}
        />
        <SensitivityTornadoChart
          accounts={accounts}
          personalInfo={personalInfo}
          retirementGoals={retirementGoals}
          drawdownConfig={drawdownConfig}
          assumptions={assumptions}
        />
      </div>
    </div>
  )
}
