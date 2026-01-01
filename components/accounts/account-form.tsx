"use client"

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

interface AccountFormProps {
  account?: Account
  onSubmit: (data: AccountFormData) => void
  onCancel: () => void
}

export function AccountForm({ account, onSubmit, onCancel }: AccountFormProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: account || {
      name: "",
      provider: "",
      type: "retirement_annuity",
      currentBalance: 0,
      monthlyContribution: 0,
      expectedReturn: SA_DEFAULTS.defaultExpectedReturn,
      annualFees: SA_DEFAULTS.defaultAnnualFees,
      contributionEscalation: SA_DEFAULTS.defaultContributionEscalation,
    },
  })

  const selectedType = watch("type")

  return (
    <Card>
      <CardHeader>
        <CardTitle>{account ? "Edit Account" : "Add New Account"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-3 gap-4">
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
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">{account ? "Update" : "Add"} Account</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
