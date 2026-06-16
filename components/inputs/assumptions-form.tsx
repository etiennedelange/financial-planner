"use client"

import { useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
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
import { COMPOUNDING_METHOD_DESCRIPTIONS, COMPOUNDING_METHOD_LABELS } from "@/types"
import type { CompoundingMethod } from "@/types"

const schema = z.object({
  equityReturn: z.number().min(0).max(30),
  bondReturn: z.number().min(0).max(20),
  cashReturn: z.number().min(0).max(15),
  equityVolatility: z.number().min(0).max(40),
  bondVolatility: z.number().min(0).max(20),
  inflationRate: z.number().min(0).max(20),
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
  })

  const saDefaults = {
    equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
    bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
    cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
    equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility,
    bondVolatility: SA_DEFAULTS_DISPLAY.bondVolatility,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
  }

  const handleReset = useCallback(() => {
    reset(saDefaults)
    setAssumptions({ compoundingMethod: "nominal" })
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

  const resetButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleReset}
      className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
    >
      <RotateCcw className="h-3 w-3" />
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
            {(["nominal", "compound"] as CompoundingMethod[]).map((method) => (
              <Button
                key={method}
                type="button"
                variant={assumptions.compoundingMethod === method ? "default" : "outline"}
                className="h-auto min-h-16 justify-start whitespace-normal px-3 py-3 text-left"
                onClick={() => setAssumptions({ compoundingMethod: method })}
              >
                <span className="space-y-1">
                  <span className="block text-sm font-medium">
                    {COMPOUNDING_METHOD_LABELS[method]}
                  </span>
                  <span className="block text-xs font-normal leading-5 opacity-80">
                    {COMPOUNDING_METHOD_DESCRIPTIONS[method]}
                  </span>
                </span>
              </Button>
            ))}
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
