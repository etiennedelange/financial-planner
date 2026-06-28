"use client"

import { useEffect, useState } from "react"
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
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { Account, AccountType } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"

// ─── Schema ─────────────────────────────────────────────────────────────────

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  useEffect(() => {
    setIsMobile(window.innerWidth < 640)
  }, [])
  return isMobile
}

const getDefaultValues = (account?: Account | null): AccountFormData => ({
  name: account?.name ?? "",
  provider: account?.provider ?? "",
  type: account?.type ?? "retirement_annuity",
  currentBalance: account?.currentBalance ?? 0,
  monthlyContribution: account?.monthlyContribution ?? 0,
  expectedReturn: account?.expectedReturn ?? SA_DEFAULTS.defaultExpectedReturn,
  annualFees: account?.annualFees ?? SA_DEFAULTS.defaultAnnualFees,
  contributionEscalation:
    account?.contributionEscalation ?? SA_DEFAULTS.defaultContributionEscalation,
  tfsaContributionsToDate: account?.tfsaContributionsToDate,
})

// ─── Progress header (add flow only) ─────────────────────────────────────────

function StepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div>
      <p className="text-base font-semibold leading-none">Add Account</p>
      <p className="text-xs text-muted-foreground mt-1">
        Step {step} of 2 — {step === 1 ? "Essentials" : "Performance"}
      </p>
      <div className="mt-3 h-[2px] w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: step === 1 ? "50%" : "100%" }}
        />
      </div>
    </div>
  )
}

// ─── Shared field sections ────────────────────────────────────────────────────

type FormRef = ReturnType<typeof useForm<AccountFormData>>

function EssentialFields({ form }: { form: FormRef }) {
  const { register, setValue, watch, formState: { errors } } = form
  const selectedType = watch("type")

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="af-name">Account Name</Label>
          <Input id="af-name" placeholder="e.g. My RA" {...register("name")} />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="af-provider">Provider</Label>
          <Input id="af-provider" placeholder="e.g. Allan Gray" {...register("provider")} />
          {errors.provider && (
            <p className="text-xs text-destructive">{errors.provider.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="af-type">Account Type</Label>
        <Select
          value={selectedType}
          onValueChange={(v) => setValue("type", v as AccountType)}
        >
          <SelectTrigger id="af-type">
            <SelectValue placeholder="Select account type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="af-balance">Current Balance (R)</Label>
          <Input
            id="af-balance"
            type="number"
            min="0"
            step="1000"
            {...register("currentBalance", { valueAsNumber: true })}
          />
          {errors.currentBalance && (
            <p className="text-xs text-destructive">{errors.currentBalance.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="af-monthly">Monthly Contribution (R)</Label>
          <Input
            id="af-monthly"
            type="number"
            min="0"
            step="100"
            {...register("monthlyContribution", { valueAsNumber: true })}
          />
        </div>
      </div>
    </div>
  )
}

function PerformanceFields({ form }: { form: FormRef }) {
  const { register, watch, formState: { errors } } = form
  const selectedType = watch("type")

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="af-return">Expected Return (%)</Label>
            <InfoTooltip
              content="SA equity: 10–12% | Balanced: 7–10% | Bonds: 8–9% | Cash: 7–8%"
              side="top"
            />
          </div>
          <Input
            id="af-return"
            type="number"
            min="0"
            max="30"
            step="0.5"
            {...register("expectedReturn", { valueAsNumber: true })}
          />
          {errors.expectedReturn && (
            <p className="text-xs text-destructive">{errors.expectedReturn.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="af-fees">Annual Fees (%)</Label>
            <InfoTooltip
              content="Index fund: 0.2–0.5% | Active fund: 1–2% | Wrap account: 2–3%"
              side="top"
            />
          </div>
          <Input
            id="af-fees"
            type="number"
            min="0"
            max="5"
            step="0.1"
            {...register("annualFees", { valueAsNumber: true })}
          />
          {errors.annualFees && (
            <p className="text-xs text-destructive">{errors.annualFees.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="af-escalation">Escalation (%)</Label>
            <InfoTooltip
              content="CPI-linked: 5–5.5% recommended. Use 0% if your contribution is a fixed rand amount."
              side="top"
            />
          </div>
          <Input
            id="af-escalation"
            type="number"
            min="0"
            max="20"
            step="0.5"
            {...register("contributionEscalation", { valueAsNumber: true })}
          />
          {errors.contributionEscalation && (
            <p className="text-xs text-destructive">{errors.contributionEscalation.message}</p>
          )}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Pre-filled with SA defaults — adjust if needed.
      </p>

      {selectedType === "tfsa" && (
        <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
          <Label htmlFor="af-tfsa">Total contributions to date (R)</Label>
          <Input
            id="af-tfsa"
            type="number"
            min="0"
            max={SA_TAX_LIMITS.tfsaLifetimeLimit}
            step="1000"
            placeholder="e.g. 180000"
            {...register("tfsaContributionsToDate", { valueAsNumber: true })}
          />
          <p className="text-xs text-muted-foreground">
            Cumulative amount contributed to all TFSAs since 2015 (not current balance). Used to enforce the R500 000 lifetime limit.
          </p>
          {errors.tfsaContributionsToDate && (
            <p className="text-xs text-destructive">{errors.tfsaContributionsToDate.message}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Add flow: 2-step wizard ──────────────────────────────────────────────────

interface Step1Props {
  form: FormRef
  onContinue: () => void
  onCancel: () => void
}

function Step1({ form, onContinue, onCancel }: Step1Props) {
  const { trigger } = form

  const handleContinue = async () => {
    const valid = await trigger(["name", "provider", "type", "currentBalance", "monthlyContribution"])
    if (valid) onContinue()
  }

  return (
    <div className="space-y-4">
      <EssentialFields form={form} />
      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" onClick={handleContinue}>
          Continue →
        </Button>
      </div>
    </div>
  )
}

interface Step2Props {
  form: FormRef
  onBack: () => void
}

function Step2({ form, onBack }: Step2Props) {
  return (
    <div className="space-y-4">
      <PerformanceFields form={form} />
      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit">Add Account</Button>
      </div>
    </div>
  )
}

// ─── Edit form: all fields on one scrollable view ─────────────────────────────

function EditForm({ form, onCancel }: { form: FormRef; onCancel: () => void }) {
  return (
    <div className="space-y-5">
      <EssentialFields form={form} />
      <div className="border-t border-border/50 pt-4">
        <PerformanceFields form={form} />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Update Account</Button>
      </div>
    </div>
  )
}

// ─── Form body (shared between Dialog and Drawer) ─────────────────────────────

interface FormBodyProps {
  account?: Account | null
  onSubmit: (data: AccountFormData) => void
  onClose: () => void
}

function FormBody({ account, onSubmit, onClose }: FormBodyProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const isEdit = !!account

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaultValues(account),
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
    onClose()
  })

  if (isEdit) {
    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-base font-semibold leading-none">Edit Account</p>
        <EditForm form={form} onCancel={onClose} />
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StepHeader step={step} />
      {step === 1 ? (
        <Step1 form={form} onContinue={() => setStep(2)} onCancel={onClose} />
      ) : (
        <Step2 form={form} onBack={() => setStep(1)} />
      )}
    </form>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  onSubmit: (data: AccountFormData) => void
}

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  onSubmit,
}: AccountFormDialogProps) {
  const isMobile = useIsMobile()

  const handleClose = () => onOpenChange(false)

  if (isMobile === null) return null

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>{account ? "Edit Account" : "Add Account"}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6 pt-2 overflow-y-auto">
            <FormBody account={account} onSubmit={onSubmit} onClose={handleClose} />
          </div>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>{account ? "Edit Account" : "Add Account"}</DialogTitle>
        </DialogHeader>
        <FormBody account={account} onSubmit={onSubmit} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  )
}
