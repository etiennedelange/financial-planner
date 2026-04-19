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
import { upsertAccount, deleteAccount, fetchAccounts } from "@/lib/supabase/accounts"

interface CalculatorState {
  // Data
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig

  // Session
  sessionId: string | null

  // UI Preferences
  displayMode: 'nominal' | 'real'

  // Actions
  setSessionId: (id: string) => void
  syncAccountsFromDb: () => Promise<void>
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
  sessionId: null as string | null,
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

      setSessionId: (id) => set({ sessionId: id }),

      syncAccountsFromDb: async () => {
        const { sessionId } = useCalculatorStore.getState()
        if (!sessionId) return
        const accounts = await fetchAccounts(sessionId)
        set({ accounts })
      },

      addAccount: (account) => {
        set((state) => ({ accounts: [...state.accounts, account] }))
        const { sessionId } = useCalculatorStore.getState()
        if (sessionId) upsertAccount(account, sessionId).catch(console.error)
      },

      updateAccount: (id, updates) => {
        set((state) => ({
          accounts: state.accounts.map((acc) =>
            acc.id === id ? { ...acc, ...updates } : acc
          ),
        }))
        const { sessionId, accounts } = useCalculatorStore.getState()
        if (sessionId) {
          const updated = accounts.find((a) => a.id === id)
          if (updated) upsertAccount(updated, sessionId).catch(console.error)
        }
      },

      removeAccount: (id) => {
        set((state) => ({
          accounts: state.accounts.filter((acc) => acc.id !== id),
        }))
        deleteAccount(id).catch(console.error)
      },

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
