"use client"

import { useEffect, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, useReducedMotion } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { SectionLabel } from "@/components/ui/section-label"
import { Button } from "@/components/ui/button"
import { RotateCcw } from "lucide-react"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import { useShallow } from "zustand/react/shallow"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { cn } from "@/lib/utils"
import { COMPOUNDING_METHOD_DESCRIPTIONS, COMPOUNDING_METHOD_LABELS } from "@/types"
import type { CompoundingMethod } from "@/types"

const schema = z.object({
  equityReturn: z.number({ error: "Enter an equity return" }).min(0, "Equity return must be between 0% and 30%").max(30, "Equity return must be between 0% and 30%"),
  bondReturn: z.number({ error: "Enter a bond return" }).min(0, "Bond return must be between 0% and 20%").max(20, "Bond return must be between 0% and 20%"),
  cashReturn: z.number({ error: "Enter a cash return" }).min(0, "Cash return must be between 0% and 15%").max(15, "Cash return must be between 0% and 15%"),
  equityVolatility: z.number({ error: "Enter equity volatility" }).min(0, "Equity volatility must be between 0% and 40%").max(40, "Equity volatility must be between 0% and 40%"),
  bondVolatility: z.number({ error: "Enter bond volatility" }).min(0, "Bond volatility must be between 0% and 20%").max(20, "Bond volatility must be between 0% and 20%"),
  inflationRate: z.number({ error: "Enter an inflation rate" }).min(0, "Inflation rate must be between 0% and 20%").max(20, "Inflation rate must be between 0% and 20%"),
})

type FormData = z.infer<typeof schema>

export function AssumptionsForm() {
  const { assumptions, setAssumptions, retirementGoals, setRetirementGoals } =
    useCalculatorStore(
      useShallow(state => ({
        assumptions: state.assumptions,
        setAssumptions: state.setAssumptions,
        retirementGoals: state.retirementGoals,
        setRetirementGoals: state.setRetirementGoals,
      }))
    )

  const {
    register,
    watch,
    reset,
    getValues,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      equityReturn: assumptions.equityReturn,
      bondReturn: assumptions.bondReturn,
      cashReturn: assumptions.cashReturn,
      equityVolatility: assumptions.equityVolatility,
      bondVolatility: assumptions.bondVolatility,
      inflationRate: retirementGoals.inflationRate,
    },
    mode: 'onChange', // Validate as user types for immediate feedback
  })

  const saDefaults = {
    equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
    bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
    cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
    equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility,
    bondVolatility: SA_DEFAULTS_DISPLAY.bondVolatility,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
  }

  const shouldReduceMotion = useReducedMotion()
  const [resetSpins, setResetSpins] = useState(0)

  const handleReset = useCallback(() => {
    reset(saDefaults)
    setAssumptions({ compoundingMethod: "nominal" })
    setResetSpins((n) => n + 1)
  }, [reset, setAssumptions]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.equityReturn !== undefined) {
        const { inflationRate, ...assumptionFields } = value as FormData
        setAssumptions({ ...assumptionFields, inflationRate })
        setRetirementGoals({ inflationRate })
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setAssumptions, setRetirementGoals])

  // Sync form when store hydrates from localStorage or scenario switches
  useEffect(() => {
    const current = getValues()
    if (
      current.equityReturn === assumptions.equityReturn &&
      current.bondReturn === assumptions.bondReturn &&
      current.cashReturn === assumptions.cashReturn &&
      current.equityVolatility === assumptions.equityVolatility &&
      current.bondVolatility === assumptions.bondVolatility &&
      current.inflationRate === retirementGoals.inflationRate
    ) {
      return
    }
    reset({
      equityReturn: assumptions.equityReturn,
      bondReturn: assumptions.bondReturn,
      cashReturn: assumptions.cashReturn,
      equityVolatility: assumptions.equityVolatility,
      bondVolatility: assumptions.bondVolatility,
      inflationRate: retirementGoals.inflationRate,
    })
  }, [
    assumptions.equityReturn,
    assumptions.bondReturn,
    assumptions.cashReturn,
    assumptions.equityVolatility,
    assumptions.bondVolatility,
    retirementGoals.inflationRate,
    reset,
    getValues,
  ])

  const resetButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReset}
      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <motion.span
        className="inline-flex"
        animate={{ rotate: resetSpins * -360 }}
        transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <RotateCcw className="h-3 w-3" />
      </motion.span>
      SA defaults
    </Button>
  )

  return (
    <PageCard
      label="Market Assumptions"
      description="Reference values for asset class returns and inflation. Each account uses its own expected return setting. Volatility is used in Monte Carlo simulations."
      trailing={resetButton}
      contentClassName="space-y-6"
    >
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SectionLabel>Expected Returns (Nominal)</SectionLabel>
            <InfoTooltip
              content="These are reference values for different asset classes. Each account uses its own expected return rate. Nominal returns include inflation - a 10% nominal return with 5% inflation gives ~5% real growth."
              side="right"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="equityReturn">Equity (%)</Label>
              <Input
                id="equityReturn"
                type="number"
                min="0"
                max="30"
                step="0.5"
                {...register("equityReturn", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bondReturn">Bonds (%)</Label>
              <Input
                id="bondReturn"
                type="number"
                min="0"
                max="20"
                step="0.5"
                {...register("bondReturn", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashReturn">Cash (%)</Label>
              <Input
                id="cashReturn"
                type="number"
                min="0"
                max="15"
                step="0.5"
                {...register("cashReturn", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <SectionLabel>Volatility (Std Dev)</SectionLabel>
            <InfoTooltip
              content="Volatility measures how much returns vary from year to year. Higher volatility means more uncertainty. In Monte Carlo simulations, higher volatility reduces the probability of success because of sequence-of-returns risk. Typical SA equity volatility: 15-18%."
              side="right"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="equityVolatility">Equity (%)</Label>
              <Input
                id="equityVolatility"
                type="number"
                min="0"
                max="40"
                step="0.5"
                {...register("equityVolatility", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bondVolatility">Bonds (%)</Label>
              <Input
                id="bondVolatility"
                type="number"
                min="0"
                max="20"
                step="0.5"
                {...register("bondVolatility", { valueAsNumber: true })}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center gap-2">
            <SectionLabel>Return Calculation Method</SectionLabel>
            <InfoTooltip
              content="Controls how annual returns are converted to monthly returns for projections. Compound is actuarially precise; nominal matches Excel-style monthly division."
              side="right"
            />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["nominal", "compound"] as CompoundingMethod[]).map((method) => {
              const active = assumptions.compoundingMethod === method
              return (
                <button
                  key={method}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setAssumptions({ compoundingMethod: method })}
                  className={cn(
                    "relative isolate flex h-auto min-h-16 flex-col items-start justify-start gap-1 overflow-hidden rounded-md border border-transparent px-3 py-3 text-left text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="compounding-method-active"
                      className="absolute inset-0 -z-10 bg-primary"
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { type: "spring", stiffness: 500, damping: 38 }
                      }
                    />
                  )}
                  <span className="relative z-10 block text-sm font-medium">
                    {COMPOUNDING_METHOD_LABELS[method]}
                  </span>
                  <span className="relative z-10 block text-xs font-normal leading-5 opacity-80">
                    {COMPOUNDING_METHOD_DESCRIPTIONS[method]}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-2 border-t border-border">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="inflationRate">Expected Inflation (%)</Label>
              <InfoTooltip
                content="Expected annual CPI inflation rate. Used to project your income needs at retirement and to adjust withdrawals each year to preserve purchasing power. SA historical average: 5–6%. This rate affects how much you'll need in nominal terms at retirement."
                side="right"
              />
            </div>
            <div className="flex items-center gap-3">
              <Input
                id="inflationRate"
                type="number"
                min="0"
                max="20"
                step="0.5"
                className="max-w-[120px]"
                {...register("inflationRate", { valueAsNumber: true })}
              />
              <p className="text-xs text-muted-foreground">SA historical average: 5–6%</p>
            </div>
          </div>
        </div>
    </PageCard>
  )
}
