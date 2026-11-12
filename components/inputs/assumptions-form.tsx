"use client"

import { useEffect, useCallback, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { motion, useReducedMotion } from "motion/react"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { SectionLabel } from "@/components/ui/section-label"
import { Button } from "@/components/ui/button"
import { RefreshCwIcon } from "@animateicons/react/lucide"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import { useShallow } from "zustand/react/shallow"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FieldError } from "@/components/ui/field-error"
import { cn } from "@/lib/utils"
import {
  COMPOUNDING_METHOD_DESCRIPTIONS,
  COMPOUNDING_METHOD_LABELS,
  TAX_THRESHOLD_RELIEF_LABELS,
} from "@/types"
import type { CompoundingMethod, TaxThresholdRelief } from "@/types"
import {
  DEFAULT_TAX_THRESHOLD_RELIEF,
  describeTaxReliefAssumption,
} from "@/lib/calculations/utils/tax-relief"
import { useAnimatedIcon } from "@/components/ui/animated-icon"
import { ASSUMPTION_RATE_BOUNDS } from "@/lib/utils/assumption-rates"

const BOUNDS = ASSUMPTION_RATE_BOUNDS

const schema = z.object({
  equityReturn: z
    .number({ error: "Enter an equity return" })
    .min(
      BOUNDS.equityReturn.min,
      `Equity return must be between ${BOUNDS.equityReturn.min}% and ${BOUNDS.equityReturn.max}%`,
    )
    .max(
      BOUNDS.equityReturn.max,
      `Equity return must be between ${BOUNDS.equityReturn.min}% and ${BOUNDS.equityReturn.max}%`,
    ),
  bondReturn: z
    .number({ error: "Enter a bond return" })
    .min(
      BOUNDS.bondReturn.min,
      `Bond return must be between ${BOUNDS.bondReturn.min}% and ${BOUNDS.bondReturn.max}%`,
    )
    .max(
      BOUNDS.bondReturn.max,
      `Bond return must be between ${BOUNDS.bondReturn.min}% and ${BOUNDS.bondReturn.max}%`,
    ),
  cashReturn: z
    .number({ error: "Enter a cash return" })
    .min(
      BOUNDS.cashReturn.min,
      `Cash return must be between ${BOUNDS.cashReturn.min}% and ${BOUNDS.cashReturn.max}%`,
    )
    .max(
      BOUNDS.cashReturn.max,
      `Cash return must be between ${BOUNDS.cashReturn.min}% and ${BOUNDS.cashReturn.max}%`,
    ),
  inflationRate: z
    .number({ error: "Enter an inflation rate" })
    .min(
      BOUNDS.inflationRate.min,
      `Inflation rate must be between ${BOUNDS.inflationRate.min}% and ${BOUNDS.inflationRate.max}%`,
    )
    .max(
      BOUNDS.inflationRate.max,
      `Inflation rate must be between ${BOUNDS.inflationRate.min}% and ${BOUNDS.inflationRate.max}%`,
    ),
})

type FormData = z.infer<typeof schema>

const TAX_RELIEF_OPTIONS: { value: TaxThresholdRelief; description: string }[] = [
  {
    value: "historical",
    description: "Thresholds rise as SARS raised them over the last decade. Recommended.",
  },
  { value: "full", description: "Thresholds keep pace with inflation every year. Optimistic." },
  { value: "none", description: "Today's thresholds never change. Pessimistic stress test." },
]

/** A selectable card with an animated active background, shared by the choice groups below. */
function OptionCard({
  active,
  layoutId,
  label,
  description,
  onSelect,
  reduceMotion,
}: {
  active: boolean
  layoutId: string
  label: string
  description: string
  onSelect: () => void
  reduceMotion: boolean | null
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onSelect}
      className={cn(
        "relative isolate flex h-auto min-h-16 flex-col items-start justify-start gap-1 overflow-hidden rounded-md border border-transparent px-3 py-3 text-left text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        active
          ? "text-primary-foreground"
          : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          className="absolute inset-0 -z-10 bg-primary"
          transition={
            reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }
          }
        />
      )}
      <span className="relative z-10 block text-sm font-medium">{label}</span>
      <span className="relative z-10 block text-xs font-normal leading-5 opacity-80">
        {description}
      </span>
    </button>
  )
}

export function AssumptionsForm() {
  const { assumptions, setAssumptions, retirementGoals, setRetirementGoals } = useCalculatorStore(
    useShallow((state) => ({
      assumptions: state.assumptions,
      setAssumptions: state.setAssumptions,
      retirementGoals: state.retirementGoals,
      setRetirementGoals: state.setRetirementGoals,
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
      equityReturn: assumptions.equityReturn,
      bondReturn: assumptions.bondReturn,
      cashReturn: assumptions.cashReturn,
      inflationRate: retirementGoals.inflationRate,
    },
    mode: "onChange", // Validate as user types for immediate feedback
  })

  const saDefaults = {
    equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
    bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
    cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
  }

  const shouldReduceMotion = useReducedMotion()
  const [resetSpins, setResetSpins] = useState(0)

  const handleReset = useCallback(() => {
    reset(saDefaults)
    setAssumptions({
      compoundingMethod: "nominal",
      taxThresholdRelief: DEFAULT_TAX_THRESHOLD_RELIEF,
    })
    setResetSpins((n) => n + 1)
  }, [reset, setAssumptions]) // oxlint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // RHF's watch() subscription is the documented API; the React Compiler lint
    // flags it as incompatible with memoization (a known false positive).
    // oxlint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((value) => {
      // Only propagate valid values to the store, as the other Plan forms do. A cleared
      // field (NaN) or an out-of-range value must never reach the calculations or be
      // persisted (issue #34 follow-up).
      const parsed = schema.safeParse(value)
      if (!parsed.success) return
      const { inflationRate, ...assumptionFields } = parsed.data
      setAssumptions({ ...assumptionFields, inflationRate })
      setRetirementGoals({ inflationRate })
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
      current.inflationRate === retirementGoals.inflationRate
    ) {
      return
    }
    reset({
      equityReturn: assumptions.equityReturn,
      bondReturn: assumptions.bondReturn,
      cashReturn: assumptions.cashReturn,
      inflationRate: retirementGoals.inflationRate,
    })
  }, [
    assumptions.equityReturn,
    assumptions.bondReturn,
    assumptions.cashReturn,
    retirementGoals.inflationRate,
    reset,
    getValues,
  ])

  const resetButton = (
    <ResetButton
      onClick={handleReset}
      resetSpins={resetSpins}
      shouldReduceMotion={shouldReduceMotion}
    />
  )

  function ResetButton({
    onClick,
    resetSpins,
    shouldReduceMotion,
  }: {
    onClick: () => void
    resetSpins: number
    shouldReduceMotion: boolean | null
  }) {
    const { iconProps, controlProps } = useAnimatedIcon()

    return (
      <Button
        {...controlProps}
        variant="ghost"
        size="sm"
        onClick={onClick}
        className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <motion.span
          className="inline-flex"
          animate={{ rotate: resetSpins * -360 }}
          transition={{ duration: shouldReduceMotion ? 0 : 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <RefreshCwIcon {...iconProps} size={12} />
        </motion.span>
        SA defaults
      </Button>
    )
  }

  return (
    <PageCard
      label="Market Assumptions"
      description={
        <>
          Inflation, return calculation method and future tax relief apply to every projection. The
          equity, bond and cash returns are not currently used by any calculation — each account
          uses its own expected return. Volatility and market-risk simulations are on the{" "}
          <Link href="/calculator/risk" className="text-foreground underline underline-offset-2">
            Risk
          </Link>{" "}
          page.
        </>
      }
      trailing={resetButton}
      contentClassName="space-y-6"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <SectionLabel>Expected Returns (Nominal)</SectionLabel>
          <InfoTooltip
            content="Not currently used by any calculation: projections and simulations use each account's own expected return. Nominal returns include inflation - a 10% nominal return with 5% inflation gives ~5% real growth."
            side="right"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Reference only — changing these does not affect your results.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="equityReturn">Equity (%)</Label>
            <Input
              id="equityReturn"
              type="number"
              min={BOUNDS.equityReturn.min}
              max={BOUNDS.equityReturn.max}
              step="0.5"
              {...register("equityReturn", { valueAsNumber: true })}
            />
            <FieldError message={errors.equityReturn?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bondReturn">Bonds (%)</Label>
            <Input
              id="bondReturn"
              type="number"
              min={BOUNDS.bondReturn.min}
              max={BOUNDS.bondReturn.max}
              step="0.5"
              {...register("bondReturn", { valueAsNumber: true })}
            />
            <FieldError message={errors.bondReturn?.message} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cashReturn">Cash (%)</Label>
            <Input
              id="cashReturn"
              type="number"
              min={BOUNDS.cashReturn.min}
              max={BOUNDS.cashReturn.max}
              step="0.5"
              {...register("cashReturn", { valueAsNumber: true })}
            />
            <FieldError message={errors.cashReturn?.message} />
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
            <OptionCard
              key={method}
              active={assumptions.compoundingMethod === method}
              layoutId="compounding-method-active"
              label={COMPOUNDING_METHOD_LABELS[method]}
              description={COMPOUNDING_METHOD_DESCRIPTIONS[method]}
              onSelect={() => setAssumptions({ compoundingMethod: method })}
              reduceMotion={shouldReduceMotion}
            />
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t border-border pt-4">
        <div className="flex items-center gap-2">
          <SectionLabel>Future Tax Relief</SectionLabel>
          <InfoTooltip
            content="SARS publishes only this year's tax tables. This sets how much brackets, rebates, the tax-free lump sum and the retirement deduction cap are assumed to rise in future years. Less relief means more tax on the same real income."
            side="right"
          />
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {TAX_RELIEF_OPTIONS.map((option) => (
            <OptionCard
              key={option.value}
              active={
                (assumptions.taxThresholdRelief ?? DEFAULT_TAX_THRESHOLD_RELIEF) === option.value
              }
              layoutId="tax-relief-active"
              label={TAX_THRESHOLD_RELIEF_LABELS[option.value]}
              description={option.description}
              onSelect={() => setAssumptions({ taxThresholdRelief: option.value })}
              reduceMotion={shouldReduceMotion}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {describeTaxReliefAssumption(
            assumptions.taxThresholdRelief,
            retirementGoals.inflationRate,
          )}
        </p>
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
              min={BOUNDS.inflationRate.min}
              max={BOUNDS.inflationRate.max}
              step="0.5"
              className="max-w-[120px]"
              {...register("inflationRate", { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">SA historical average: 5–6%</p>
          </div>
          <FieldError message={errors.inflationRate?.message} />
        </div>
      </div>
    </PageCard>
  )
}
