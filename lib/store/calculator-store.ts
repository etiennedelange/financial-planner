"use client"

import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import { cloneAccounts, deleteAccount, fetchAccounts, upsertAccount } from "@/lib/supabase/accounts"
import {
  createScenario,
  deleteScenario as deleteScenarioFromDb,
  fetchScenario,
  listScenarios,
  renameScenario as renameScenarioInDb,
  updateScenario,
  type ScenarioMeta,
} from "@/lib/supabase/scenarios"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  RetirementGoals,
} from "@/types"
import { create } from "zustand"
import { persist } from "zustand/middleware"

let scenarioSyncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleScenarioSync() {
  if (scenarioSyncTimer) clearTimeout(scenarioSyncTimer)
  scenarioSyncTimer = setTimeout(() => {
    const { activeScenarioId, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode } =
      useCalculatorStore.getState()
    if (!activeScenarioId) return
    updateScenario(activeScenarioId, {
      personalInfo,
      retirementGoals,
      assumptions,
      drawdownConfig,
      displayMode,
    }).catch(console.error)
  }, 800)
}

interface CalculatorState {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  sessionId: string | null
  activeScenarioId: string | null
  scenarioList: ScenarioMeta[]
  displayMode: "nominal" | "real"

  setSessionId: (id: string) => void
  syncFromDb: () => Promise<void>
  addAccount: (account: Account) => void
  updateAccount: (id: string, account: Partial<Account>) => void
  removeAccount: (id: string) => void
  setPersonalInfo: (info: Partial<PersonalInfo>) => void
  setRetirementGoals: (goals: Partial<RetirementGoals>) => void
  setAssumptions: (assumptions: Partial<MarketAssumptions>) => void
  setDrawdownConfig: (config: Partial<DrawdownConfig>) => void
  setDisplayMode: (mode: "nominal" | "real") => void
  resetToDefaults: () => void
  loadPlan: (plan: {
    personalInfo: PersonalInfo
    retirementGoals: RetirementGoals
    assumptions: MarketAssumptions
    drawdownConfig: DrawdownConfig
    displayMode: "nominal" | "real"
    accounts: Account[]
  }) => void
  switchScenario: (id: string) => Promise<void>
  createNewScenario: (name: string) => Promise<void>
  renameScenario: (id: string, name: string) => Promise<void>
  deleteScenario: (id: string) => Promise<void>
}

const defaultSettings = {
  personalInfo: {
    currentAge: SA_DEFAULTS.defaultCurrentAge,
    retirementAge: SA_DEFAULTS.defaultRetirementAge,
    lifeExpectancy: SA_DEFAULTS.lifeExpectancy,
    annualIncome: 600000,
  } as PersonalInfo,
  retirementGoals: {
    desiredMonthlyIncome: 30000,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
    legacyAmount: 0,
  } as RetirementGoals,
  assumptions: {
    equityReturn: SA_DEFAULTS_DISPLAY.equityReturn,
    bondReturn: SA_DEFAULTS_DISPLAY.bondReturn,
    cashReturn: SA_DEFAULTS_DISPLAY.cashReturn,
    equityVolatility: SA_DEFAULTS_DISPLAY.equityVolatility,
    bondVolatility: SA_DEFAULTS_DISPLAY.bondVolatility,
    inflationRate: SA_DEFAULTS_DISPLAY.inflation,
    compoundingMethod: "nominal" as const,
  } as MarketAssumptions,
  drawdownConfig: {
    strategy: "fixed_percentage" as const,
    initialWithdrawalRate: SA_DEFAULTS_DISPLAY.safeWithdrawalRate,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
  } as DrawdownConfig,
  displayMode: "nominal" as const,
}

const initialState = {
  accounts: [] as Account[],
  sessionId: null as string | null,
  activeScenarioId: null as string | null,
  scenarioList: [] as ScenarioMeta[],
  ...defaultSettings,
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      ...initialState,

      setSessionId: (id) => set({ sessionId: id }),

      syncFromDb: async () => {
        const { sessionId, activeScenarioId } = useCalculatorStore.getState()
        if (!sessionId) return

        const scenarios = await listScenarios(sessionId)

        if (scenarios.length === 0) {
          // First sign-in: create scenario from current local state, clone local accounts into it
          const state = useCalculatorStore.getState()
          const scenarioId = await createScenario(sessionId, "My Plan", {
            personalInfo: state.personalInfo,
            retirementGoals: state.retirementGoals,
            assumptions: state.assumptions,
            drawdownConfig: state.drawdownConfig,
            displayMode: state.displayMode,
          })
          // Persist local accounts under the new scenario
          const cloned = await cloneAccounts(state.accounts, scenarioId)
          const meta: ScenarioMeta = { id: scenarioId, name: "My Plan", updatedAt: new Date().toISOString() }
          set({ activeScenarioId: scenarioId, scenarioList: [meta], accounts: cloned })
          return
        }

        // Pick previously active scenario if still exists, else most recent
        const targetId =
          activeScenarioId && scenarios.find((s) => s.id === activeScenarioId)
            ? activeScenarioId
            : scenarios[0].id

        const [data, accounts] = await Promise.all([
          fetchScenario(targetId),
          fetchAccounts(targetId),
        ])
        if (data) set({ ...data, accounts, activeScenarioId: targetId, scenarioList: scenarios })
        else set({ accounts: [], activeScenarioId: scenarios[0].id, scenarioList: scenarios })
      },

      addAccount: (account) => {
        set((state) => ({ accounts: [...state.accounts, account] }))
        const { activeScenarioId } = useCalculatorStore.getState()
        if (activeScenarioId) upsertAccount(account, activeScenarioId).catch(console.error)
      },

      updateAccount: (id, updates) => {
        set((state) => ({
          accounts: state.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)),
        }))
        const { activeScenarioId, accounts } = useCalculatorStore.getState()
        if (activeScenarioId) {
          const updated = accounts.find((a) => a.id === id)
          if (updated) upsertAccount(updated, activeScenarioId).catch(console.error)
        }
      },

      removeAccount: (id) => {
        set((state) => ({ accounts: state.accounts.filter((acc) => acc.id !== id) }))
        deleteAccount(id).catch(console.error)
      },

      setPersonalInfo: (info) => {
        set((state) => ({ personalInfo: { ...state.personalInfo, ...info } }))
        scheduleScenarioSync()
      },

      setRetirementGoals: (goals) => {
        set((state) => ({ retirementGoals: { ...state.retirementGoals, ...goals } }))
        scheduleScenarioSync()
      },

      setAssumptions: (assumptions) => {
        set((state) => ({ assumptions: { ...state.assumptions, ...assumptions } }))
        scheduleScenarioSync()
      },

      setDrawdownConfig: (config) => {
        set((state) => ({ drawdownConfig: { ...state.drawdownConfig, ...config } }))
        scheduleScenarioSync()
      },

      setDisplayMode: (mode) => {
        set({ displayMode: mode })
        scheduleScenarioSync()
      },

      resetToDefaults: () => set(initialState),

      loadPlan: (plan) => {
        set({
          personalInfo: plan.personalInfo,
          retirementGoals: plan.retirementGoals,
          assumptions: plan.assumptions,
          drawdownConfig: plan.drawdownConfig,
          displayMode: plan.displayMode,
          accounts: plan.accounts,
        })
        const { activeScenarioId } = useCalculatorStore.getState()
        if (activeScenarioId) {
          plan.accounts.forEach((acc) => upsertAccount(acc, activeScenarioId).catch(console.error))
          updateScenario(activeScenarioId, plan).catch(console.error)
        }
      },

      switchScenario: async (id) => {
        const [data, accounts] = await Promise.all([
          fetchScenario(id),
          fetchAccounts(id),
        ])
        if (data) set({ ...data, accounts, activeScenarioId: id })
      },

      createNewScenario: async (name) => {
        const { sessionId, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts } =
          useCalculatorStore.getState()
        if (!sessionId) return
        const scenarioId = await createScenario(sessionId, name, {
          personalInfo,
          retirementGoals,
          assumptions,
          drawdownConfig,
          displayMode,
        })
        // Clone current accounts into the new scenario so it starts as an independent copy
        const cloned = await cloneAccounts(accounts, scenarioId)
        const meta: ScenarioMeta = { id: scenarioId, name, updatedAt: new Date().toISOString() }
        set((state) => ({
          activeScenarioId: scenarioId,
          scenarioList: [meta, ...state.scenarioList],
          accounts: cloned,
        }))
      },

      renameScenario: async (id, name) => {
        await renameScenarioInDb(id, name)
        set((state) => ({
          scenarioList: state.scenarioList.map((s) => (s.id === id ? { ...s, name } : s)),
        }))
      },

      deleteScenario: async (id) => {
        const { scenarioList, activeScenarioId } = useCalculatorStore.getState()
        if (scenarioList.length <= 1) return
        await deleteScenarioFromDb(id) // CASCADE deletes accounts for this scenario too
        const remaining = scenarioList.filter((s) => s.id !== id)
        set({ scenarioList: remaining })
        if (id === activeScenarioId) {
          const next = remaining[0]
          const [data, accounts] = await Promise.all([
            fetchScenario(next.id),
            fetchAccounts(next.id),
          ])
          if (data) set({ ...data, accounts, activeScenarioId: next.id })
        }
      },
    }),
    {
      name: "retirement-calculator-storage",
      partialize: (state) => ({
        sessionId: state.sessionId,
        activeScenarioId: state.activeScenarioId,
        personalInfo: state.personalInfo,
        assumptions: state.assumptions,
        retirementGoals: state.retirementGoals,
        drawdownConfig: state.drawdownConfig,
        displayMode: state.displayMode,
        accounts: state.accounts,
      }),
    }
  )
)
