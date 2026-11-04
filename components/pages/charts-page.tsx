"use client"

import { useMemo } from "react"
import { useShallow } from "zustand/react/shallow"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { PortfolioGrowthChart } from "@/components/charts/portfolio-growth-chart"
import { IncomeSustainabilityChart } from "@/components/charts/income-sustainability-chart"
import { SensitivityTornadoChart } from "@/components/charts/sensitivity-tornado-chart"
import { CostOfDelayChart } from "@/components/charts/cost-of-delay-chart"
import { Button } from "@/components/ui/button"
import { computePortfolioTotals } from "@/lib/calculations/utils/portfolio-totals"
import { PageCard } from "@/components/ui/page-card"
import { Wallet } from "lucide-react"
import Link from "next/link"

export function ChartsPage() {
  const { projection } = useCalculator()

  const { displayMode, accounts, personalInfo, retirementGoals, drawdownConfig, assumptions } =
    useCalculatorStore(
      useShallow((s) => ({
        displayMode: s.displayMode,
        accounts: s.accounts,
        personalInfo: s.personalInfo,
        retirementGoals: s.retirementGoals,
        drawdownConfig: s.drawdownConfig,
        assumptions: s.assumptions,
      })),
    )

  const totals = useMemo(() => computePortfolioTotals(accounts), [accounts])

  if (accounts.length === 0) {
    return (
      <PageCard label="Charts" className="dashboard-card">
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-center">
          <Wallet className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground max-w-sm">
            Add your retirement accounts first — every chart here is built from your actual
            portfolio, goals, and assumptions.
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
        Your plan as projected with steady returns. For how market ups and downs could change it,
        see{" "}
        <Link href="/calculator/risk" className="text-foreground underline underline-offset-2">
          Risk
        </Link>
        .
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
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
          displayMode={displayMode}
          inflationRate={retirementGoals.inflationRate / 100}
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
