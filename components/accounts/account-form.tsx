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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import type { Account, AccountType } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { SA_DEFAULTS } from "@/lib/constants/defaults"

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
})

type AccountFormData = z.infer<typeof accountSchema>

interface AccountFormDialogProps {
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
})

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
}: AccountFormDialogProps) {
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

  // Reset form when account changes or dialog opens
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Account" : "Add New Account"}
          </DialogTitle>
          <DialogDescription>
            {account
              ? "Update your retirement account details."
              : "Add a new retirement account to track."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                placeholder="e.g., My RA"
                {...register("name")}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="provider">Provider</Label>
              <Input
                id="provider"
                placeholder="e.g., Allan Gray"
                {...register("provider")}
              />
              {errors.provider && (
                <p className="text-sm text-destructive">
                  {errors.provider.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Account Type</Label>
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="currentBalance">Current Balance (R)</Label>
              <Input
                id="currentBalance"
                type="number"
                min="0"
                step="1000"
                {...register("currentBalance", { valueAsNumber: true })}
              />
              {errors.currentBalance && (
                <p className="text-sm text-destructive">
                  {errors.currentBalance.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyContribution">
                Monthly Contribution (R)
              </Label>
              <Input
                id="monthlyContribution"
                type="number"
                min="0"
                step="100"
                {...register("monthlyContribution", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="expectedReturn">Expected Return (%)</Label>
              <Input
                id="expectedReturn"
                type="number"
                min="0"
                max="30"
                step="0.5"
                {...register("expectedReturn", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="annualFees">Annual Fees (%)</Label>
              <Input
                id="annualFees"
                type="number"
                min="0"
                max="5"
                step="0.1"
                {...register("annualFees", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contributionEscalation">Escalation (%)</Label>
              <Input
                id="contributionEscalation"
                type="number"
                min="0"
                max="20"
                step="0.5"
                {...register("contributionEscalation", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">{account ? "Update" : "Add"} Account</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
