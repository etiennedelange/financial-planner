"use client"

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useShallow } from "zustand/react/shallow"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageCard } from "@/components/ui/page-card"
import { InfoTooltip } from "@/components/ui/info-tooltip"
import { FieldError } from "@/components/ui/field-error"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import { INVESTMENT_TYPE_RISK } from "@/lib/constants/investment-types"
import { INVESTMENT_TYPES } from "@/types"

const pct = (decimal: number) => `${(decimal * 100).toFixed(1)}%`

const schema = z.object({
  equityVolatility: z
    .number({ error: "Enter equity volatility" })
    .min(0, "Equity volatility must be between 0% and 40%")
    .max(40, "Equity volatility must be between 0% and 40%"),
})

type FormData = z.infer<typeof schema>

/**
 * The simulation's volatility inputs. Moved from Market Assumptions on the Plan page
 * (2026-10-31) so every Monte Carlo input sits on the Risk page beside its results.
 *
 * Since investment types (2026-11-04) a typed account's volatility comes from its type's
 * researched figure, shown read-only here with sources. The one editable figure applies
 * only to accounts without a type. Bond volatility was removed from the form: no
 * calculation used it, and the Conservative and Balanced types now carry their own
 * figures. The field stays on MarketAssumptions so stored plans keep their shape.
 */
export function VolatilityForm() {
  const { assumptions, setAssumptions, accounts } = useCalculatorStore(
    useShallow((state) => ({
      assumptions: state.assumptions,
      setAssumptions: state.setAssumptions,
      accounts: state.accounts,
    })),
  )
  const untypedCount = accounts.filter((a) => !a.investmentType).length
  const typesInUse = new Set(accounts.map((a) => a.investmentType).filter(Boolean))

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
    if (getValues().equityVolatility === assumptions.equityVolatility) return
    reset({ equityVolatility: assumptions.equityVolatility })
  }, [assumptions.equityVolatility, reset, getValues])

  const resetToDefaults = () => reset({ equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility })

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invested in</TableHead>
              <TableHead className="text-right">Volatility</TableHead>
              <TableHead className="text-right">Worst 12 months</TableHead>
              <TableHead className="hidden sm:table-cell">Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INVESTMENT_TYPES.map((t) => {
              const r = INVESTMENT_TYPE_RISK[t]
              const inUse = typesInUse.has(t)
              return (
                <TableRow key={t} className={inUse ? undefined : "text-muted-foreground"}>
                  <TableCell>
                    <span className={inUse ? "font-medium" : undefined}>{r.label}</span>
                    {inUse && <span className="sr-only"> (used by your accounts)</span>}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {pct(r.volatility)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {pct(r.stressReturn)}
                    {r.stressUnderstated && "*"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-xs">
                    <a
                      href={r.sources[0].url.startsWith("http") ? r.sources[0].url : undefined}
                      className="underline-offset-2 hover:underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      {r.sources[0].label}
                    </a>
                    {r.secondary && " (partly secondary)"}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        In rand, from fund factsheets and index data verified 4 November 2026. *Calendar-year
        figure; a 12-month fall could be deeper. Types in bold are used by your accounts.
      </p>

      <div className="space-y-2 border-t border-border/50 pt-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="equityVolatility">Volatility for accounts without a type (%)</Label>
          <InfoTooltip
            content="Accounts with no investment type use this figure and move in lockstep with the market, as all accounts did before types existed. A 0% expected return still means no volatility. Typical SA equity: 15–18%."
            side="right"
          />
        </div>
        <Input
          id="equityVolatility"
          type="number"
          min="0"
          max="40"
          step="0.5"
          className="sm:max-w-[200px]"
          {...register("equityVolatility", { valueAsNumber: true })}
        />
        <FieldError message={errors.equityVolatility?.message} />
        <p className={untypedCount > 0 ? "text-xs text-warning" : "text-xs text-muted-foreground"}>
          {untypedCount > 0
            ? `${untypedCount} account${untypedCount === 1 ? "" : "s"} without a type. Set what each is invested in on the Accounts page for a more accurate simulation.`
            : "All your accounts have an investment type, so this figure is not used."}
        </p>
      </div>
    </PageCard>
  )
}
