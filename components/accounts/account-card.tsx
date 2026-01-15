"use client"

import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Account } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters"

interface AccountCardProps {
  account: Account
  onEdit: (account: Account) => void
  onDelete: (id: string) => void
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
            <div className="text-muted-foreground">Balance</div>
            <div className="font-medium">
              {formatCurrency(account.currentBalance)}
            </div>

            <div className="text-muted-foreground">Monthly</div>
            <div className="font-medium">
              {formatCurrency(account.monthlyContribution)}
            </div>

            <div className="text-muted-foreground">Escalation</div>
            <div className="font-medium">
              {formatPercentage(account.contributionEscalation)}
            </div>

            <div className="text-muted-foreground">Return</div>
            <div className="font-medium">
              {formatPercentage(account.expectedReturn)}
            </div>

            <div className="text-muted-foreground">Fees</div>
            <div className="font-medium">
              {formatPercentage(account.annualFees)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
