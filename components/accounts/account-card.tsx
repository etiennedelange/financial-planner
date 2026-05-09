"use client"

import { AlertTriangle, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Account } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { TFSA_LIMITS_CONFIG } from "@/lib/constants/tax-year.config"
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface AccountCardProps {
  account: Account
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
}

function TfsaLimitBadge({ account }: { account: Account }) {
  const contributed = account.tfsaContributionsToDate ?? 0
  const remaining = Math.max(0, TFSA_LIMITS_CONFIG.lifetimeLimit - contributed)
  const annualUsed = (account.monthlyContribution * 12)
  const overAnnual = annualUsed > TFSA_LIMITS_CONFIG.annualLimit
  const lifetimeFull = remaining === 0

  return (
    <div className="mt-2 rounded-md border border-border bg-muted/40 p-2 text-xs space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Lifetime used</span>
        <span className="font-medium">
          {formatCurrency(contributed)} / {formatCurrency(TFSA_LIMITS_CONFIG.lifetimeLimit)}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Lifetime remaining</span>
        <span className={`font-medium ${lifetimeFull ? "text-destructive" : ""}`}>
          {formatCurrency(remaining)}
        </span>
      </div>
      {lifetimeFull && (
        <div className="flex items-center gap-1 text-destructive font-medium">
          <AlertTriangle className="h-3 w-3" />
          Lifetime limit reached — contributions capped in projections
        </div>
      )}
      {!lifetimeFull && overAnnual && (
        <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
          <AlertTriangle className="h-3 w-3" />
          Annual contributions ({formatCurrency(annualUsed)}) exceed R36 000 limit — capped in projections
        </div>
      )}
    </div>
  )
}

export function AccountCard({ account, onEdit, onDelete }: AccountCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg">{account.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{account.provider}</p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(account)}
              aria-label="Edit account"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(account.id)}
              aria-label="Delete account"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="inline-block rounded-md bg-secondary px-2 py-1 text-xs">
            {ACCOUNT_TYPE_LABELS[account.type]}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <div className="text-muted-foreground flex items-center gap-1.5">
              Balance
              <InfoTooltip content="Current account balance. This is your starting amount." side="right" />
            </div>
            <div className="font-medium">
              {formatCurrency(account.currentBalance)}
            </div>

            <div className="text-muted-foreground flex items-center gap-1.5">
              Monthly
              <InfoTooltip content="Monthly contribution to this account. Set to R0 if no longer contributing (e.g., old pension funds)." side="right" />
            </div>
            <div className="font-medium">
              {formatCurrency(account.monthlyContribution)}
            </div>

            <div className="text-muted-foreground flex items-center gap-1.5">
              Escalation
              <InfoTooltip content="Annual % increase in contributions. Typically matches salary increases (5-7%). Set to 0% for fixed contributions or accounts no longer receiving contributions." side="right" />
            </div>
            <div className="font-medium">
              {formatPercentage(account.contributionEscalation)}
            </div>

            <div className="text-muted-foreground flex items-center gap-1.5">
              Return
              <InfoTooltip content="Expected annual return for this account (nominal, before fees). Equity funds: 10-14%, balanced: 8-12%, bonds: 7-9%, cash: 6-8%. This is used to project growth." side="right" />
            </div>
            <div className="font-medium">
              {formatPercentage(account.expectedReturn)}
            </div>

            <div className="text-muted-foreground flex items-center gap-1.5">
              Fees
              <InfoTooltip content="Annual management fees charged by your provider (TER + admin). Typical SA funds: 0.5-1.5% p.a. Fees directly reduce your returns - lower fees mean more growth." side="right" />
            </div>
            <div className="font-medium">
              {formatPercentage(account.annualFees)}
            </div>
          </div>

          {account.type === "tfsa" && <TfsaLimitBadge account={account} />}
        </div>
      </CardContent>
    </Card>
  )
}
