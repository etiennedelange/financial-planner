"use client"

import { PageCard } from "@/components/ui/page-card"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"
import { Shuffle } from "lucide-react"
import { CAUTIOUS_VOLATILITY_FACTOR } from "@/lib/constants/investment-types"

interface MonteCarloMethodologyProps {
  /** Balance-weighted return net of fees, as a decimal */
  netReturn: number
  /** Equity volatility as a percentage, e.g. 16.5 */
  volatility: number
  numberOfRuns: number
}

const formatPercent = (value: number) => `${value.toFixed(2)}%`

/**
 * How the simulation works, in plain terms plus the return formula. Moved from the
 * Projections calculation breakdown (2026-10-31) so every Monte Carlo explanation sits on
 * the Risk page beside the results it explains.
 */
export function MonteCarloMethodology({
  netReturn,
  volatility,
  numberOfRuns,
}: MonteCarloMethodologyProps) {
  return (
    <PageCard
      label="How the Simulation Works"
      leading={<Shuffle className="h-4 w-4 text-muted-foreground flex-none" />}
      contentClassName="space-y-4"
    >
      <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
        <li>
          Run {numberOfRuns.toLocaleString()} simulated futures, each with random yearly returns
        </li>
        <li>
          Each account&apos;s expected return is treated as its typical (median) yearly return, so
          half the simulated futures do better than your projection and half do worse
        </li>
        <li>
          Each account&apos;s yearly swings come from what it is invested in. Accounts of the same
          type rise and fall together; different types share one market move plus a move of their
          own, so they are only partly correlated
        </li>
        <li>Retirement income is paid monthly, within the living annuity 2.5%–17.5% limits</li>
        <li>
          A future succeeds if it pays your full income every year to life expectancy; success rate
          = successful futures ÷ all futures
        </li>
        <li>
          The same futures are run twice: once at each investment&apos;s long-run volatility, and
          once at {CAUTIOUS_VOLATILITY_FACTOR}× it, roughly how turbulent SA equity&apos;s worst
          decade was. The two success rates are the likely range; the rating follows the lower one
        </li>
      </ol>

      <div className="rounded-lg bg-muted p-4 space-y-1">
        <p className="text-sm font-medium">Log-normal return formula</p>
        <code className="text-sm bg-background px-2 py-1 rounded block">
          logMean = ln(1 + return)
        </code>
        <code className="text-sm bg-background px-2 py-1 rounded block">
          randomReturn = e^(logMean + volatility × Z) − 1
        </code>
        <p className="text-xs text-muted-foreground">
          Z = √ρ × market move + √(1 − ρ) × the type&apos;s own move, both standard normal; ρ is the
          type&apos;s loading on the market (untyped accounts: ρ = 1)
        </p>
      </div>

      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Expected return (net of fees, balance-weighted)</TableCell>
            <TableCell className="text-right font-mono">{formatPercent(netReturn * 100)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Volatility for accounts without a type (std dev)</TableCell>
            <TableCell className="text-right font-mono">{formatPercent(volatility)}</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Number of simulations</TableCell>
            <TableCell className="text-right font-mono">{numberOfRuns.toLocaleString()}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </PageCard>
  )
}
