"use client"

import { PortfolioImpactStrip } from "@/components/accounts/portfolio-impact-strip"
import { Button } from "@/components/ui/button"
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
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { Input } from "@/components/ui/input"
import { NO_AUTOFILL_PROPS } from "@/lib/utils/no-autofill"
import { Label, FIELD_LABEL_CLASS } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SA_DEFAULTS } from "@/lib/constants/defaults"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { MAX_MONETARY_AMOUNT, SA_TAX_LIMITS } from "@/lib/constants/limits"
import { NumberField } from "@/components/ui/number-field"
import type { Account } from "@/types"
import { ACCOUNT_TYPE_LABELS, INVESTMENT_TYPES } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { Controller, useForm, useFormState } from "react-hook-form"
import { z } from "zod"

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
  currentBalance: z
    .number({ error: "Enter a balance" })
    .min(0, "Balance must be positive")
    .max(MAX_MONETARY_AMOUNT, "Enter a realistic balance (R1 trillion or less)"),
  monthlyContribution: z
    .number({ error: "Enter a monthly contribution" })
    .min(0, "Monthly contribution cannot be negative")
    .max(MAX_MONETARY_AMOUNT, "Enter a realistic contribution (R1 trillion or less)"),
  expectedReturn: z
    .number({ error: "Enter an expected return" })
    .min(0, "Expected return must be between 0% and 30%")
    .max(30, "Expected return must be between 0% and 30%"),
  annualFees: z
    .number({ error: "Enter annual fees" })
    .min(0, "Annual fees must be between 0% and 5%")
    .max(5, "Annual fees must be between 0% and 5%"),
  contributionEscalation: z
    .number({ error: "Enter contribution escalation" })
    .min(0, "Escalation must be between 0% and 20%")
    .max(20, "Escalation must be between 0% and 20%"),
  // Optional so an existing untyped account can be edited without choosing one
  investmentType: z.enum(INVESTMENT_TYPES).optional(),
  tfsaContributionsToDate: z
    .number({ error: "Enter contributions to date" })
    .min(0, "Contributions cannot be negative")
    .max(
      SA_TAX_LIMITS.tfsaLifetimeLimit,
      `Max lifetime limit is R${SA_TAX_LIMITS.tfsaLifetimeLimit.toLocaleString()}`,
    )
    .optional(),
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
  // New accounts default to Balanced; an existing untyped account stays untyped until the
  // user chooses (its Monte Carlo behaviour must not change silently)
  investmentType: account ? account.investmentType : "balanced",
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
  const { register, control } = form
  const { errors } = useFormState({ control })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="af-name" className={FIELD_LABEL_CLASS}>
            Account name
          </Label>
          <Input
            id="af-name"
            placeholder="e.g. My RA"
            {...NO_AUTOFILL_PROPS}
            {...register("name")}
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="af-provider" className={FIELD_LABEL_CLASS}>
            Provider
          </Label>
          <Input
            id="af-provider"
            placeholder="e.g. Allan Gray"
            {...NO_AUTOFILL_PROPS}
            {...register("provider")}
          />
          {errors.provider && <p className="text-xs text-destructive">{errors.provider.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="af-type" className={FIELD_LABEL_CLASS}>
          Account type
        </Label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              {/* Radix SelectTrigger is a button — htmlFor association doesn't
                  reach it, so the accessible name must live on the trigger. */}
              <SelectTrigger id="af-type" aria-label="Account type">
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-2">
        <Controller
          name="currentBalance"
          control={control}
          render={({ field }) => (
            <NumberField
              id="af-balance"
              label="Current balance"
              prefix="R"
              width="full"
              group
              min={0}
              step={10_000}
              hardMax={MAX_MONETARY_AMOUNT}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.currentBalance?.message}
            />
          )}
        />
        <Controller
          name="monthlyContribution"
          control={control}
          render={({ field }) => (
            <NumberField
              id="af-monthly"
              label="Monthly contribution"
              prefix="R"
              suffix="/ month"
              width="full"
              group
              min={0}
              step={500}
              hardMax={MAX_MONETARY_AMOUNT}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.monthlyContribution?.message}
            />
          )}
        />
      </div>
    </div>
  )
}

function PerformanceFields({ form }: { form: FormRef }) {
  const { register, watch, control } = form
  const { errors } = useFormState({ control })
  const selectedType = watch("type")
  const investmentType = watch("investmentType")
  const typeRisk = investmentType ? INVESTMENT_TYPE_RISK[investmentType] : null

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Label htmlFor="af-investment-type" className={FIELD_LABEL_CLASS}>
            Invested in
          </Label>
          <InfoTooltip
            content="Sets how much this account's value swings in the Risk page simulation, and how it moves with your other accounts. It does not change the projection."
            side="top"
          />
        </div>
        <Controller
          name="investmentType"
          control={control}
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger id="af-investment-type" aria-label="Invested in">
                <SelectValue placeholder="Choose an investment type" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {INVESTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {INVESTMENT_TYPE_RISK[t].label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
        />
        <p className="text-xs text-muted-foreground">
          {typeRisk
            ? `e.g. ${typeRisk.example}`
            : "Not set: the simulation uses the equity volatility from the Risk page."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-5 sm:grid-cols-3">
        <Controller
          name="expectedReturn"
          control={control}
          render={({ field }) => (
            <NumberField
              id="af-return"
              label="Expected return"
              tooltip="A long-run compound (CAGR) return, as fund factsheets quote it. SA equity: 10–12% | Balanced: 9–10% | Bonds: 8–9% | Cash: 6–7%"
              suffix="%"
              width="full"
              decimals={2}
              stepper
              step={0.5}
              min={0}
              max={30}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.expectedReturn?.message}
            />
          )}
        />
        <Controller
          name="annualFees"
          control={control}
          render={({ field }) => (
            <NumberField
              id="af-fees"
              label="Annual fees"
              tooltip="Index fund: 0.2–0.5% | Active fund: 1–2% | Wrap account: 2–3%"
              suffix="%"
              width="full"
              decimals={2}
              stepper
              step={0.1}
              min={0}
              max={5}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.annualFees?.message}
            />
          )}
        />
        <Controller
          name="contributionEscalation"
          control={control}
          render={({ field }) => (
            <NumberField
              id="af-escalation"
              label="Escalation"
              tooltip="CPI-linked: 5–5.5% recommended. Use 0% if your contribution is a fixed rand amount."
              suffix="%"
              width="full"
              decimals={2}
              stepper
              step={0.5}
              min={0}
              max={20}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.contributionEscalation?.message}
            />
          )}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Use a long-run compound (CAGR) return.
        {typeRisk
          ? ` A typical long-run figure for ${typeRisk.label.toLowerCase()} is ${typeRisk.suggestedReturn}%.`
          : " Pre-filled with SA defaults — adjust if needed."}
      </p>

      {selectedType === "tfsa" && (
        <div className="rounded-md border border-border bg-muted/40 p-3">
          <Controller
            name="tfsaContributionsToDate"
            control={control}
            render={({ field }) => (
              <NumberField
                id="af-tfsa"
                label="Total contributions to date"
                prefix="R"
                width="full"
                group
                min={0}
                step={1_000}
                hardMax={SA_TAX_LIMITS.tfsaLifetimeLimit}
                placeholder="e.g. 180 000"
                value={field.value ?? NaN}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                error={errors.tfsaContributionsToDate?.message}
                hint="Cumulative amount contributed to all TFSAs since 2015 (not current balance). Used to enforce the R500 000 lifetime limit."
              />
            )}
          />
        </div>
      )}
    </div>
  )
}

// ─── Add flow: 2-step wizard ──────────────────────────────────────────────────

function Step1Fields({ form, impactStrip }: { form: FormRef; impactStrip: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <EssentialFields form={form} />
      {impactStrip}
    </div>
  )
}

function Step2Fields({ form, impactStrip }: { form: FormRef; impactStrip: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <PerformanceFields form={form} />
      {impactStrip}
    </div>
  )
}

// ─── Edit form: all fields on one scrollable view ─────────────────────────────

function EditFields({ form, impactStrip }: { form: FormRef; impactStrip: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <EssentialFields form={form} />
      <div className="border-t border-border/50 pt-4">
        <PerformanceFields form={form} />
      </div>
      {impactStrip}
    </div>
  )
}

// ─── Form body (shared between Dialog and Drawer) ─────────────────────────────

interface FormBodyProps {
  account?: Account | null
  onSave: (data: AccountFormData) => void
  onClose: () => void
}

function FormBody({ account, onSave, onClose }: FormBodyProps) {
  const [step, setStep] = useState<1 | 2>(1)
  const isEdit = !!account

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: getDefaultValues(account),
    mode: "onChange", // Validate as user types for immediate feedback
  })

  const { isSubmitting, errors: formErrors } = useFormState({ control: form.control })

  // RHF's watch() array subscription is the documented API; the React Compiler
  // lint flags it as incompatible with memoization (a known false positive).
  // oxlint-disable-next-line react-hooks/incompatible-library
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

  // Awaiting onSubmit keeps isSubmitting true (and the submit trigger disabled)
  // for however long the save takes, so a slow write cannot be double-submitted
  // and the dialog only closes once the save has settled.
  const handleSubmit = form.handleSubmit(async (data) => {
    await onSave(data)
    onClose()
  })

  const handleContinue = async () => {
    const fields = ["name", "provider", "type", "currentBalance", "monthlyContribution"] as const
    const valid = await form.trigger(fields)
    if (valid) {
      setStep(2)
      return
    }
    const firstInvalid = fields.find((field) => form.getFieldState(field).invalid)
    if (firstInvalid) form.setFocus(firstInvalid)
  }

  const fieldErrorCount = Object.keys(formErrors).length

  return (
    <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-5">
      {fieldErrorCount > 0 && (
        <p role="alert" className="text-xs text-destructive">
          Please fix the {fieldErrorCount} highlighted field{fieldErrorCount === 1 ? "" : "s"}{" "}
          below.
        </p>
      )}
      {isEdit ? (
        <>
          <p className="text-base font-semibold leading-none">Edit Account</p>
          <EditFields form={form} impactStrip={impactStrip} />
          <div className="flex justify-between items-center pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Update Account"}
            </Button>
          </div>
        </>
      ) : (
        <>
          <StepHeader step={step} />
          {step === 1 ? (
            <>
              <Step1Fields form={form} impactStrip={impactStrip} />
              <div className="flex justify-between items-center pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                {/* Distinct keys matter: Continue and Add Account sit in the same spot, and if
                    React reused one DOM button and flipped its type to "submit", the click that
                    triggered Continue would go on to submit the form (the async handler's
                    re-render lands before the browser's default action). */}
                <Button key="continue" type="button" onClick={handleContinue}>
                  Continue →
                </Button>
              </div>
            </>
          ) : (
            <>
              <Step2Fields form={form} impactStrip={impactStrip} />
              <div className="flex justify-between items-center pt-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>
                  ← Back
                </Button>
                <Button key="add-account" type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Adding…" : "Add Account"}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </form>
  )
}

// ─── Public component ─────────────────────────────────────────────────────────

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null
  onSave: (data: AccountFormData) => void
}

export function AccountFormDialog({ open, onOpenChange, account, onSave }: AccountFormDialogProps) {
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
            <FormBody account={account} onSave={onSave} onClose={handleClose} />
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
        <FormBody account={account} onSave={onSave} onClose={handleClose} />
      </DialogContent>
    </Dialog>
  )
}
