"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import type { Account, AccountType } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"

const accountSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  provider: z.string().min(1, "Provider is required"),
  type: z.enum([
    "pension_fund",
    "retirement_annuity",
    "preservation_fund",
    "tfsa",
    "discretionary",
  ]),
  currentBalance: z.number().min(0, "Balance must be positive"),
  monthlyContribution: z.number().min(0),
  expectedReturn: z.number().min(0).max(30),
  annualFees: z.number().min(0).max(5),
  contributionEscalation: z.number().min(0).max(20),
  tfsaContributionsToDate: z.number().min(0).max(SA_TAX_LIMITS.tfsaLifetimeLimit).optional(),
})

type AccountFormData = z.infer<typeof accountSchema>

interface AccountSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  onSubmit: (data: AccountFormData) => void
}

const getDefaultValues = (account?: Account | null): AccountFormData => ({
  name: account?.name || "",
  provider: account?.provider || "",
  type: account?.type || "retirement_annuity",
  currentBalance: account?.currentBalance || 0,
  monthlyContribution: account?.monthlyContribution || 0,
  expectedReturn: account?.expectedReturn ?? SA_DEFAULTS.defaultExpectedReturn,
  annualFees: account?.annualFees ?? SA_DEFAULTS.defaultAnnualFees,
  contributionEscalation:
    account?.contributionEscalation ?? SA_DEFAULTS.defaultContributionEscalation,
  tfsaContributionsToDate: account?.tfsaContributionsToDate,
})

export function AccountSheet({
  open,
  onOpenChange,
  account,
  onSubmit,
}: AccountSheetProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaultValues(account),
  })

  useEffect(() => {
    if (open) {
      reset(getDefaultValues(account))
    }
  }, [open, account, reset])

  const selectedType = watch("type")

  const handleFormSubmit = (data: AccountFormData) => {
    onSubmit(data)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] sm:w-[440px] flex flex-col p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle>{account ? "Edit Account" : "Add Account"}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sheet-name">Account Name</Label>
                <Input
                  id="sheet-name"
                  placeholder="e.g., My RA"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-provider">Provider</Label>
                <Input
                  id="sheet-provider"
                  placeholder="e.g., Allan Gray"
                  {...register("provider")}
                />
                {errors.provider && (
                  <p className="text-sm text-destructive">{errors.provider.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sheet-type">Account Type</Label>
              <Select
                value={selectedType}
                onValueChange={(value) => setValue("type", value as AccountType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sheet-balance">Current Balance (R)</Label>
                <Input
                  id="sheet-balance"
                  type="number"
                  min="0"
                  step="1000"
                  {...register("currentBalance", { valueAsNumber: true })}
                />
                {errors.currentBalance && (
                  <p className="text-sm text-destructive">{errors.currentBalance.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-monthly">Monthly Contribution (R)</Label>
                <Input
                  id="sheet-monthly"
                  type="number"
                  min="0"
                  step="100"
                  {...register("monthlyContribution", { valueAsNumber: true })}
                />
              </div>
            </div>

            {selectedType === "tfsa" && (
              <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
                <Label htmlFor="sheet-tfsa">Total contributions to date (R)</Label>
                <Input
                  id="sheet-tfsa"
                  type="number"
                  min="0"
                  max={SA_TAX_LIMITS.tfsaLifetimeLimit}
                  step="1000"
                  placeholder="e.g. 180000"
                  {...register("tfsaContributionsToDate", { valueAsNumber: true })}
                />
                <p className="text-xs text-muted-foreground">
                  Cumulative amount <em>contributed</em> to all TFSAs since 2015 (not current balance — growth doesn&apos;t count). Used to enforce the R500 000 lifetime limit.
                </p>
                {errors.tfsaContributionsToDate && (
                  <p className="text-sm text-destructive">{errors.tfsaContributionsToDate.message}</p>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sheet-return">Expected Return (%)</Label>
                <Input
                  id="sheet-return"
                  type="number"
                  min="0"
                  max="30"
                  step="0.5"
                  {...register("expectedReturn", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-fees">Annual Fees (%)</Label>
                <Input
                  id="sheet-fees"
                  type="number"
                  min="0"
                  max="5"
                  step="0.1"
                  {...register("annualFees", { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sheet-escalation">Escalation (%)</Label>
                <Input
                  id="sheet-escalation"
                  type="number"
                  min="0"
                  max="20"
                  step="0.5"
                  {...register("contributionEscalation", { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>

          <SheetFooter className="px-6 py-4 border-t gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{account ? "Update" : "Add"} Account</Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
