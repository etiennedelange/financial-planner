"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { formatCurrency } from "@/lib/utils/currency"
import { InfoTooltip } from "@/components/ui/info-tooltip"

const schema = z.object({
  desiredMonthlyIncome: z.number().min(0),
  legacyAmount: z.number().min(0),
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
  })

  const watchedValues = watch()

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.desiredMonthlyIncome !== undefined) {
        setRetirementGoals(value as FormData)
      }
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
  const inflatedMonthlyIncome =
    watchedValues.desiredMonthlyIncome *
    Math.pow(1 + inflationRate / 100, yearsToRetirement)

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
            step="1000"
            {...register("desiredMonthlyIncome", { valueAsNumber: true })}
          />
          {errors.desiredMonthlyIncome && (
            <p className="text-sm text-destructive">
              {errors.desiredMonthlyIncome.message}
            </p>
          )}
          {watchedValues.desiredMonthlyIncome > 0 && (
            <div className="space-y-0.5">
              <p className="text-xs text-muted-foreground">
                Today: {formatCurrency(watchedValues.desiredMonthlyIncome)} / month
              </p>
              <p className="text-xs text-muted-foreground">
                At retirement ({yearsToRetirement} yrs): {formatCurrency(inflatedMonthlyIncome)} / month
              </p>
            </div>
          )}
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
            step="100000"
            {...register("legacyAmount", { valueAsNumber: true })}
          />
          {watchedValues.legacyAmount > 0 && (
            <p className="text-xs text-muted-foreground">
              {formatCurrency(watchedValues.legacyAmount)} in today&apos;s Rands
            </p>
          )}
        </div>
    </PageCard>
  )
}
