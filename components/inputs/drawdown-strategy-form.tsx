"use client"

import { useState, type Dispatch, type SetStateAction } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"
import { SectionLabel } from "@/components/ui/section-label"
import { Slider } from "@/components/ui/slider"
import { AnimatedValue } from "@/components/ui/animated-value"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import { useBoundedMonetary } from "@/lib/hooks/use-bounded-monetary"
import { MAX_MONETARY_AMOUNT } from "@/lib/constants/limits"
import { useShallow } from "zustand/react/shallow"
import { DRAWDOWN_STRATEGY_LABELS } from "@/types"
import type { DrawdownStrategy } from "@/types"
import { InfoTooltip } from "@/components/ui/info-tooltip"

interface DrawdownStrategyFormProps {
  portfolioAtRetirement?: number
  displayMode?: "nominal" | "real"
}

// Local editing state that snaps back to its source whenever the source value
// changes (e.g. loading a different scenario). Done as a guarded render-time
// adjustment — React's "adjust state when props change" pattern — instead of
// setState-in-effect, so the slider and the store never disagree for a frame.
function useSyncedState<T>(source: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(source)
  const [prevSource, setPrevSource] = useState(source)
  if (prevSource !== source) {
    setPrevSource(source)
    setValue(source)
  }
  return [value, setValue]
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

  const [localWithdrawalRate, setLocalWithdrawalRate] = useSyncedState(drawdownConfig.initialWithdrawalRate)
  const [localLumpSum, setLocalLumpSum] = useSyncedState(drawdownConfig.lumpSumPercentage ?? 0)
  const [localUpperGuardrail, setLocalUpperGuardrail] = useSyncedState(drawdownConfig.upperGuardrail ?? 20)
  const [localLowerGuardrail, setLocalLowerGuardrail] = useSyncedState(drawdownConfig.lowerGuardrail ?? 20)

  // Physically block monetary input above the cap.
  const guardMinimumWithdrawal = useBoundedMonetary(drawdownConfig.minimumWithdrawal)
  const guardMaximumWithdrawal = useBoundedMonetary(drawdownConfig.maximumWithdrawal)
  const guardMedicalAid = useBoundedMonetary(drawdownConfig.monthlyMedicalAid ?? "")

  const showMinMax = drawdownConfig.strategy === "variable_percentage" || drawdownConfig.strategy === "guardrails"
  const showGuardrailBands = drawdownConfig.strategy === "guardrails"

  const shouldReduceMotion = useReducedMotion()
  const revealTransition = { duration: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] as const }

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
                <SelectGroup>
                  {Object.entries(DRAWDOWN_STRATEGY_LABELS).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  )}
                </SelectGroup>
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
              aria-label="Initial Withdrawal Rate"
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
                <AnimatePresence initial={false}>
                  {portfolioAtRetirement != null && localLumpSum > 0 && (
                    <motion.span
                      key={`lump-${portfolioAtRetirement * (localLumpSum / 100)}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
                      className="ml-2 text-sm text-muted-foreground"
                    >
                      ≈ <AnimatedValue
                        value={portfolioAtRetirement * (localLumpSum / 100)}
                        format={(val: number) => formatCurrency(
                          val,
                          displayMode,
                          yearsToRetirement,
                          inflationRate
                        )}
                      />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <Slider
              value={[localLumpSum]}
              onValueChange={([value]) => setLocalLumpSum(value)}
              onValueCommit={([value]) => setDrawdownConfig({ lumpSumPercentage: value })}
              min={0}
              max={33}
              step={1}
              aria-label="Lump Sum at Retirement"
            />
            <p className="text-xs text-muted-foreground">
              SA regulations cap the lump sum at one-third (33%) of pension/RA funds. TFSA and discretionary funds have no restriction.
            </p>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showMinMax && (
            <motion.div
              key="min-max"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={revealTransition}
              className="overflow-hidden"
            >
              <div className="space-y-4 pb-0.5">
                <SectionLabel>Withdrawal Floor &amp; Ceiling</SectionLabel>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="minimumWithdrawal">Minimum Withdrawal (R/month, today&apos;s value)</Label>
                      <InfoTooltip
                        content="The lowest monthly amount you'll withdraw, even if your portfolio percentage falls below it. Escalated with inflation each year."
                        side="left"
                      />
                    </div>
                    <Input
                      id="minimumWithdrawal"
                      type="number"
                      min="0"
                      max={MAX_MONETARY_AMOUNT}
                      step="any"
                      value={drawdownConfig.minimumWithdrawal}
                      onChange={(e) => guardMinimumWithdrawal.onChange(e, (ev) =>
                        setDrawdownConfig({ minimumWithdrawal: Number(ev.target.value) })
                      )}
                      onBeforeInput={guardMinimumWithdrawal.onBeforeInput}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="maximumWithdrawal">Maximum Withdrawal (R/month, today&apos;s value)</Label>
                      <InfoTooltip
                        content="The highest monthly amount you'll withdraw, even if your portfolio percentage rises above it. Escalated with inflation each year."
                        side="left"
                      />
                    </div>
                    <Input
                      id="maximumWithdrawal"
                      type="number"
                      min="0"
                      max={MAX_MONETARY_AMOUNT}
                      step="any"
                      value={drawdownConfig.maximumWithdrawal}
                      onChange={(e) => guardMaximumWithdrawal.onChange(e, (ev) =>
                        setDrawdownConfig({ maximumWithdrawal: Number(ev.target.value) })
                      )}
                      onBeforeInput={guardMaximumWithdrawal.onBeforeInput}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showGuardrailBands && (
            <motion.div
              key="guardrail-bands"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={revealTransition}
              className="overflow-hidden"
            >
              <div className="space-y-4 px-3 pb-0.5">
                <SectionLabel>Guardrail Bands</SectionLabel>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Upper Guardrail</Label>
                        <InfoTooltip
                          content="If your withdrawal rate rises this far above your target rate (portfolio underperforming), withdrawals are cut by 10% (capital preservation rule)."
                          side="left"
                        />
                      </div>
                      <span className="text-sm font-medium">{localUpperGuardrail.toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[localUpperGuardrail]}
                      onValueChange={([value]) => setLocalUpperGuardrail(value)}
                      onValueCommit={([value]) => setDrawdownConfig({ upperGuardrail: value })}
                      min={5}
                      max={50}
                      step={5}
                      aria-label="Upper Guardrail"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Label>Lower Guardrail</Label>
                        <InfoTooltip
                          content="If your withdrawal rate falls this far below your target rate (portfolio outperforming), withdrawals are raised by 10% (prosperity rule)."
                          side="left"
                        />
                      </div>
                      <span className="text-sm font-medium">{localLowerGuardrail.toFixed(0)}%</span>
                    </div>
                    <Slider
                      value={[localLowerGuardrail]}
                      onValueChange={([value]) => setLocalLowerGuardrail(value)}
                      onValueCommit={([value]) => setDrawdownConfig({ lowerGuardrail: value })}
                      min={5}
                      max={50}
                      step={5}
                      aria-label="Lower Guardrail"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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
                max={MAX_MONETARY_AMOUNT}
                step="100"
                placeholder="0"
                value={drawdownConfig.monthlyMedicalAid ?? ""}
                onChange={(e) => guardMedicalAid.onChange(e, (ev) => {
                  const v = ev.target.value
                  setDrawdownConfig({
                    monthlyMedicalAid: v === "" ? undefined : Number(v),
                  })
                })}
                onBeforeInput={guardMedicalAid.onBeforeInput}
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
