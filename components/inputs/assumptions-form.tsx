"use client"

import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"
import { DRAWDOWN_STRATEGY_LABELS } from "@/types"
import type { DrawdownStrategy } from "@/types"
import { InfoTooltip } from "@/components/ui/info-tooltip"

const schema = z.object({
  equityReturn: z.number().min(0).max(30),
  bondReturn: z.number().min(0).max(20),
  cashReturn: z.number().min(0).max(15),
  equityVolatility: z.number().min(0).max(40),
  bondVolatility: z.number().min(0).max(20),
})

type FormData = z.infer<typeof schema>

export function AssumptionsForm() {
  const { assumptions, setAssumptions, drawdownConfig, setDrawdownConfig } =
    useCalculatorStore(
      useShallow(state => ({
        assumptions: state.assumptions,
        setAssumptions: state.setAssumptions,
        drawdownConfig: state.drawdownConfig,
        setDrawdownConfig: state.setDrawdownConfig,
      }))
    )

  const {
    register,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: assumptions,
  })

  useEffect(() => {
    const subscription = watch((value) => {
      if (value.equityReturn !== undefined) {
        setAssumptions(value as FormData)
      }
    })
    return () => subscription.unsubscribe()
  }, [watch, setAssumptions])

  // Local slider state — updates instantly during drag, commits to store on release
  const [localWithdrawalRate, setLocalWithdrawalRate] = useState(drawdownConfig.initialWithdrawalRate)
  const [localLumpSum, setLocalLumpSum] = useState(drawdownConfig.lumpSumPercentage ?? 0)

  // Sync from store when changed externally (e.g. reset to defaults)
  useEffect(() => { setLocalWithdrawalRate(drawdownConfig.initialWithdrawalRate) }, [drawdownConfig.initialWithdrawalRate])
  useEffect(() => { setLocalLumpSum(drawdownConfig.lumpSumPercentage ?? 0) }, [drawdownConfig.lumpSumPercentage])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Assumptions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Reference values for asset class returns. Each account uses its own expected return setting.
          Volatility is used in Monte Carlo simulations.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">Expected Returns (Nominal)</h4>
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
            <h4 className="text-sm font-medium">Volatility (Std Dev)</h4>
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

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">Drawdown Strategy</h4>
            <InfoTooltip
              content="Determines how you withdraw money during retirement. Fixed Percentage: withdraw a % of remaining balance each year (safer but variable income). Fixed Amount: withdraw a fixed amount adjusted for inflation (predictable income but higher risk). Variable strategies adjust based on portfolio performance."
              side="right"
            />
          </div>

          <div className="space-y-2">
            <Label>Strategy</Label>
            <Select
              value={drawdownConfig.strategy}
              onValueChange={(value) =>
                setDrawdownConfig({ strategy: value as DrawdownStrategy })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DRAWDOWN_STRATEGY_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Initial Withdrawal Rate</Label>
                <InfoTooltip
                  content="The % of your retirement nest egg you plan to withdraw in the first year. Lower rates (3-4%) require a larger nest egg but are safer. Higher rates (5-6%) allow a smaller nest egg but increase the risk of running out of money. Example: 4% of R10M = R400k/year. To get R500k/year at 4%, you'd need R12.5M (hence why lower rates need bigger nest eggs)."
                  side="left"
                />
              </div>
              <span className="text-sm font-medium">
                {localWithdrawalRate.toFixed(1)}%
              </span>
            </div>
            <Slider
              value={[localWithdrawalRate]}
              onValueChange={([value]) => setLocalWithdrawalRate(value)}
              onValueCommit={([value]) => setDrawdownConfig({ initialWithdrawalRate: value })}
              min={2}
              max={8}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              Traditional &quot;safe&quot; rate is 4%. SA research suggests 3-5%
              may be appropriate.
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label>Lump Sum at Retirement</Label>
                <InfoTooltip
                  content="SA pension/RA rules allow you to take up to one-third of your fund as a lump sum at retirement. The first R550,000 is tax-free (lifetime); amounts above are taxed at 18–36%. The remaining two-thirds must be used to purchase an annuity."
                  side="left"
                />
              </div>
              <span className="text-sm font-medium">
                {localLumpSum.toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[localLumpSum]}
              onValueChange={([value]) => setLocalLumpSum(value)}
              onValueCommit={([value]) => setDrawdownConfig({ lumpSumPercentage: value })}
              min={0}
              max={33}
              step={1}
            />
            <p className="text-xs text-muted-foreground">
              SA regulations cap the lump sum at one-third (33%) of pension/RA funds. TFSA and discretionary funds have no restriction.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
