"use client"

import { useEffect } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { NumberField } from "@/components/ui/number-field"
import { PageCard } from "@/components/ui/page-card"
import { AnimatedValue } from "@/components/ui/animated-value"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { formatCurrency } from "@/lib/utils/currency"
import { escalate, percentToRate } from "@/lib/calculations/utils/money-time"
import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"

const schema = z.object({
  desiredMonthlyIncome: z
    .number({ error: "Enter your desired monthly income" })
    .min(0, "Desired monthly income cannot be negative")
    .max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
  legacyAmount: z
    .number({ error: "Enter a legacy amount" })
    .min(0, "Legacy amount cannot be negative")
    .max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
})

type FormData = z.infer<typeof schema>

export function RetirementGoalsForm() {
  const { retirementGoals, setRetirementGoals, personalInfo, inflationRate } = useCalculatorStore(
    useShallow((state) => ({
      retirementGoals: state.retirementGoals,
      setRetirementGoals: state.setRetirementGoals,
      personalInfo: state.personalInfo,
      inflationRate: state.retirementGoals.inflationRate,
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
    defaultValues: retirementGoals,
    mode: "onChange", // Validate as user types for immediate feedback
  })

  const watchedValues = watch()

  useEffect(() => {
    // RHF's watch() subscription is the documented API; the React Compiler lint
    // flags it as incompatible with memoization (a known false positive).
    // oxlint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((value) => {
      // Only propagate valid values to the store — an invalid (e.g. absurdly
      // large) input must never reach the calculations.
      const parsed = schema.safeParse(value)
      if (parsed.success) setRetirementGoals(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, setRetirementGoals])

  useEffect(() => {
    const current = getValues()
    if (
      current.desiredMonthlyIncome === retirementGoals.desiredMonthlyIncome &&
      current.legacyAmount === retirementGoals.legacyAmount
    ) {
      return
    }

    reset({
      desiredMonthlyIncome: retirementGoals.desiredMonthlyIncome,
      legacyAmount: retirementGoals.legacyAmount,
    })
  }, [retirementGoals.desiredMonthlyIncome, retirementGoals.legacyAmount, reset, getValues])

  // Calculate inflation-adjusted income at retirement (uses inflation from Market Assumptions)
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflatedMonthlyIncome = escalate(
    watchedValues.desiredMonthlyIncome,
    yearsToRetirement,
    percentToRate(inflationRate),
  )

  return (
    <PageCard
      label="Retirement Goals"
      description="Your target income in today's purchasing power and estate goal. Both are inflated to your retirement date."
      contentClassName="space-y-4"
    >
      <div className="flex flex-wrap gap-x-4 gap-y-5">
        <Controller
          control={control}
          name="desiredMonthlyIncome"
          render={({ field }) => (
            <NumberField
              id="desiredMonthlyIncome"
              label="Desired monthly income"
              tooltip="How much monthly income you want in retirement, in today's money and before tax. The calculator automatically inflates this to retirement date and shows the after-tax amount in the results. This is your target - the success rate shows the probability of achieving this income goal throughout retirement."
              prefix="R"
              suffix="/ month"
              width="money"
              group
              min={0}
              step={1_000}
              hardMax={MAX_MONETARY_AMOUNT}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.desiredMonthlyIncome?.message}
              hint={
                watchedValues.desiredMonthlyIncome > 0 ? (
                  <>
                    At retirement ({yearsToRetirement} yrs):{" "}
                    <AnimatedValue value={inflatedMonthlyIncome} format={formatCurrency} /> / month
                  </>
                ) : undefined
              }
            />
          )}
        />
        <Controller
          control={control}
          name="legacyAmount"
          render={({ field }) => (
            <NumberField
              id="legacyAmount"
              label="Legacy goal"
              tooltip="Amount you want to leave behind for heirs or charity. This is in today's money and will be added to your target nest egg. Setting this higher increases the required nest egg and may reduce your success rate if current savings/contributions are insufficient."
              prefix="R"
              width="money"
              group
              min={0}
              step={50_000}
              hardMax={MAX_MONETARY_AMOUNT}
              value={field.value}
              onValueChange={field.onChange}
              onBlur={field.onBlur}
              name={field.name}
              inputRef={field.ref}
              error={errors.legacyAmount?.message}
              hint="In today's Rands"
            />
          )}
        />
      </div>
    </PageCard>
  )
}
