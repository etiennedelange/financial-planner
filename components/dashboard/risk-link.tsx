"use client"

import { Button } from "@/components/ui/button"
import { Activity } from "lucide-react"
import Link from "next/link"

/**
 * One quiet line pointing to the Risk page. Overview shows only the deterministic
 * projection; market-risk results (Monte Carlo) deliberately live on the Risk page alone,
 * so this line carries no numbers. Replaced the Monte Carlo run-status strip (2026-10-31).
 */
export function RiskLink({ hasAccounts }: { hasAccounts: boolean }) {
  if (!hasAccounts) return null

  return (
    <div className="flex items-center justify-between gap-4 rounded-md border border-border/50 px-4 py-2.5">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
        These figures assume steady returns and leave out market risk. A crash early in retirement
        can change the outcome.
      </p>
      <Button
        asChild
        size="sm"
        variant="ghost"
        className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <Link href="/calculator/risk">View risk →</Link>
      </Button>
    </div>
  )
}
