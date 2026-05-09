"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { SA_TAX_LIMITS } from "@/lib/constants/limits"

const schema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(40).max(100),
  lifeExpectancy: z.number().min(60).max(120),
  annualIncome: z.number().min(0),
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
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: personalInfo,
  })

  // Watch all fields and update store on change
  const watchedValues = watch()

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.currentAge !== undefined) {
        setPersonalInfo(value as FormData)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setPersonalInfo])

  const yearsToRetirement = watchedValues.retirementAge - watchedValues.currentAge
  const yearsInRetirement =
    watchedValues.lifeExpectancy - watchedValues.retirementAge

  return (
    <Card>
      <CardHeader>
        <CardTitle>Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
            {errors.currentAge && (
              <p className="text-sm text-destructive">
                {errors.currentAge.message}
              </p>
            )}
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
            {errors.retirementAge && (
              <p className="text-sm text-destructive">
                {errors.retirementAge.message}
              </p>
            )}
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
            {errors.lifeExpectancy && (
              <p className="text-sm text-destructive">
                {errors.lifeExpectancy.message}
              </p>
            )}
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
              step="10000"
              {...register("annualIncome", { valueAsNumber: true })}
            />
          </div>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm">
          <p>
            <span className="font-medium">{yearsToRetirement}</span> years until
            retirement |{" "}
            <span className="font-medium">{yearsInRetirement}</span> years in
            retirement
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
