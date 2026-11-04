"use client"

import { useState } from "react"
import { ChevronDown, CloudLightning } from "lucide-react"
import { PageCard } from "@/components/ui/page-card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { formatCurrency } from "@/lib/utils/currency"
import type { StressOutcome, StressTestResult } from "@/lib/calculations/stress-test"

interface StressTestCardProps {
  result: StressTestResult
  displayMode: "nominal" | "real"
}

const pct = (decimal: number) => `${(decimal * 100).toFixed(1)}%`

function lastsTo(outcome: StressOutcome, lifeExpectancy: number): string {
  return outcome.incomeGoalShortfallAge === null
    ? `lasts to ${lifeExpectancy}`
    : `falls short from age ${outcome.incomeGoalShortfallAge}`
}

/**
 * Historical stress test: the same plan with steady returns versus a 2008-style fall in
 * the first year of retirement. Deterministic, from calculateStressTest; the figures used
 * per account come from the investment-type research (lib/constants/investment-types.ts).
 */
export function StressTestCard({ result, displayMode }: StressTestCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const { steady, stressed, retirementAge, lifeExpectancy, shocks } = result
  const money = (o: StressOutcome) =>
    formatCurrency(displayMode === "real" ? o.finalBalanceToday : o.finalBalance)
  const share = (o: StressOutcome) =>
    o.lowestIncomeShareOfGoal === null ? "—" : `${Math.round(o.lowestIncomeShareOfGoal * 100)}%`
  const hasGoal = stressed.lowestIncomeShareOfGoal !== null
  const worse =
    (stressed.incomeGoalShortfallAge ?? Infinity) < (steady.incomeGoalShortfallAge ?? Infinity)

  const rows: { label: string; steady: string; stressed: string }[] = [
    {
      label: "Your goal income",
      steady: hasGoal ? lastsTo(steady, lifeExpectancy) : "—",
      stressed: hasGoal ? lastsTo(stressed, lifeExpectancy) : "—",
    },
    {
      label: `Money left at ${lifeExpectancy}${displayMode === "real" ? " (today's value)" : ""}`,
      steady: money(steady),
      stressed: money(stressed),
    },
    {
      label: "Worst year's income, share of goal",
      steady: share(steady),
      stressed: share(stressed),
    },
  ]

  return (
    <PageCard
      label="Historical Stress Test"
      leading={<CloudLightning className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      trailing={
        <InfoTooltip
          content="Each investment loses what its type lost in its worst 12 months on record (for SA funds, the year to February 2009) in your first year of retirement, then earns its expected return again. Fees still apply. Steady returns, no other randomness."
          side="left"
        />
      }
      contentClassName="space-y-4"
    >
      <p className={`text-sm ${worse ? "text-warning" : "text-foreground"}`}>
        {hasGoal ? (
          <>
            In a 2008-style fall at {retirementAge}, your goal income{" "}
            {lastsTo(stressed, lifeExpectancy)}
            {worse || stressed.incomeGoalShortfallAge !== null
              ? ` (with steady returns it ${lastsTo(steady, lifeExpectancy)}).`
              : ", the same as with steady returns."}
          </>
        ) : (
          <>
            In a 2008-style fall at {retirementAge}, you would have {money(stressed)} left at{" "}
            {lifeExpectancy}, against {money(steady)} with steady returns.
          </>
        )}
      </p>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead className="text-right">Steady returns</TableHead>
              <TableHead className="text-right">2008-style first year</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.label}>
                <TableCell className="text-muted-foreground">{r.label}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.steady}</TableCell>
                <TableCell className="text-right font-mono tabular-nums">{r.stressed}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-muted-foreground"
          onClick={() => setShowDetail((v) => !v)}
          aria-expanded={showDetail}
        >
          <ChevronDown
            data-icon="inline-start"
            className={`h-3.5 w-3.5 transition-transform ${showDetail ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          Falls used for each account
        </Button>
        {showDetail && (
          <div className="mt-2 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Fall</TableHead>
                  <TableHead className="hidden sm:table-cell">Basis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shocks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">
                      No accounts to stress. Add an account to see how a 2008-style fall affects it.
                    </TableCell>
                  </TableRow>
                )}
                {shocks.map((s) => (
                  <TableRow key={s.accountId}>
                    <TableCell>
                      {s.accountName}
                      <span className="block text-xs text-muted-foreground">
                        {s.investmentType
                          ? INVESTMENT_TYPE_RISK[s.investmentType].label
                          : "No investment type"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {s.marketReturn === null ? "none" : pct(s.marketReturn)}
                      {s.understated && "*"}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                      {s.period}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-2 text-xs text-muted-foreground">
              Rand figures from fund factsheets and index data, verified 4 November 2026; sources
              are listed in the Market Volatility table above. *Calendar-year figure, which
              understates a 12-month fall. Fees are taken on top of each fall.
            </p>
          </div>
        )}
      </div>
    </PageCard>
  )
}
