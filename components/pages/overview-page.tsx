"use client"

import { GettingStarted } from "@/components/dashboard/getting-started"
import { NextBestStepCard } from "@/components/dashboard/next-best-step-card"
import { OverviewTodayStats } from "@/components/dashboard/overview-today-stats"
import { OverviewVerdictCard } from "@/components/dashboard/overview-verdict-card"
import { PlanNarrativeCard } from "@/components/dashboard/plan-narrative-card"
import { RetirementTimeline } from "@/components/dashboard/retirement-timeline"
import { calculateOverviewSummary } from "@/lib/calculations/utils/overview-summary"
import type { ProjectionResult } from "@/types"
import { useMemo } from "react"

interface OverviewPageProps {
  projection: ProjectionResult | null
  displayMode: "nominal" | "real"
  retirementAge: number
  currentAge: number
  lifeExpectancy: number
  inflationRate: number
  totalCurrentBalance: number
  totalMonthlyContributions: number
  desiredMonthlyIncome: number
  annualIncome: number
  accountCount: number
}

/**
 * Overview — verdict first. One sentence answers "am I okay?", the market-risk
 * caveat sits directly under it, then the timeline, today's figures and the
 * next action. Deterministic only: Monte Carlo results live on the Risk page.
 */
export function OverviewPage({
  projection,
  displayMode,
  retirementAge,
  currentAge,
  lifeExpectancy,
  inflationRate,
  totalCurrentBalance,
  totalMonthlyContributions,
  desiredMonthlyIncome,
  annualIncome,
  accountCount,
}: OverviewPageProps) {
  const summary = useMemo(
    () =>
      projection
        ? calculateOverviewSummary({
            projection,
            currentAge,
            retirementAge,
            lifeExpectancy,
            annualIncome,
            desiredMonthlyIncome,
            inflationRate,
          })
        : null,
    [
      projection,
      currentAge,
      retirementAge,
      lifeExpectancy,
      annualIncome,
      desiredMonthlyIncome,
      inflationRate,
    ],
  )

  if (accountCount === 0 || !projection || !summary) {
    return <GettingStarted />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <OverviewVerdictCard
        summary={summary}
        monthlyIncomeAtRetirement={projection.monthlyIncomeAtRetirement}
        portfolioAtRetirement={projection.portfolioAtRetirement}
        retirementAge={retirementAge}
        lifeExpectancy={lifeExpectancy}
        displayMode={displayMode}
      />

      <RetirementTimeline
        summary={summary}
        currentAge={currentAge}
        retirementAge={retirementAge}
        lifeExpectancy={lifeExpectancy}
      />

      <OverviewTodayStats
        totalCurrentBalance={totalCurrentBalance}
        totalMonthlyContributions={totalMonthlyContributions}
        accountCount={accountCount}
        yearsToRetirement={summary.yearsToRetirement}
        currentAge={currentAge}
        retirementAge={retirementAge}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <NextBestStepCard maxMonthlyRaContribution={summary.maxMonthlyRaContribution} />
        <PlanNarrativeCard />
      </div>
    </div>
  )
}
