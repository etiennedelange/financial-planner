"use client"

import { Card } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import type { OverviewSummary } from "@/lib/calculations/utils/overview-summary"
import { formatCurrency } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import { AlertCircle, AlertTriangle, Check } from "lucide-react"
import Link from "next/link"

interface OverviewVerdictCardProps {
  summary: OverviewSummary
  monthlyIncomeAtRetirement: number
  portfolioAtRetirement: number
  retirementAge: number
  lifeExpectancy: number
  displayMode: "nominal" | "real"
}

/**
 * The Overview hero: one sentence that answers "am I okay?", with the
 * market-risk caveat directly underneath so the steady-return figure is never
 * shown without it. Overview is deterministic only — Monte Carlo results live
 * on the Risk page, so the caveat links there and carries no numbers.
 */
export function OverviewVerdictCard({
  summary,
  monthlyIncomeAtRetirement,
  portfolioAtRetirement,
  retirementAge,
  lifeExpectancy,
  displayMode,
}: OverviewVerdictCardProps) {
  const isReal = displayMode === "real"

  // The headline follows the app's display mode; the secondary line always shows the other basis.
  const income = formatCurrency(isReal ? summary.monthlyIncomeToday : monthlyIncomeAtRetirement)
  const incomeOther = formatCurrency(
    isReal ? monthlyIncomeAtRetirement : summary.monthlyIncomeToday,
  )
  const portfolio = formatCurrency(
    isReal ? summary.portfolioAtRetirementToday : portfolioAtRetirement,
  )
  const portfolioOther = formatCurrency(
    isReal ? portfolioAtRetirement : summary.portfolioAtRetirementToday,
  )
  const otherBasisLabel = isReal ? "at the time you retire" : "in today's money"

  return (
    <Card className="flex flex-wrap overflow-hidden shadow-none">
      <div className="flex min-w-0 flex-[999_1_32rem] flex-col gap-5 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <SectionLabel>Retirement verdict</SectionLabel>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              summary.isOnTrack ? "bg-primary/15 text-primary" : "bg-warning/15 text-warning",
            )}
          >
            {summary.isOnTrack ? (
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {summary.isOnTrack ? "On track" : "At risk"}
          </span>
        </div>

        <h2 className="max-w-2xl text-2xl font-medium leading-tight tracking-tight text-balance sm:text-4xl">
          Your plan pays <span className="font-mono font-semibold text-primary">{income}</span> a
          month from age {retirementAge}
          {summary.isOnTrack
            ? ` to age ${summary.goalIncomeUntilAge}.`
            : summary.yearsOfGoalIncome > 0
              ? `, but falls below your goal from age ${summary.goalIncomeUntilAge}.`
              : " — below your goal income."}
        </h2>

        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          {summary.incomeReplacementPercent !== null && (
            <>That is {summary.incomeReplacementPercent}% of your goal income — </>
          )}
          about <strong className="font-medium text-foreground">{incomeOther}</strong> a month{" "}
          {otherBasisLabel}.
        </p>

        <div className="flex max-w-xl items-start gap-3 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3">
          <AlertCircle
            className="mt-0.5 h-5 w-5 flex-none text-warning"
            role="img"
            aria-label="Not included"
          />
          <div className="flex min-w-0 flex-col">
            <span className="font-medium">Market risk not included</span>
            <span className="text-sm text-muted-foreground">
              These figures assume steady returns. An early crash can change the result.{" "}
              <Link href="/calculator/risk" className="font-medium text-primary hover:underline">
                See the risk view →
              </Link>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-[1_1_18rem] flex-col justify-center gap-1.5 border-t border-border bg-muted/30 p-6 sm:p-8 md:border-t-0 md:border-l">
        <SectionLabel>Portfolio at {retirementAge}</SectionLabel>
        <p className="font-mono text-3xl font-semibold tracking-tight">{portfolio}</p>
        <p className="text-sm text-muted-foreground">
          ≈ <span className="text-foreground">{portfolioOther}</span> {otherBasisLabel}
        </p>

        <div className="my-4 h-px bg-border" />

        <SectionLabel>Goal income until</SectionLabel>
        <p className="font-mono text-2xl font-semibold">Age {summary.goalIncomeUntilAge}</p>
        <p className={cn("text-sm", summary.isOnTrack ? "text-muted-foreground" : "text-warning")}>
          {summary.isOnTrack
            ? `Planning to age ${lifeExpectancy} · steady returns`
            : `Below goal for ${summary.yearsBelowGoal} ${summary.yearsBelowGoal === 1 ? "year" : "years"} before age ${lifeExpectancy}`}
        </p>
      </div>
    </Card>
  )
}
