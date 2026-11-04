"use client"

import { Card } from "@/components/ui/card"
import { SectionLabel } from "@/components/ui/section-label"
import {
  ON_TRACK_SUCCESS_RATE,
  type OverviewSummary,
} from "@/lib/calculations/utils/overview-summary"
import { formatCurrency } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"
import type { SimulationResult } from "@/types"
import { AlertCircle, AlertTriangle, Check, CheckCircle2, Loader2 } from "lucide-react"
import Link from "next/link"

interface OverviewVerdictCardProps {
  summary: OverviewSummary
  monthlyIncomeAtRetirement: number
  portfolioAtRetirement: number
  retirementAge: number
  lifeExpectancy: number
  displayMode: "nominal" | "real"
  simulationResult: SimulationResult | null
  isSimulating: boolean
}

/**
 * The Overview hero: one sentence that answers "am I okay?", with the
 * market-risk check directly underneath so the steady-return figure is never
 * shown without its caveat.
 */
export function OverviewVerdictCard({
  summary,
  monthlyIncomeAtRetirement,
  portfolioAtRetirement,
  retirementAge,
  lifeExpectancy,
  displayMode,
  simulationResult,
  isSimulating,
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
          {summary.lastsToLifeExpectancy
            ? ` to age ${summary.incomeEndAge}.`
            : `, but runs out at age ${summary.incomeEndAge}.`}
        </h2>

        <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
          {summary.incomeReplacementPercent !== null && (
            <>That is {summary.incomeReplacementPercent}% of your goal income — </>
          )}
          about <strong className="font-medium text-foreground">{incomeOther}</strong> a month{" "}
          {otherBasisLabel}.
        </p>

        <MarketRiskCheck
          simulationResult={simulationResult}
          isSimulating={isSimulating}
          lifeExpectancy={lifeExpectancy}
        />
      </div>

      <div className="flex min-w-0 flex-[1_1_18rem] flex-col justify-center gap-1.5 border-t border-border bg-muted/30 p-6 sm:p-8 md:border-t-0 md:border-l">
        <SectionLabel>Portfolio at {retirementAge}</SectionLabel>
        <p className="font-mono text-3xl font-semibold tracking-tight">{portfolio}</p>
        <p className="text-sm text-muted-foreground">
          ≈ <span className="text-foreground">{portfolioOther}</span> {otherBasisLabel}
        </p>

        <div className="my-4 h-px bg-border" />

        <SectionLabel>Income lasts until</SectionLabel>
        <p className="font-mono text-2xl font-semibold">Age {summary.incomeEndAge}</p>
        <p
          className={cn(
            "text-sm",
            summary.lastsToLifeExpectancy ? "text-muted-foreground" : "text-warning",
          )}
        >
          {summary.lastsToLifeExpectancy
            ? `Planning to age ${lifeExpectancy} · steady returns`
            : `${summary.shortfallYears} ${summary.shortfallYears === 1 ? "year" : "years"} short of age ${lifeExpectancy}`}
        </p>
      </div>
    </Card>
  )
}

interface MarketRiskCheckProps {
  simulationResult: SimulationResult | null
  isSimulating: boolean
  lifeExpectancy: number
}

function MarketRiskCheck({ simulationResult, isSimulating, lifeExpectancy }: MarketRiskCheckProps) {
  if (isSimulating) {
    return (
      <RiskRow
        tone="muted"
        icon={<Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        title="Checking market risk…"
        detail="Running 1,000 market scenarios with random returns."
      />
    )
  }

  if (!simulationResult) {
    return (
      <RiskRow
        tone="warning"
        icon={<AlertCircle className="h-5 w-5" role="img" aria-label="Not yet checked" />}
        title="Market risk not included"
        detail="An early crash can change the result."
        link={{ href: "/calculator/charts", label: "Run the risk view →" }}
      />
    )
  }

  const successRate = simulationResult.successRate
  const runs = simulationResult.runs.length.toLocaleString("en-ZA")
  const holds = successRate >= ON_TRACK_SUCCESS_RATE

  return holds ? (
    <RiskRow
      tone="success"
      icon={<CheckCircle2 className="h-5 w-5" role="img" aria-label="Pass" />}
      title={`Lasts to age ${lifeExpectancy} in ${successRate.toFixed(0)}% of market scenarios`}
      detail={`Tested against ${runs} runs with random returns.`}
      link={{ href: "/calculator/charts", label: "See the risk view →" }}
    />
  ) : (
    <RiskRow
      tone="warning"
      icon={<AlertTriangle className="h-5 w-5" role="img" aria-label="Warning" />}
      title={`Runs short in ${(100 - successRate).toFixed(0)}% of market scenarios`}
      detail={`Steady returns hide this: ${runs} runs with random returns found the shortfall.`}
      link={{ href: "/calculator/charts", label: "See the risk view →" }}
    />
  )
}

interface RiskRowProps {
  tone: "success" | "warning" | "muted"
  icon: React.ReactNode
  title: string
  detail: string
  link?: { href: string; label: string }
}

function RiskRow({ tone, icon, title, detail, link }: RiskRowProps) {
  return (
    <div
      className={cn(
        "flex max-w-xl items-start gap-3 rounded-lg border px-4 py-3",
        tone === "warning" && "border-warning/40 bg-warning/5",
        tone === "success" && "border-primary/30 bg-primary/5",
        tone === "muted" && "border-border",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex-none",
          tone === "warning" && "text-warning",
          tone === "success" && "text-primary",
          tone === "muted" && "text-muted-foreground",
        )}
      >
        {icon}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">
          {detail}{" "}
          {link && (
            <Link href={link.href} className="font-medium text-primary hover:underline">
              {link.label}
            </Link>
          )}
        </span>
      </div>
    </div>
  )
}
