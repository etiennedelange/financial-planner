"use client"

import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult, SimulationResult } from "@/types"
import { usePathname } from "next/navigation"
import { createContext, useContext, useDeferredValue, useMemo, useState, useCallback, useEffect } from "react"
import { useShallow } from "zustand/react/shallow"

interface CalculatorContextValue {
  projection: ProjectionResult | null
  simulationResult: SimulationResult | null
  isSimulating: boolean
  isDeferred: boolean
  rerunSimulation: () => void
}

const CalculatorContext = createContext<CalculatorContextValue>({
  projection: null,
  simulationResult: null,
  isSimulating: false,
  isDeferred: false,
  rerunSimulation: () => {},
})

export function CalculatorProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [rerunTrigger, setRerunTrigger] = useState(0)
  const [isRerunning, setIsRerunning] = useState(false)

  const { accounts, personalInfo, retirementGoals, assumptions, drawdownConfig } =
    useCalculatorStore(
      useShallow((state) => ({
        accounts: state.accounts,
        personalInfo: state.personalInfo,
        retirementGoals: state.retirementGoals,
        assumptions: state.assumptions,
        drawdownConfig: state.drawdownConfig,
      }))
    )

  const deferredAccounts = useDeferredValue(accounts)
  const deferredPersonalInfo = useDeferredValue(personalInfo)
  const deferredRetirementGoals = useDeferredValue(retirementGoals)
  const deferredAssumptions = useDeferredValue(assumptions)
  const deferredDrawdownConfig = useDeferredValue(drawdownConfig)

  const { simulationResult: workerResult, isRunning: isWorkerRunning } = useMonteCarloWorker(
    deferredAccounts,
    deferredPersonalInfo,
    deferredRetirementGoals,
    deferredDrawdownConfig,
    5000,
    deferredAssumptions,
    pathname === "/calculator/overview",
    rerunTrigger
  )

  // Clear simulation result when rerunning to force loading state
  const simulationResult = isRerunning ? null : workerResult

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
            deferredAssumptions
          ),
    [deferredAccounts, deferredPersonalInfo, deferredRetirementGoals, deferredDrawdownConfig, deferredAssumptions]
  )

  // Stop showing loading state when simulation completes
  useEffect(() => {
    if (isRerunning && !isWorkerRunning) {
      setIsRerunning(false)
    }
  }, [isRerunning, isWorkerRunning])

  const rerunSimulation = useCallback(() => {
    setIsRerunning(true)
    setRerunTrigger(prev => prev + 1)
  }, [])

  return (
    <CalculatorContext.Provider value={{ projection, simulationResult, isSimulating, isDeferred, rerunSimulation }}>
      {children}
    </CalculatorContext.Provider>
  )
}

export function useCalculator() {
  return useContext(CalculatorContext)
}
