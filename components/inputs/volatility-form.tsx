"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useShallow } from "zustand/react/shallow"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FieldError } from "@/components/ui/field-error"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"

const schema = z.object({
  equityVolatility: z
    .number({ error: "Enter equity volatility" })
    .min(0, "Equity volatility must be between 0% and 40%")
    .max(40, "Equity volatility must be between 0% and 40%"),
  bondVolatility: z
    .number({ error: "Enter bond volatility" })
    .min(0, "Bond volatility must be between 0% and 20%")
    .max(20, "Bond volatility must be between 0% and 20%"),
})

type FormData = z.infer<typeof schema>

/**
 * The simulation's volatility inputs. Moved from Market Assumptions on the Plan page
 * (2026-10-31) so every Monte Carlo input sits on the Risk page beside its results.
 */
export function VolatilityForm() {
  const { assumptions, setAssumptions } = useCalculatorStore(
    useShallow((state) => ({
      assumptions: state.assumptions,
      setAssumptions: state.setAssumptions,
    })),
  )

  const {
    register,
    watch,
    reset,
    getValues,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      equityVolatility: assumptions.equityVolatility,
      bondVolatility: assumptions.bondVolatility,
    },
    mode: "onChange",
  })

  // Only valid values reach the store, so a half-typed field never feeds the simulation
  useEffect(() => {
    const subscription = watch((value) => {
      const parsed = schema.safeParse(value)
      if (parsed.success) setAssumptions(parsed.data)
    })
    return () => subscription.unsubscribe()
  }, [watch, setAssumptions])

  // Sync when the store hydrates or the scenario switches
  useEffect(() => {
    const current = getValues()
    if (
      current.equityVolatility === assumptions.equityVolatility &&
      current.bondVolatility === assumptions.bondVolatility
    ) {
      return
    }
    reset({
      equityVolatility: assumptions.equityVolatility,
      bondVolatility: assumptions.bondVolatility,
    })
  }, [assumptions.equityVolatility, assumptions.bondVolatility, reset, getValues])

  const resetToDefaults = () =>
    reset({
      equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility,
      bondVolatility: SA_DEFAULTS_DISPLAY.bondVolatility,
    })

  return (
    <PageCard
      label="Market Volatility"
      description="How much returns swing from year to year. Higher volatility means a wider spread of outcomes and more chance of a bad run early in retirement."
      trailing={
        <Button
          variant="ghost"
          size="sm"
          onClick={resetToDefaults}
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          SA defaults
        </Button>
      }
      contentClassName="space-y-4"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="equityVolatility">Equity volatility (%)</Label>
            <InfoTooltip
              content="Standard deviation of yearly equity returns. The simulation currently applies this to every account with a non-zero expected return. Typical SA equity: 15–18%."
              side="right"
            />
          </div>
          <Input
            id="equityVolatility"
            type="number"
            min="0"
            max="40"
            step="0.5"
            {...register("equityVolatility", { valueAsNumber: true })}
          />
          <FieldError message={errors.equityVolatility?.message} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="bondVolatility">Bond volatility (%)</Label>
            <InfoTooltip
              content="Standard deviation of yearly bond returns. Stored for per-account investment types; the simulation does not use it yet."
              side="right"
            />
          </div>
          <Input
            id="bondVolatility"
            type="number"
            min="0"
            max="20"
            step="0.5"
            {...register("bondVolatility", { valueAsNumber: true })}
          />
          <FieldError message={errors.bondVolatility?.message} />
        </div>
      </div>
    </PageCard>
  )
}
