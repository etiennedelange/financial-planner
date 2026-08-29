"use client"

import { Button } from "@/components/ui/button"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { Loader2, Wallet } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import type { SimulationResult } from "@/types"

/**
 * The verdict checkmark: its stroke draws itself in when the Monte Carlo
 * result lands — the one authored moment in the tool. Under reduced motion
 * the draw is instant (duration 0), keeping the markup identical for SSR.
 */
function VerdictCheck() {
  const reduceMotion = useReducedMotion()

  return (
    <motion.svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 flex-none text-chart-2"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      initial="hidden"
      animate="visible"
    >
      <motion.circle
        cx="12"
        cy="12"
        r="10"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: reduceMotion ? 0 : 0.25, ease: [0.16, 1, 0.3, 1] } },
        }}
      />
      <motion.path
        d="m9 12 2 2 4-4"
        variants={{
          hidden: { pathLength: 0 },
          visible: { pathLength: 1, transition: { duration: reduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1], delay: reduceMotion ? 0 : 0.2 } },
        }}
      />
    </motion.svg>
  )
}

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
  const reduceMotion = useReducedMotion()

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center justify-between gap-4 rounded-md border border-border/50 px-4 py-2.5"
    >
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <VerdictCheck />
        Monte Carlo: {simulationResult.runs.length.toLocaleString()} scenarios ·{" "}
        {simulationResult.successRate.toFixed(0)}% success
        {displayMode === "real" ? " · shown in today's value" : ""}
      </p>
      <Button asChild size="sm" variant="ghost" className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground">
        <Link href="/calculator/charts">View charts →</Link>
      </Button>
    </motion.div>
  )
}
