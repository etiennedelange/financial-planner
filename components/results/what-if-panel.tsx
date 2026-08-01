"use client"

import { useDeferredValue, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import {
  applySensitivityDeltas,
  DEFAULT_SENSITIVITY_DELTAS,
  type SensitivityDeltas,
} from "@/lib/calculations/utils/apply-sensitivity-deltas"
import { formatCurrency, formatCurrencyCompact } from "@/lib/utils/currency"
import { cn } from "@/lib/utils"

function isAtDefault(deltas: SensitivityDeltas): boolean {
  return (
    deltas.retirementAgeOffset === DEFAULT_SENSITIVITY_DELTAS.retirementAgeOffset &&
    deltas.contributionScalePct === DEFAULT_SENSITIVITY_DELTAS.contributionScalePct &&
    deltas.returnDeltaPts === DEFAULT_SENSITIVITY_DELTAS.returnDeltaPts &&
    deltas.targetMonthlyIncomeOverride === DEFAULT_SENSITIVITY_DELTAS.targetMonthlyIncomeOverride
  )
}

export function WhatIfPanel() {
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    setPersonalInfo,
    setRetirementGoals,
    updateAccount,
  } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      setPersonalInfo: state.setPersonalInfo,
      setRetirementGoals: state.setRetirementGoals,
      updateAccount: state.updateAccount,
    }))
  )

  const [deltas, setDeltas] = useState<SensitivityDeltas>(DEFAULT_SENSITIVITY_DELTAS)

  // Instant (deterministic) side: recomputed synchronously on every drag tick.
  const {
    accounts: scaledAccounts,
    personalInfo: scaledPersonalInfo,
    retirementGoals: scaledRetirementGoals,
  } = useMemo(
    () => applySensitivityDeltas(accounts, personalInfo, retirementGoals, deltas),
    [accounts, personalInfo, retirementGoals, deltas]
  )

  const baselineProjection = useMemo(
    () =>
      accounts.length === 0
        ? null
        : calculateProjection(accounts, personalInfo, retirementGoals, drawdownConfig, assumptions),
    [accounts, personalInfo, retirementGoals, drawdownConfig, assumptions]
  )

  const sandboxProjection = useMemo(
    () =>
      accounts.length === 0
        ? null
        : calculateProjection(scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, assumptions),
    [scaledAccounts, scaledPersonalInfo, scaledRetirementGoals, drawdownConfig, assumptions, accounts.length]
  )

  // Debounced (Monte Carlo) side: baseline uses the real plan directly; sandbox
  // uses deferred deltas so rapid dragging doesn't spam the worker.
  const { simulationResult: baselineSimulation } = useMonteCarloWorker(
    accounts,
    personalInfo,
    retirementGoals,
    drawdownConfig,
    1000,
    assumptions,
    accounts.length > 0
  )

  const deferredDeltas = useDeferredValue(deltas)
  const {
    accounts: mcAccounts,
    personalInfo: mcPersonalInfo,
    retirementGoals: mcRetirementGoals,
  } = useMemo(
    () => applySensitivityDeltas(accounts, personalInfo, retirementGoals, deferredDeltas),
    [accounts, personalInfo, retirementGoals, deferredDeltas]
  )
  const { simulationResult: sandboxSimulation, isRunning: isSandboxSimulating } = useMonteCarloWorker(
    mcAccounts,
    mcPersonalInfo,
    mcRetirementGoals,
    drawdownConfig,
    1000,
    assumptions,
    accounts.length > 0
  )

  const handleReset = () => setDeltas(DEFAULT_SENSITIVITY_DELTAS)

  const handleApply = () => {
    setPersonalInfo({ retirementAge: scaledPersonalInfo.retirementAge })
    setRetirementGoals({ desiredMonthlyIncome: scaledRetirementGoals.desiredMonthlyIncome })
    scaledAccounts.forEach((scaledAccount, index) => {
      const original = accounts[index]
      if (
        scaledAccount.monthlyContribution !== original.monthlyContribution ||
        scaledAccount.expectedReturn !== original.expectedReturn
      ) {
        updateAccount(scaledAccount.id, {
          monthlyContribution: scaledAccount.monthlyContribution,
          expectedReturn: scaledAccount.expectedReturn,
        })
      }
    })
    setDeltas(DEFAULT_SENSITIVITY_DELTAS)
  }

  if (accounts.length === 0) return null

  const atDefault = isAtDefault(deltas)

  const totalScaledContribution = scaledAccounts.reduce((sum, acc) => sum + acc.monthlyContribution, 0)
  const totalBalance = scaledAccounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const weightedReturn =
    totalBalance === 0
      ? 0
      : scaledAccounts.reduce((sum, acc) => sum + acc.expectedReturn * acc.currentBalance, 0) / totalBalance

  const nestEggDelta =
    (sandboxProjection?.portfolioAtRetirement ?? 0) - (baselineProjection?.portfolioAtRetirement ?? 0)
  const successRateDelta =
    sandboxSimulation && baselineSimulation ? sandboxSimulation.successRate - baselineSimulation.successRate : null

  return (
    <PageCard
      label="What If"
      description="Drag the sliders to preview outcomes without changing your saved plan."
      contentClassName="space-y-6"
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Retirement age: {scaledPersonalInfo.retirementAge}</label>
            <Slider
              value={[deltas.retirementAgeOffset]}
              min={-10}
              max={15}
              step={1}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, retirementAgeOffset: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Monthly contribution: {formatCurrency(totalScaledContribution)}
            </label>
            <Slider
              value={[deltas.contributionScalePct]}
              min={-100}
              max={200}
              step={5}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, contributionScalePct: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Expected return: {weightedReturn.toFixed(1)}%</label>
            <Slider
              value={[deltas.returnDeltaPts]}
              min={-5}
              max={5}
              step={0.5}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, returnDeltaPts: value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Target monthly income: {formatCurrency(scaledRetirementGoals.desiredMonthlyIncome)}
            </label>
            <Slider
              value={[deltas.targetMonthlyIncomeOverride ?? retirementGoals.desiredMonthlyIncome]}
              min={retirementGoals.desiredMonthlyIncome * 0.5}
              max={retirementGoals.desiredMonthlyIncome * 1.5}
              step={500}
              onValueChange={([value]) => setDeltas((d) => ({ ...d, targetMonthlyIncomeOverride: value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={handleReset} disabled={atDefault}>
              Reset
            </Button>
            <Button size="sm" onClick={handleApply} disabled={atDefault}>
              Apply to plan
            </Button>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Projected nest egg at retirement</p>
            <p className="text-2xl font-bold font-mono">
              {formatCurrency(sandboxProjection?.portfolioAtRetirement ?? 0)}
            </p>
            {!atDefault && nestEggDelta !== 0 && (
              <p className={cn("text-xs", nestEggDelta > 0 ? "text-chart-2" : "text-destructive")}>
                {nestEggDelta > 0 ? "+" : "-"}
                {formatCurrencyCompact(Math.abs(nestEggDelta))} vs your current plan
              </p>
            )}
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Success probability</p>
            {isSandboxSimulating ? (
              <div className="h-7 w-16 rounded bg-muted animate-pulse" />
            ) : (
              <p className="text-2xl font-bold font-mono">
                {sandboxSimulation ? `${sandboxSimulation.successRate.toFixed(0)}%` : "—"}
              </p>
            )}
            {!atDefault && successRateDelta !== null && (
              <p className={cn("text-xs", successRateDelta >= 0 ? "text-chart-2" : "text-destructive")}>
                {successRateDelta >= 0 ? "+" : ""}
                {successRateDelta.toFixed(0)}pts vs your current plan
              </p>
            )}
          </div>
        </div>
      </div>
    </PageCard>
  )
}
