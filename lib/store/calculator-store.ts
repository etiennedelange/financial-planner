"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type {
  Account,
  PersonalInfo,
  RetirementGoals,
  MarketAssumptions,
  DrawdownConfig,
} from "@/types"
import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"

interface CalculatorState {
  // Data
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig

  // UI Preferences
  displayMode: 'nominal' | 'real' // Show values in nominal or real (today's) terms

  // Actions
  addAccount: (account: Account) => void
  updateAccount: (id: string, account: Partial<Account>) => void
  removeAccount: (id: string) => void
  setPersonalInfo: (info: Partial<PersonalInfo>) => void
  setRetirementGoals: (goals: Partial<RetirementGoals>) => void
  setAssumptions: (assumptions: Partial<MarketAssumptions>) => void
  setDrawdownConfig: (config: Partial<DrawdownConfig>) => void
  setDisplayMode: (mode: 'nominal' | 'real') => void
  resetToDefaults: () => void
}

const initialState = {
  accounts: [] as Account[],
  personalInfo: {
    currentAge: SA_DEFAULTS.defaultCurrentAge,
    retirementAge: SA_DEFAULTS.defaultRetirementAge,
    lifeExpectancy: SA_DEFAULTS.lifeExpectancy,
    annualIncome: 600000,
  },
  retirementGoals: {
    desiredMonthlyIncome: 30000,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
    legacyAmount: 0,
  },
  assumptions: {
    equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
    bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
    cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
    equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility,
    bondVolatility: SA_DEFAULTS_DISPLAY.bondVolatility,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
    compoundingMethod: 'nominal' as const, // Default to Excel-compatible for backward compatibility
  },
  drawdownConfig: {
    strategy: "fixed_percentage" as const,
    initialWithdrawalRate: SA_DEFAULTS_DISPLAY.safeWithdrawalRate,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
  },
  displayMode: 'nominal' as const, // Default to showing nominal (future) values
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      ...initialState,

      addAccount: (account) =>
        set((state) => ({ accounts: [...state.accounts, account] })),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, ...updates } : acc
          ),
        })),

      removeAccount: (id) =>
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
        })),

      setPersonalInfo: (info) =>
        set((state) => ({
          personalInfo: { ...state.personalInfo, ...info },
        })),

      setRetirementGoals: (goals) =>
        set((state) => ({
          retirementGoals: { ...state.retirementGoals, ...goals },
        })),

      setAssumptions: (assumptions) =>
        set((state) => ({
          assumptions: { ...state.assumptions, ...assumptions },
        })),

      setDrawdownConfig: (config) =>
        set((state) => ({
          drawdownConfig: { ...state.drawdownConfig, ...config },
        })),

      setDisplayMode: (mode) => set({ displayMode: mode }),

      resetToDefaults: () => set(initialState),
    }),
    {
      name: "retirement-calculator-storage",
    }
  )
)

// Selector hooks for commonly accessed derived state
export function useAccountsSummary() {
  const accounts = useCalculatorStore((state) => state.accounts)

  const totalBalance = accounts.reduce((sum, acc) => sum + acc.currentBalance, 0)
  const totalMonthlyContribution = accounts.reduce(
    (sum, acc) => sum + acc.monthlyContribution,
    0
  )

  const weightedReturn =
    totalBalance > 0
      ? accounts.reduce(
          (sum, acc) =>
            sum + (acc.expectedReturn / 100) * (acc.currentBalance / totalBalance),
          0
        )
      : SA_DEFAULTS.equityReturn

  const weightedFees =
    totalBalance > 0
      ? accounts.reduce(
          (sum, acc) =>
            sum + (acc.annualFees / 100) * (acc.currentBalance / totalBalance),
          0
        )
      : 0.01

  return {
    totalBalance,
    totalMonthlyContribution,
    weightedReturn,
    weightedFees,
    accountCount: accounts.length,
  }
}
