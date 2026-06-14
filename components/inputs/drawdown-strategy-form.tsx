"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { SectionLabel } from "@/components/ui/section-label"
import { Slider } from "@/components/ui/slider"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import { useShallow } from "zustand/react/shallow"
import { DRAWDOWN_STRATEGY_LABELS } from "@/types"
import type { DrawdownStrategy } from "@/types"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface DrawdownStrategyFormProps {
  portfolioAtRetirement?: number
  displayMode?: "nominal" | "real"
}

export function DrawdownStrategyForm({
  portfolioAtRetirement,
  displayMode = "nominal",
}: DrawdownStrategyFormProps) {
  const { drawdownConfig, setDrawdownConfig, personalInfo, inflationRate } =
    useCalculatorStore(
      useShallow(state => ({
        drawdownConfig: state.drawdownConfig,
        setDrawdownConfig: state.setDrawdownConfig,
        personalInfo: state.personalInfo,
        inflationRate: state.retirementGoals.inflationRate / 100,
      }))
    )

  const yearsToRetirement = personalInfo.retirementAge - personalInfo.currentAge

  const [localWithdrawalRate, setLocalWithdrawalRate] = useState(drawdownConfig.initialWithdrawalRate)
  const [localLumpSum, setLocalLumpSum] = useState(drawdownConfig.lumpSumPercentage ?? 0)

  useEffect(() => { setLocalWithdrawalRate(drawdownConfig.initialWithdrawalRate) }, [drawdownConfig.initialWithdrawalRate])
  useEffect(() => { setLocalLumpSum(drawdownConfig.lumpSumPercentage ?? 0) }, [drawdownConfig.lumpSumPercentage])

  return (
    <PageCard
      label="Drawdown Strategy"
      description="Your withdrawal rate, lump-sum election, and retirement healthcare costs."
      contentClassName="space-y-6"
    >
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="drawdown-strategy-select">Strategy</Label>
              <InfoTooltip
                content="Determines how you withdraw money during retirement. Fixed Percentage: withdraw a % of remaining balance each year (safer but variable income). Fixed Amount: withdraw a fixed amount adjusted for inflation (predictable income but higher risk). Variable strategies adjust based on portfolio performance."
                side="right"
              />
            </div>
            <Select
              value={drawdownConfig.strategy}
              onValueChange={(value) =>
                setDrawdownConfig({ strategy: value as DrawdownStrategy })
              }
            >
              <SelectTrigger id="drawdown-strategy-select">
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
              Traditional &quot;safe&quot; rate is 4%. SA research suggests 3–5% may be appropriate.
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
              <div className="text-right">
                <span className="text-sm font-medium">{localLumpSum.toFixed(0)}%</span>
                {portfolioAtRetirement != null && localLumpSum > 0 && (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ≈ {formatCurrency(
                      portfolioAtRetirement * (localLumpSum / 100),
                      displayMode,
                      yearsToRetirement,
                      inflationRate
                    )}
                  </span>
                )}
              </div>
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

        <div className="space-y-4">
          <SectionLabel>Medical Aid &amp; Tax Credits</SectionLabel>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="monthlyMedicalAid">Medical Aid (R/month, today&apos;s value)</Label>
                <InfoTooltip
                  content="Enter your current monthly medical aid contribution in today's Rands. The projection escalates this with inflation each year. It reduces net retirement income but generates an s6A tax credit (R364/month for principal member + first dependant, R246/month per additional dependant) that directly reduces income tax."
                  side="left"
                />
              </div>
              <Input
                id="monthlyMedicalAid"
                type="number"
                min="0"
                step="100"
                placeholder="0"
                value={drawdownConfig.monthlyMedicalAid ?? ""}
                onChange={(e) =>
                  setDrawdownConfig({
                    monthlyMedicalAid: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="medicalAidDependants">Dependants</Label>
                <InfoTooltip
                  content="Number of additional beneficiaries on your medical aid (excluding yourself). Each additional dependant adds a s6A credit of R364/month (first) or R246/month (subsequent) to reduce your tax."
                  side="left"
                />
              </div>
              <Input
                id="medicalAidDependants"
                type="number"
                min="0"
                max="10"
                step="1"
                placeholder="0"
                value={drawdownConfig.medicalAidDependants ?? ""}
                onChange={(e) =>
                  setDrawdownConfig({
                    medicalAidDependants: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                Tax credits: R364/month (member), R364 (1st dependant), R246 each thereafter.
              </p>
            </div>
          </div>
        </div>
    </PageCard>
  )
}
