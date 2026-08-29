"use client"

import { Button } from "@/components/ui/button"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { CheckCircle2, Loader2, Wallet } from "lucide-react"
import Link from "next/link"
import type { SimulationResult } from "@/types"

interface SimulationRunStatusProps {
  simulationResult: SimulationResult | null
  isSimulating: boolean
  hasAccounts: boolean
}

/**
 * The quiet proof that the simulation ran. Not a chart, not a headline — a single
 * muted line under the metrics grid. All heavy visualizations live on the Charts page.
 */
export function SimulationRunStatus({
  simulationResult,
  isSimulating,
  hasAccounts,
}: SimulationRunStatusProps) {
  const displayMode = useCalculatorStore((s) => s.displayMode)

  if (!hasAccounts) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border/50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Wallet className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Add accounts to run the Monte Carlo simulation and unlock the Charts page.
        </p>
        <Button asChild size="sm" variant="outline" className="h-7 shrink-0 px-2.5 text-xs">
          <Link href="/calculator/accounts">Add accounts</Link>
        </Button>
      </div>
    )
  }

  if (isSimulating || !simulationResult) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border/50 px-4 py-2.5">
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 flex-none animate-spin" aria-hidden="true" />
          {isSimulating ? "Running 1,000 Monte Carlo scenarios…" : "Preparing simulation…"}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/50 px-4 py-2.5">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 flex-none text-chart-2" aria-hidden="true" />
        Monte Carlo: {simulationResult.runs.length.toLocaleString()} scenarios ·{" "}
        {simulationResult.successRate.toFixed(0)}% success
        {displayMode === "real" ? " · shown in today's value" : ""}
      </p>
      <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground">
        <Link href="/calculator/charts">View charts →</Link>
      </Button>
    </div>
  )
}
