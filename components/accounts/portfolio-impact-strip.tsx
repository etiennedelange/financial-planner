"use client"

import { ArrowDown, ArrowUp } from "lucide-react"
import { SpringNumber } from "@/components/ui/spring-number"
import { formatCurrency } from "@/lib/utils/currency"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { Account } from "@/types"

interface PortfolioImpactStripProps {
  /** The account being edited, or null/undefined when adding a new one. */
  account?: Account | null
  currentBalance: number
  monthlyContribution: number
  expectedReturn: number
  annualFees: number
}

function safe(n: number): number {
  return Number.isFinite(n) ? n : 0
}

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`
}

/**
 * Live preview of how the values being typed in the account form ripple through
 * the whole portfolio — total balance, weighted net return, monthly contribution.
 * Recomputed on every render against the store's other accounts, so it always
 * reflects "if I save this right now."
 */
export function PortfolioImpactStrip({
  account,
  currentBalance,
  monthlyContribution,
  expectedReturn,
  annualFees,
}: PortfolioImpactStripProps) {
  const accounts = useCalculatorStore((state) => state.accounts)
  const others = account ? accounts.filter((a) => a.id !== account.id) : accounts

  const othersBalance = others.reduce((s, a) => s + a.currentBalance, 0)
  const othersMonthly = others.reduce((s, a) => s + a.monthlyContribution, 0)
  const othersReturnWeighted = others.reduce(
    (s, a) => s + a.currentBalance * (a.expectedReturn - a.annualFees),
    0
  )

  const formBalance = safe(currentBalance)
  const formMonthly = safe(monthlyContribution)
  const formNet = safe(expectedReturn) - safe(annualFees)

  const baselineBalance = othersBalance + (account?.currentBalance ?? 0)
  const baselineMonthly = othersMonthly + (account?.monthlyContribution ?? 0)
  const baselineReturnWeighted =
    othersReturnWeighted +
    (account ? account.currentBalance * (account.expectedReturn - account.annualFees) : 0)
  const baselineNetReturn = baselineBalance > 0 ? baselineReturnWeighted / baselineBalance : 0

  const newBalance = othersBalance + formBalance
  const newMonthly = othersMonthly + formMonthly
  const newReturnWeighted = othersReturnWeighted + formBalance * formNet
  const newNetReturn = newBalance > 0 ? newReturnWeighted / newBalance : 0

  const rows: Array<{
    label: string
    baseline: number
    value: number
    format: (v: number) => string
  }> = [
    { label: "Total balance", baseline: baselineBalance, value: newBalance, format: formatCurrency },
    { label: "Net return", baseline: baselineNetReturn, value: newNetReturn, format: formatPercent },
    { label: "Monthly total", baseline: baselineMonthly, value: newMonthly, format: formatCurrency },
  ]

  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2.5 space-y-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Portfolio impact
      </p>
      <div className="space-y-1">
        {rows.map((row) => {
          const delta = row.value - row.baseline
          // Compare formatted strings, not raw deltas — a raw diff can be
          // "insignificant" yet still cross a display-rounding boundary
          // (e.g. 8.95% -> 8.92% renders as "9.0%" -> "8.9%").
          const changed = row.format(row.value) !== row.format(row.baseline)

          return (
            <div key={row.label} className="flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">{row.label}</span>
              {changed ? (
                <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums font-medium text-foreground">
                  {delta > 0 ? (
                    <ArrowUp className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
                  ) : (
                    <ArrowDown className="h-2.5 w-2.5 text-muted-foreground" aria-hidden />
                  )}
                  <SpringNumber value={row.value} format={row.format} />
                </span>
              ) : (
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {row.format(row.value)}{" "}
                  <span className="text-muted-foreground/70">(unchanged)</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
