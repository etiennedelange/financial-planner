"use client"

import { Card } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils/currency"
import Link from "next/link"
import type { ReactNode } from "react"

interface OverviewTodayStatsProps {
  totalCurrentBalance: number
  totalMonthlyContributions: number
  accountCount: number
  yearsToRetirement: number
  currentAge: number
  retirementAge: number
}

/** Where the plan stands today — three plain figures, no icons or tooltips. */
export function OverviewTodayStats({
  totalCurrentBalance,
  totalMonthlyContributions,
  accountCount,
  yearsToRetirement,
  currentAge,
  retirementAge,
}: OverviewTodayStatsProps) {
  return (
    <section aria-label="Where you are today" className="grid gap-4 sm:grid-cols-3">
      <Stat
        label="Saved today"
        value={formatCurrency(totalCurrentBalance)}
        detail={
          <>
            Across {accountCount} {accountCount === 1 ? "account" : "accounts"} ·{" "}
            <Link href="/calculator/accounts" className="font-medium text-primary hover:underline">
              View
            </Link>
          </>
        }
      />
      <Stat
        label="Contributing"
        value={
          <>
            {formatCurrency(totalMonthlyContributions)}
            <span className="text-sm font-normal text-muted-foreground"> /month</span>
          </>
        }
        detail="Total across all accounts"
      />
      <Stat
        label="Time to retirement"
        value={yearsToRetirement === 1 ? "1 year" : `${yearsToRetirement} years`}
        detail={`Retiring at ${retirementAge} · now ${currentAge}`}
      />
    </section>
  )
}

function Stat({ label, value, detail }: { label: string; value: ReactNode; detail: ReactNode }) {
  return (
    <Card className="flex flex-col gap-1 px-5 py-4 shadow-none">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-xl font-semibold sm:text-2xl">{value}</span>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </Card>
  )
}
