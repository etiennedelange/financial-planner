"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/formatters"
import type { Account } from "@/types"
import { Plus } from "lucide-react"
import { useState } from "react"
import { AccountCard } from "./account-card"
import { AccountFormDialog } from "./account-form"

export function AccountList() {
  const { accounts, addAccount, updateAccount, removeAccount } =
    useCalculatorStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + acc.currentBalance,
    0
  )
  const totalMonthly = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution,
    0
  )

  const handleAddClick = () => {
    setEditingAccount(null)
    setDialogOpen(true)
  }

  const handleEditClick = (account: Account) => {
    setEditingAccount(account)
    setDialogOpen(true)
  }

  const handleSubmit = (data: Omit<Account, "id">) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data)
    } else {
      const newAccount: Account = {
        ...data,
        id: crypto.randomUUID(),
      }
      addAccount(newAccount)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Retirement Accounts</h2>
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No accounts added yet. Add your first retirement account to get
              started.
            </p>
            <Button className="mt-4" onClick={handleAddClick}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Portfolio Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Balance</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalBalance)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    Monthly Contributions
                  </p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(totalMonthly)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Accounts</p>
                  <p className="text-2xl font-bold">{accounts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                onEdit={handleEditClick}
                onDelete={removeAccount}
              />
            ))}
          </div>
        </>
      )}

      <AccountFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editingAccount}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
