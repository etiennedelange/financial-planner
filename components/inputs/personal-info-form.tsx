"use client"

import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion } from "motion/react"
import { NumberField } from "@/components/ui/number-field"
import { SectionLabel } from "@/components/ui/section-label"
import { PageCard } from "@/components/ui/page-card"
import { AnimatedValue } from "@/components/ui/animated-value"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { MAX_MONETARY_AMOUNT, SA_TAX_LIMITS } from "@/lib/constants/limits"
import { formatCurrency } from "@/lib/utils/currency"

const schema = z
  .object({
    currentAge: z
      .number({ error: "Enter your current age" })
      .min(18, "Age must be between 18 and 100")
      .max(100, "Age must be between 18 and 100"),
    retirementAge: z
      .number({ error: "Enter a retirement age" })
      .min(40, "Retirement age must be between 40 and 100")
      .max(100, "Retirement age must be between 40 and 100"),
    lifeExpectancy: z
      .number({ error: "Enter a life expectancy" })
      .min(60, "Life expectancy must be between 60 and 120")
      .max(120, "Life expectancy must be between 60 and 120"),
    annualIncome: z
      .number({ error: "Enter your annual income" })
      .min(0, "Annual income cannot be negative")
      .max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
  })
  .superRefine((data, ctx) => {
    if (data.retirementAge <= data.currentAge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Retirement age must be after current age",
        path: ["retirementAge"],
      })
    }
    if (data.lifeExpectancy <= data.retirementAge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Life expectancy must be after retirement age",
        path: ["lifeExpectancy"],
      })
    }
  })

type FormData = z.infer<typeof schema>

export function PersonalInfoForm() {
  const { personalInfo, setPersonalInfo } = useCalculatorStore(
    useShallow((state) => ({
      personalInfo: state.personalInfo,
      setPersonalInfo: state.setPersonalInfo,
    })),
  )

  const {
    control,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: personalInfo,
    mode: "onChange", // Validate as user types for immediate feedback
  })

  // Watch all fields and update store on change
  const watchedValues = watch()

  useEffect(() => {
    // RHF's watch() subscription is the documented API; the React Compiler lint
    // flags it as incompatible with memoization (a known false positive).
    // oxlint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((value) => {
      // Only propagate valid values to the store — an invalid (e.g. absurdly
      // large) input must never reach the calculations.
      const parsed = schema.safeParse(value)
      if (parsed.success) setPersonalInfo(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, setPersonalInfo])

  // Sync form when store hydrates from localStorage or scenario switches
  useEffect(() => {
    const current = getValues()
    if (
      current.currentAge === personalInfo.currentAge &&
      current.retirementAge === personalInfo.retirementAge &&
      current.lifeExpectancy === personalInfo.lifeExpectancy &&
      current.annualIncome === personalInfo.annualIncome
    ) {
      return
    }
    reset(personalInfo)
  }, [personalInfo, reset, getValues])

  const yearsToRetirement = watchedValues.retirementAge - watchedValues.currentAge
  const yearsInRetirement = watchedValues.lifeExpectancy - watchedValues.retirementAge
  const showTimeline = yearsToRetirement > 0 && yearsInRetirement > 0

  return (
    <PageCard label="Personal Information" contentClassName="space-y-7">
      <div className="space-y-3">
        <SectionLabel>Your timeline</SectionLabel>
        <div className="flex flex-wrap gap-x-4 gap-y-5">
          <Controller
            control={control}
            name="currentAge"
            render={({ field }) => (
              <NumberField
                id="currentAge"
                label="Current age"
                suffix="yrs"
                stepper
                min={18}
                max={100}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                error={errors.currentAge?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="retirementAge"
            render={({ field }) => (
              <NumberField
                id="retirementAge"
                label="Retirement age"
                tooltip="The age at which you plan to stop working and start drawing from your retirement savings. This determines how many years you have to save (accumulation phase) and how many years you'll need income (drawdown phase)."
                suffix="yrs"
                stepper
                min={40}
                max={100}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                error={errors.retirementAge?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="lifeExpectancy"
            render={({ field }) => (
              <NumberField
                id="lifeExpectancy"
                label="Life expectancy"
                tooltip="How long you expect to live. This determines how many years your retirement savings need to last. SA average is ~75 years, but planning for 90-95 provides a safety buffer. Longer life expectancy requires more savings or lower withdrawal rates."
                suffix="yrs"
                stepper
                min={60}
                max={120}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                name={field.name}
                inputRef={field.ref}
                error={errors.lifeExpectancy?.message}
              />
            )}
          />
        </div>

        <AnimatePresence initial={false}>
          {showTimeline && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-2 pt-2"
            >
              <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="bg-primary" style={{ flexGrow: yearsToRetirement }} />
                <div className="bg-primary/40" style={{ flexGrow: yearsInRetirement }} />
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-primary" aria-hidden="true" />
                  <span className="font-medium text-foreground tabular-nums">
                    <AnimatedValue value={yearsToRetirement} />
                  </span>{" "}
                  years until retirement
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px] bg-primary/40" aria-hidden="true" />
                  <span className="font-medium text-foreground tabular-nums">
                    <AnimatedValue value={yearsInRetirement} />
                  </span>{" "}
                  years in retirement
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="space-y-3">
        <SectionLabel>Income</SectionLabel>
        <Controller
          control={control}
          name="annualIncome"
          render={({ field }) => (
            <NumberField
              id="annualIncome"
              label="Annual income"
              tooltip={`Your current annual gross income before tax. Used to calculate tax deductions for retirement contributions (RAs, Pension Funds). SA allows up to ${(SA_TAX_LIMITS.pensionRaDeductionRate * 100).toFixed(1)}% of income (max R${(SA_TAX_LIMITS.pensionRaMaxDeduction / 1000).toFixed(0)}k/year) as tax-deductible retirement contributions.`}
              prefix="R"
              suffix="/ year"
              width="money"
              group
              min={0}
              step={10_000}
              hardMax={MAX_MONETARY_AMOUNT}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.annualIncome?.message}
              hint={
                watchedValues.annualIncome > 0 ? (
                  <>
                    <AnimatedValue
                      value={watchedValues.annualIncome / 12}
                      format={formatCurrency}
                    />{" "}
                    / month before tax
                  </>
                ) : (
                  "Required for RA tax deduction calculations"
                )
              }
            />
          )}
        />
      </div>
    </PageCard>
  )
}
