"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { AnimatePresence } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { AnimatedValue } from "@/components/ui/animated-value"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { formatCurrency } from "@/lib/utils/currency"
import { escalate, percentToRate } from "@/lib/calculations/utils/money-time"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FieldError } from "@/components/ui/field-error"
import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"
import { useBoundedMonetary } from "@/lib/hooks/use-bounded-monetary"

const schema = z.object({
  desiredMonthlyIncome: z.number({ error: "Enter your desired monthly income" }).min(0, "Desired monthly income cannot be negative").max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
  legacyAmount: z.number({ error: "Enter a legacy amount" }).min(0, "Legacy amount cannot be negative").max(MAX_MONETARY_AMOUNT, "Enter a realistic amount (R1 trillion or less)"),
})

type FormData = z.infer<typeof schema>

export function RetirementGoalsForm() {
  const { retirementGoals, setRetirementGoals, personalInfo, inflationRate } =
    useCalculatorStore(
      useShallow(state => ({
        retirementGoals: state.retirementGoals,
        setRetirementGoals: state.setRetirementGoals,
        personalInfo: state.personalInfo,
        inflationRate: state.retirementGoals.inflationRate,
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
    defaultValues: retirementGoals,
    mode: 'onChange', // Validate as user types for immediate feedback
  })

  const watchedValues = watch()

  // Physically block monetary input above the cap — the fields can never hold it.
  const { onChange: desiredIncomeOnChange, ...desiredIncomeRegister } = register("desiredMonthlyIncome", { valueAsNumber: true })
  const guardDesiredIncome = useBoundedMonetary(watchedValues.desiredMonthlyIncome ?? retirementGoals.desiredMonthlyIncome)
  const { onChange: legacyAmountOnChange, ...legacyAmountRegister } = register("legacyAmount", { valueAsNumber: true })
  const guardLegacyAmount = useBoundedMonetary(watchedValues.legacyAmount ?? retirementGoals.legacyAmount)

  useEffect(() => {
    // RHF's watch() subscription is the documented API; the React Compiler lint
    // flags it as incompatible with memoization (a known false positive).
    // eslint-disable-next-line react-hooks/incompatible-library
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
  }, [
    retirementGoals.desiredMonthlyIncome,
    retirementGoals.legacyAmount,
    reset,
    getValues,
  ])

  // Calculate inflation-adjusted income at retirement (uses inflation from Market Assumptions)
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflatedMonthlyIncome = escalate(
    watchedValues.desiredMonthlyIncome,
    yearsToRetirement,
    percentToRate(inflationRate)
  )

  return (
    <PageCard
      label="Retirement Goals"
      description="Your target income in today's purchasing power and estate goal. Both are inflated to your retirement date."
      contentClassName="space-y-4"
    >
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="desiredMonthlyIncome">
              Desired Monthly Income (today&apos;s Rands)
            </Label>
            <InfoTooltip
              content="How much monthly income you want in retirement, in today's money. The calculator automatically inflates this to retirement date. This is your target - the success rate shows the probability of achieving this income goal throughout retirement."
              side="right"
            />
          </div>
          <Input
            id="desiredMonthlyIncome"
            type="number"
            min="0"
            max={MAX_MONETARY_AMOUNT}
            step="any"
            {...desiredIncomeRegister}
            onChange={(e) => guardDesiredIncome.onChange(e, desiredIncomeOnChange)}
            onBeforeInput={guardDesiredIncome.onBeforeInput}
          />
          <FieldError message={errors.desiredMonthlyIncome?.message} />
          <AnimatePresence initial={false}>
            {watchedValues.desiredMonthlyIncome > 0 && (
              <div className="space-y-0.5">
                <p className="text-xs text-muted-foreground">
                  Today: <AnimatedValue value={watchedValues.desiredMonthlyIncome} format={formatCurrency} /> / month
                </p>
                <p className="text-xs text-muted-foreground">
                  At retirement ({yearsToRetirement} yrs): <AnimatedValue value={inflatedMonthlyIncome} format={formatCurrency} /> / month
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="legacyAmount">Legacy Goal (R)</Label>
            <InfoTooltip
              content="Amount you want to leave behind for heirs or charity. This is in today's money and will be added to your target nest egg. Setting this higher increases the required nest egg and may reduce your success rate if current savings/contributions are insufficient."
              side="right"
            />
          </div>
          <Input
            id="legacyAmount"
            type="number"
            min="0"
            max={MAX_MONETARY_AMOUNT}
            step="any"
            {...legacyAmountRegister}
            onChange={(e) => guardLegacyAmount.onChange(e, legacyAmountOnChange)}
            onBeforeInput={guardLegacyAmount.onBeforeInput}
          />
          <AnimatePresence initial={false}>
            {watchedValues.legacyAmount > 0 && (
              <p className="text-xs text-muted-foreground">
                <AnimatedValue value={watchedValues.legacyAmount} format={formatCurrency} /> in today&apos;s Rands
              </p>
            )}
          </AnimatePresence>
        </div>
    </PageCard>
  )
}
