"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useCalculatorStore } from "@/lib/store/calculator-store"

const schema = z.object({
  currentAge: z.number().min(18).max(100),
  retirementAge: z.number().min(40).max(100),
  lifeExpectancy: z.number().min(60).max(120),
  annualIncome: z.number().min(0),
})

type FormData = z.infer<typeof schema>

export function PersonalInfoForm() {
  const { personalInfo, setPersonalInfo } = useCalculatorStore()

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
        <div className="grid grid-cols-2 gap-4">
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
            <Label htmlFor="retirementAge">Retirement Age</Label>
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

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lifeExpectancy">Life Expectancy</Label>
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
            <Label htmlFor="annualIncome">Annual Income (R)</Label>
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
