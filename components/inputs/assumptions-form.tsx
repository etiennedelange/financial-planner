"use client"

import { useEffect } from "react"
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
import { DRAWDOWN_STRATEGY_LABELS } from "@/types"
import type { DrawdownStrategy } from "@/types"

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
    useCalculatorStore()

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
          <h4 className="text-sm font-medium">Expected Returns (Nominal)</h4>
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
          <h4 className="text-sm font-medium">Volatility (Std Dev)</h4>
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
          <h4 className="text-sm font-medium">Drawdown Strategy</h4>

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
              <Label>Initial Withdrawal Rate</Label>
              <span className="text-sm font-medium">
                {drawdownConfig.initialWithdrawalRate.toFixed(1)}%
              </span>
            </div>
            <Slider
              value={[drawdownConfig.initialWithdrawalRate]}
              onValueChange={([value]) =>
                setDrawdownConfig({ initialWithdrawalRate: value })
              }
              min={2}
              max={8}
              step={0.5}
            />
            <p className="text-xs text-muted-foreground">
              Traditional &quot;safe&quot; rate is 4%. SA research suggests 3-5%
              may be appropriate.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
