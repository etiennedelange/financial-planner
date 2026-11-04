"use client"

import { PageCard } from "@/components/ui/page-card"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"
import { formatCurrency } from "@/lib/utils/currency"
import Link from "next/link"

interface NextBestStepCardProps {
  maxMonthlyRaContribution: number
}

/** Turns the RA deduction limit into one concrete action. Hidden without an income to base it on. */
export function NextBestStepCard({ maxMonthlyRaContribution }: NextBestStepCardProps) {
  if (maxMonthlyRaContribution <= 0) return null

  const ratePercent = Math.round(SA_TAX_LIMITS.pensionRaDeductionRate * 1000) / 10

  return (
    <PageCard label="Next best step" contentClassName="space-y-3">
      <p className="text-lg font-medium">
        You can put up to{" "}
        <span className="font-mono text-primary">{formatCurrency(maxMonthlyRaContribution)}</span> a
        month into retirement funds and deduct it from tax.
      </p>
      <p className="text-sm text-muted-foreground">
        Pension, provident and RA contributions are deductible up to {ratePercent}% of your income,
        capped at {formatCurrency(SA_TAX_LIMITS.pensionRaMaxDeduction)} a year.
      </p>
      <Link
        href="/calculator/accounts"
        className="inline-flex min-h-11 items-center font-medium text-primary hover:underline"
      >
        Adjust contributions →
      </Link>
    </PageCard>
  )
}
