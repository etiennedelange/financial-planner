"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence, motion } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { AnimatedValue } from "@/components/ui/animated-value"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FieldError } from "@/components/ui/field-error"
import { MAX_MONETARY_AMOUNT, SA_TAX_LIMITS } from "@/lib/constants/limits"
import { useBoundedMonetary } from "@/lib/hooks/use-bounded-monetary"
import { formatCurrency } from "@/lib/utils/currency"

const schema = z.object({
  currentAge: z.number({ error: "Enter your current age" }).min(18, "Age must be between 18 and 100").max(100, "Age must be between 18 and 100"),
  retirementAge: z.number({ error: "Enter a retirement age" }).min(40, "Retirement age must be between 40 and 100").max(100, "Retirement age must be between 40 and 100"),
  lifeExpectancy: z.number({ error: "Enter a life expectancy" }).min(60, "Life expectancy must be between 60 and 120").max(120, "Life expectancy must be between 60 and 120"),
  annualIncome: z.number({ error: "Enter your annual income" }).min(0, "Annual income cannot be negative").max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
}).superRefine((data, ctx) => {
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
    useShallow(state => ({
      personalInfo: state.personalInfo,
      setPersonalInfo: state.setPersonalInfo,
    }))
  )

  const {
    register,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: personalInfo,
    mode: 'onChange', // Validate as user types for immediate feedback
  })

  // Watch all fields and update store on change
  const watchedValues = watch()

  // Physically block monetary input above the cap — the field can never hold it.
  const { onChange: annualIncomeOnChange, ...annualIncomeRegister } = register("annualIncome", { valueAsNumber: true })
  const guardAnnualIncome = useBoundedMonetary(watchedValues.annualIncome ?? personalInfo.annualIncome)

  useEffect(() => {
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
  }, [
    personalInfo.currentAge,
    personalInfo.retirementAge,
    personalInfo.lifeExpectancy,
    personalInfo.annualIncome,
    reset,
    getValues,
  ])

  const yearsToRetirement = watchedValues.retirementAge - watchedValues.currentAge
  const yearsInRetirement =
    watchedValues.lifeExpectancy - watchedValues.retirementAge
  const isValidYears = Number.isFinite(yearsToRetirement) && Number.isFinite(yearsInRetirement)

  return (
    <PageCard label="Personal Information" contentClassName="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="currentAge">Current Age</Label>
            <Input
              id="currentAge"
              type="number"
              min="18"
              max="100"
              {...register("currentAge", { valueAsNumber: true })}
            />
            <FieldError message={errors.currentAge?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="retirementAge">Retirement Age</Label>
              <InfoTooltip
                content="The age at which you plan to stop working and start drawing from your retirement savings. This determines how many years you have to save (accumulation phase) and how many years you'll need income (drawdown phase)."
                side="right"
              />
            </div>
            <Input
              id="retirementAge"
              type="number"
              min="40"
              max="100"
              {...register("retirementAge", { valueAsNumber: true })}
            />
            <FieldError message={errors.retirementAge?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="lifeExpectancy">Life Expectancy</Label>
              <InfoTooltip
                content="How long you expect to live. This determines how many years your retirement savings need to last. SA average is ~75 years, but planning for 90-95 provides a safety buffer. Longer life expectancy requires more savings or lower withdrawal rates."
                side="right"
              />
            </div>
            <Input
              id="lifeExpectancy"
              type="number"
              min="60"
              max="120"
              {...register("lifeExpectancy", { valueAsNumber: true })}
            />
            <FieldError message={errors.lifeExpectancy?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="annualIncome">Annual Income (R)</Label>
              <InfoTooltip
                content={`Your current annual gross income before tax. Used to calculate tax deductions for retirement contributions (RAs, Pension Funds). SA allows up to ${(SA_TAX_LIMITS.pensionRaDeductionRate * 100).toFixed(1)}% of income (max R${(SA_TAX_LIMITS.pensionRaMaxDeduction / 1000).toFixed(0)}k/year) as tax-deductible retirement contributions.`}
                side="right"
              />
            </div>
            <Input
              id="annualIncome"
              type="number"
              min="0"
              max={MAX_MONETARY_AMOUNT}
              step="any"
              {...annualIncomeRegister}
              onChange={(e) => guardAnnualIncome.onChange(e, annualIncomeOnChange)}
              onBeforeInput={guardAnnualIncome.onBeforeInput}
            />
            <FieldError message={errors.annualIncome?.message} />
            <AnimatePresence initial={false}>
              {watchedValues.annualIncome > 0 ? (
                <motion.p
                  key="income-display"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xs text-muted-foreground"
                >
                  <AnimatedValue value={watchedValues.annualIncome} format={formatCurrency} /> / year
                </motion.p>
              ) : (
                <motion.p
                  key="income-default"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                  className="text-xs text-muted-foreground"
                >
                  R 0 / year — required for RA tax deduction calculations
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isValidYears && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-md bg-muted p-3 text-sm"
            >
              <p>
                <span className="font-medium"><AnimatedValue value={yearsToRetirement} /></span> years until
                retirement |{" "}
                <span className="font-medium"><AnimatedValue value={yearsInRetirement} /></span> years in
                retirement
              </p>
            </motion.div>
          )}
        </AnimatePresence>
    </PageCard>
  )
}
