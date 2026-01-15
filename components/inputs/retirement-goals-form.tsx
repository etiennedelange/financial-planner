"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/formatters"
import { InfoTooltip } from "@/components/ui/info-tooltip"

const schema = z.object({
  desiredMonthlyIncome: z.number().min(0),
  inflationRate: z.number().min(0).max(20),
  legacyAmount: z.number().min(0),
})

type FormData = z.infer<typeof schema>

export function RetirementGoalsForm() {
  const { retirementGoals, setRetirementGoals, personalInfo } =
    useCalculatorStore()

  const {
    register,
    watch,
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

  // Calculate inflation-adjusted income at retirement
  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge
  const inflatedMonthlyIncome =
    watchedValues.desiredMonthlyIncome *
    Math.pow(1 + watchedValues.inflationRate / 100, yearsToRetirement)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Retirement Goals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-xs text-muted-foreground">
            At retirement ({yearsToRetirement} years), this equals{" "}
            {formatCurrency(inflatedMonthlyIncome)} per month
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="inflationRate">Expected Inflation (%)</Label>
              <InfoTooltip
                content="Expected annual inflation rate. Used to adjust your income needs and savings targets over time. SA historical average: 5-6%. Higher inflation means you need more money in the future to buy the same goods. Your withdrawals are automatically inflated each year to maintain purchasing power."
                side="right"
              />
            </div>
            <Input
              id="inflationRate"
              type="number"
              min="0"
              max="20"
              step="0.5"
              {...register("inflationRate", { valueAsNumber: true })}
            />
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
            <p className="text-xs text-muted-foreground">
              Amount to leave behind
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
