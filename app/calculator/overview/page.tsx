"use client"

import { OverviewPage } from "@/components/pages/overview-page"
import { useCalculator } from "@/lib/context/calculator-context"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useShallow } from "zustand/react/shallow"

export default function OverviewRoute() {
  const { projection, simulationResult, isSimulating } = useCalculator()
  const { personalInfo, retirementGoals, accounts } = useCalculatorStore(
    useShallow((s) => ({
      personalInfo: s.personalInfo,
      retirementGoals: s.retirementGoals,
      accounts: s.accounts,
    }))
  )

  const totalCurrentBalance = accounts.reduce((sum, acc) => sum + (acc.currentBalance || 0), 0)
  const totalMonthlyContributions = accounts.reduce((sum, acc) => sum + (acc.monthlyContribution || 0), 0)

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
      hasAccounts={accounts.length > 0}
    />
  )
}
