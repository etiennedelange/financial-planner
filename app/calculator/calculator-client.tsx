"use client"

import { AppShell } from "@/components/layout/app-shell"
import type { NavPage } from "@/components/layout/sidebar"
import { AccountsPage } from "@/components/pages/accounts-page"
import { ExpensesPage } from "@/components/pages/expenses-page"
import { OverviewPage } from "@/components/pages/overview-page"
import { PlanPage } from "@/components/pages/plan-page"
import dynamic from "next/dynamic"

const ProjectionsPage = dynamic(
  () => import("@/components/pages/projections-page").then((m) => ({ default: m.ProjectionsPage })),
  { ssr: false }
)
const SettingsPage = dynamic(
  () => import("@/components/pages/settings-page").then((m) => ({ default: m.SettingsPage })),
  { ssr: false }
)
import { DebugWindow } from "@/components/debug/debug-window"
import { useAuth } from "@/components/supabase-provider"
import { calculateProjection } from "@/lib/calculations/projection-engine"
import { useMonteCarloWorker } from "@/lib/monte-carlo/use-monte-carlo-worker"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import type { ProjectionResult } from "@/types"
import { useEffect, useDeferredValue, useMemo, useState } from "react"
import { useShallow } from "zustand/react/shallow"

export function CalculatorClient() {
  const { user } = useAuth()
  const {
    accounts,
    personalInfo,
    retirementGoals,
    assumptions,
    drawdownConfig,
    displayMode,
    setDisplayMode,
  } = useCalculatorStore(
    useShallow((state) => ({
      accounts: state.accounts,
      personalInfo: state.personalInfo,
      retirementGoals: state.retirementGoals,
      assumptions: state.assumptions,
      drawdownConfig: state.drawdownConfig,
      displayMode: state.displayMode,
      setDisplayMode: state.setDisplayMode,
    }))
  )

  const [activePage, setActivePage] = useState<NavPage>(() => {
    if (typeof window === "undefined") return "overview"
    return (localStorage.getItem("activePage") as NavPage) ?? "overview"
  })

  useEffect(() => {
    localStorage.setItem("activePage", activePage)
  }, [activePage])

  const deferredAccounts = useDeferredValue(accounts)
  const deferredPersonalInfo = useDeferredValue(personalInfo)
  const deferredRetirementGoals = useDeferredValue(retirementGoals)
  const deferredAssumptions = useDeferredValue(assumptions)
  const deferredDrawdownConfig = useDeferredValue(drawdownConfig)

  const { simulationResult, isRunning: isWorkerRunning } = useMonteCarloWorker(
    deferredAccounts,
    deferredPersonalInfo,
    deferredRetirementGoals,
    deferredDrawdownConfig,
    1000,
    deferredAssumptions,
    activePage === "overview"
  )

  const isSimulating =
    isWorkerRunning ||
    deferredAccounts !== accounts ||
    deferredPersonalInfo !== personalInfo ||
    deferredRetirementGoals !== retirementGoals ||
    deferredAssumptions !== assumptions ||
    deferredDrawdownConfig !== drawdownConfig

  const projection: ProjectionResult | null = useMemo(
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

  const totalCurrentBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0)
  const totalMonthlyContributions = accounts.reduce((sum, acc) => sum + (acc.monthlyContribution || 0), 0)

  const renderPage = () => {
    switch (activePage) {
      case "overview":
        return (
          <OverviewPage
            projection={projection}
            simulationResult={simulationResult}
            isSimulating={isSimulating}
            retirementAge={personalInfo.retirementAge}
            currentAge={personalInfo.currentAge}
            lifeExpectancy={personalInfo.lifeExpectancy}
            inflationRate={retirementGoals.inflationRate}
            totalCurrentBalance={totalCurrentBalance}
            totalMonthlyContributions={totalMonthlyContributions}
            desiredMonthlyIncome={retirementGoals.desiredMonthlyIncome}
            annualIncome={personalInfo.annualIncome}
          />
        )
      case "accounts":
        return <AccountsPage />
      case "plan":
        return (
          <PlanPage
            projection={projection}
            yearsToRetirement={personalInfo.retirementAge - personalInfo.currentAge}
            displayMode={displayMode}
            inflationRate={assumptions.inflationRate / 100}
          />
        )
      case "expenses":
        return <ExpensesPage />
      case "projections":
        return <ProjectionsPage projection={projection} />
      case "settings":
        return <SettingsPage projection={projection} />
    }
  }

  return (
    <>
      <AppShell
        activePage={activePage}
        onNavigate={setActivePage}
        accountCount={accounts.length}
        user={user}
        displayMode={displayMode}
        onSetDisplayMode={setDisplayMode}
      >
        {renderPage()}
      </AppShell>
      <DebugWindow projection={projection} simulationResult={simulationResult} />
    </>
  )
}
