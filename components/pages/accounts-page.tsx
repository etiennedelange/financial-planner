"use client"

import { AccountCard } from "@/components/accounts/account-card"
import { AccountSheet } from "@/components/accounts/account-sheet"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import type { Account } from "@/types"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useShallow } from "zustand/react/shallow"

export function AccountsPage() {
  const { accounts, addAccount, updateAccount, removeAccount } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      addAccount: state.addAccount,
      updateAccount: state.updateAccount,
      removeAccount: state.removeAccount,
    }))
  )

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const totalMonthly = accounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)

  const handleAddClick = () => {
    setEditingAccount(null)
    setSheetOpen(true)
  }

  const handleEditClick = (account: Account) => {
    setEditingAccount(account)
    setSheetOpen(true)
  }

  const handleSubmit = (data: Omit<Account, "id">) => {
    if (editingAccount) {
      updateAccount(editingAccount.id, data)
    } else {
      addAccount({ ...data, id: crypto.randomUUID() })
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Retirement Accounts</h2>
        <Button onClick={handleAddClick}>
          <Plus className="mr-2 h-4 w-4" />
          Add Account
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-4">
            <p className="text-muted-foreground">
              No accounts added yet. Add your first retirement account to get started.
            </p>
            <Button onClick={handleAddClick}>
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
                  <p className="text-2xl font-bold">{formatCurrency(totalBalance)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Monthly Contributions</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalMonthly)}</p>
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

      <AccountSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        account={editingAccount}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
