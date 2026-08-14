"use client"

import { useEffect, useState } from "react"
import { useForm, useFormState, Controller } from "react-hook-form"
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import type { Account, AccountType } from "@/types"
import { ACCOUNT_TYPE_LABELS } from "@/types"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { PortfolioImpactStrip } from "@/components/accounts/portfolio-impact-strip"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { MAX_MONETARY_AMOUNT, SA_TAX_LIMITS } from "@/lib/constants/limits"
import { useBoundedMonetary } from "@/lib/hooks/use-bounded-monetary"

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
  currentBalance: z.number({ error: "Enter a balance" }).min(0, "Balance must be positive").max(MAX_MONETARY_AMOUNT, "Enter a realistic balance (R1 trillion or less)"),
  monthlyContribution: z.number({ error: "Enter a monthly contribution" }).min(0, "Monthly contribution cannot be negative").max(MAX_MONETARY_AMOUNT, "Enter a realistic contribution (R1 trillion or less)"),
  expectedReturn: z.number({ error: "Enter an expected return" }).min(0, "Expected return must be between 0% and 30%").max(30, "Expected return must be between 0% and 30%"),
  annualFees: z.number({ error: "Enter annual fees" }).min(0, "Annual fees must be between 0% and 5%").max(5, "Annual fees must be between 0% and 5%"),
  contributionEscalation: z.number({ error: "Enter contribution escalation" }).min(0, "Escalation must be between 0% and 20%").max(20, "Escalation must be between 0% and 20%"),
  tfsaContributionsToDate: z.number({ error: "Enter contributions to date" }).min(0, "Contributions cannot be negative").max(SA_TAX_LIMITS.tfsaLifetimeLimit, `Max lifetime limit is R${SA_TAX_LIMITS.tfsaLifetimeLimit.toLocaleString()}`).optional(),
})

type AccountFormData = z.infer<typeof accountSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 639px)")
    const update = () => setIsMobile(mql.matches)
    update()
    mql.addEventListener("change", update)
    return () => mql.removeEventListener("change", update)
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
  const { register, control, watch } = form
  const { errors } = useFormState({ control })

  // Physically block monetary input above the cap.
  const { onChange: balanceOnChange, ...balanceRegister } = register("currentBalance", { valueAsNumber: true })
  const guardBalance = useBoundedMonetary(watch("currentBalance") ?? 0)
  const { onChange: contributionOnChange, ...contributionRegister } = register("monthlyContribution", { valueAsNumber: true })
  const guardContribution = useBoundedMonetary(watch("monthlyContribution") ?? 0)

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
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="af-type">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="af-balance">Current Balance (R)</Label>
          <Input
            id="af-balance"
            type="number"
            min="0"
            max={MAX_MONETARY_AMOUNT}
            step="any"
            {...balanceRegister}
            onChange={(e) => guardBalance.onChange(e, balanceOnChange)}
            onBeforeInput={guardBalance.onBeforeInput}
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
            max={MAX_MONETARY_AMOUNT}
            step="any"
            {...contributionRegister}
            onChange={(e) => guardContribution.onChange(e, contributionOnChange)}
            onBeforeInput={guardContribution.onBeforeInput}
          />
        </div>
      </div>
    </div>
  )
}

function PerformanceFields({ form }: { form: FormRef }) {
  const { register, watch, control } = form
  const { errors } = useFormState({ control })
  const selectedType = watch("type")

  // Physically block TFSA contribution input above the lifetime limit.
  const { onChange: tfsaOnChange, ...tfsaRegister } = register("tfsaContributionsToDate", { valueAsNumber: true })
  const guardTfsa = useBoundedMonetary(watch("tfsaContributionsToDate") ?? "", SA_TAX_LIMITS.tfsaLifetimeLimit)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
            {...tfsaRegister}
            onChange={(e) => guardTfsa.onChange(e, tfsaOnChange)}
            onBeforeInput={guardTfsa.onBeforeInput}
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
  impactStrip: React.ReactNode
}

function Step1({ form, onContinue, onCancel, impactStrip }: Step1Props) {
  const { trigger, setFocus } = form

  const handleContinue = async () => {
    const fields = ["name", "provider", "type", "currentBalance", "monthlyContribution"] as const
    const valid = await trigger(fields)
    if (valid) {
      onContinue()
      return
    }
    const firstInvalid = fields.find((field) => form.getFieldState(field).invalid)
    if (firstInvalid) setFocus(firstInvalid)
  }

  return (
    <div className="space-y-4">
      <EssentialFields form={form} />
      {impactStrip}
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
  impactStrip: React.ReactNode
}

function Step2({ form, onBack, impactStrip }: Step2Props) {
  const isSubmitting = form.formState.isSubmitting
  return (
    <div className="space-y-4">
      <PerformanceFields form={form} />
      {impactStrip}
      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          ← Back
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add Account"}
        </Button>
      </div>
    </div>
  )
}

// ─── Edit form: all fields on one scrollable view ─────────────────────────────

function EditForm({
  form,
  onCancel,
  impactStrip,
}: {
  form: FormRef
  onCancel: () => void
  impactStrip: React.ReactNode
}) {
  const isSubmitting = form.formState.isSubmitting
  return (
    <div className="space-y-5">
      <EssentialFields form={form} />
      <div className="border-t border-border/50 pt-4">
        <PerformanceFields form={form} />
      </div>
      {impactStrip}
      <div className="flex justify-between items-center pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Update Account"}
        </Button>
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
    mode: 'onChange', // Validate as user types for immediate feedback
  })

  const [currentBalance, monthlyContribution, expectedReturn, annualFees] = form.watch([
    "currentBalance",
    "monthlyContribution",
    "expectedReturn",
    "annualFees",
  ])

  const impactStrip = (
    <PortfolioImpactStrip
      account={account}
      currentBalance={currentBalance}
      monthlyContribution={monthlyContribution}
      expectedReturn={expectedReturn}
      annualFees={annualFees}
    />
  )

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
    onClose()
  })

  if (isEdit) {
    return (
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-base font-semibold leading-none">Edit Account</p>
        <EditForm form={form} onCancel={onClose} impactStrip={impactStrip} />
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StepHeader step={step} />
      {step === 1 ? (
        <Step1 form={form} onContinue={() => setStep(2)} onCancel={onClose} impactStrip={impactStrip} />
      ) : (
        <Step2 form={form} onBack={() => setStep(1)} impactStrip={impactStrip} />
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
            <DrawerDescription>
              {account
                ? "Edit this account's balance, contributions, and performance assumptions."
                : "Add a new account and its performance assumptions to your portfolio."}
            </DrawerDescription>
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
          <DialogDescription>
            {account
              ? "Edit this account's balance, contributions, and performance assumptions."
              : "Add a new account and its performance assumptions to your portfolio."}
          </DialogDescription>
        </DialogHeader>
        <FormBody account={account} onSubmit={onSubmit} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  )
}
