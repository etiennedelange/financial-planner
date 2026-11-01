"use client"

import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult, SimulationResult } from "@/types"
import { usePathname } from "next/navigation"
import { createContext, useContext, useDeferredValue, useMemo } from "react"
import { useShallow } from "zustand/react/shallow"

interface CalculatorContextValue {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
  isDeferred: boolean
  simulationError: boolean
}

const CalculatorContext = createContext<CalculatorContextValue>({
  projection: null,
  simulationResult: null,
  isSimulating: false,
  isDeferred: false,
  simulationError: false,
})

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig } =
    useCalculatorStore(
      useShallow((state) => ({
        accounts: state.accounts,
        personalInfo: state.personalInfo,
        retirementGoals: state.retirementGoals,
        assumptions: state.assumptions,
        drawdownConfig: state.drawdownConfig,
      })),
    )

  const deferredAccounts = useDeferredValue(accounts)
  const deferredPersonalInfo = useDeferredValue(personalInfo)
  const deferredRetirementGoals = useDeferredValue(retirementGoals)
  const deferredAssumptions = useDeferredValue(assumptions)
  const deferredDrawdownConfig = useDeferredValue(drawdownConfig)

  // Monte Carlo lives only on the Risk page, so the worker runs only there. Every other
  // page shows deterministic results; running 1,000 simulations behind them would cost
  // CPU for numbers nobody sees.
  const simEnabled = pathname === "/calculator/risk"

  const {
    simulationResult,
    isRunning: isWorkerRunning,
    hasError,
  } = useMonteCarloWorker(
    deferredAccounts,
    deferredPersonalInfo,
    deferredRetirementGoals,
    deferredDrawdownConfig,
    1000,
    deferredAssumptions,
    simEnabled,
  )

  const isDeferred =
    deferredAccounts !== accounts ||
    deferredPersonalInfo !== personalInfo ||
    deferredRetirementGoals !== retirementGoals ||
    deferredAssumptions !== assumptions ||
    deferredDrawdownConfig !== drawdownConfig

  const isSimulating = isWorkerRunning || isDeferred

  const projection = useMemo(
    () =>
      deferredAccounts.length === 0
        ? null
        : calculateProjection(
            deferredAccounts,
            deferredPersonalInfo,
            deferredRetirementGoals,
            deferredDrawdownConfig,
            deferredAssumptions,
          ),
    [
      deferredAccounts,
      deferredPersonalInfo,
      deferredRetirementGoals,
      deferredDrawdownConfig,
      deferredAssumptions,
    ],
  )

  return (
    <CalculatorContext.Provider
      value={{ projection, simulationResult, isSimulating, isDeferred, simulationError: hasError }}
    >
      {children}
    </CalculatorContext.Provider>
  )
}

export function useCalculator() {
  return useContext(CalculatorContext)
}
