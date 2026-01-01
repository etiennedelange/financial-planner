"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AccountCard } from "./account-card"
import { AccountForm } from "./account-form"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { Account } from "@/types"
import { formatCurrency } from "@/lib/utils/formatters"

export function AccountList() {
  const { accounts, addAccount, updateAccount, removeAccount } =
    useCalculatorStore()
  const [isAdding, setIsAdding] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const totalBalance = accounts.reduce(
    (sum, acc) => sum + acc.currentBalance,
    0
  )
  const totalMonthly = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution,
    0
  )

  const handleAddSubmit = (data: Omit<Account, "id">) => {
    const newAccount: Account = {
      ...data,
      id: crypto.randomUUID(),
    }
    addAccount(newAccount)
    setIsAdding(false)
  }

  const handleEditSubmit = (data: Omit<Account, "id">) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data)
      setEditingAccount(null)
    }
  }

  if (isAdding) {
    return (
      <AccountForm
        onSubmit={handleAddSubmit}
        onCancel={() => setIsAdding(false)}
      />
    )
  }

  if (editingAccount) {
    return (
      <AccountForm
        account={editingAccount}
        onSubmit={handleEditSubmit}
        onCancel={() => setEditingAccount(null)}
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Retirement Accounts</h2>
        <Button onClick={() => setIsAdding(true)}>
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
            <Button className="mt-4" onClick={() => setIsAdding(true)}>
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
                onEdit={setEditingAccount}
                onDelete={removeAccount}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
