"use client"

import { SA_DEFAULTS, SA_DEFAULTS_DISPLAY } from "@/lib/constants/defaults"
import type {
  Account,
  DrawdownConfig,
  MarketAssumptions,
  PersonalInfo,
  RetirementGoals,
} from "@/types"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createGatedPersistStorage } from "@/lib/store/persist-gate"
import { clampMonetaryAmount } from "@/lib/utils/monetary"
import { sanitizeAssumptionRate } from "@/lib/utils/assumption-rates"

export const CALCULATOR_STORAGE_KEY = "financial-planner-storage"

// See persist-gate.ts: writes are held back until the first rehydrate() settles,
// so an early set() can never clobber the user's saved plan with the defaults.
type PersistedCalculatorState = {
  personalInfo: PersonalInfo
  assumptions: MarketAssumptions
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
}
const storage = createGatedPersistStorage<PersistedCalculatorState>()

export interface CalculatorState {
  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"

  addAccount: (account: Account) => void
  seedAccounts: (accounts: Omit<Account, "id">[]) => void
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
    taxThresholdRelief: "historical" as const,
  } as MarketAssumptions,
  drawdownConfig: {
    strategy: "fixed_percentage" as const,
    initialWithdrawalRate: SA_DEFAULTS_DISPLAY.safeWithdrawalRate,
    minimumWithdrawal: 15000,
    maximumWithdrawal: 60000,
    lumpSumPercentage: 0,
    // Standard Guyton-Klinger guardrail bands (20% above/below the target rate)
    upperGuardrail: 20,
    lowerGuardrail: 20,
  } as DrawdownConfig,
  displayMode: "nominal" as const,
}

type PlanShape = Pick<
  CalculatorState,
  "personalInfo" | "retirementGoals" | "assumptions" | "drawdownConfig" | "accounts"
> &
  Partial<Pick<CalculatorState, "displayMode">>

/**
 * Clamps/sanitises a plan loaded from anywhere untrusted — an older persisted
 * payload (migrate) or an imported backup file (plan-io). Idempotent. Exported so
 * both callers share ONE implementation instead of drifting apart.
 */
export function sanitizePlan<T extends Partial<PlanShape>>(s: T) {
  const defaults = defaultSettings.assumptions
  const assumptions = s.assumptions ?? defaults
  return {
    ...s,
    displayMode: s.displayMode === "real" ? ("real" as const) : ("nominal" as const),
    assumptions: {
      ...assumptions,
      equityReturn: sanitizeAssumptionRate(
        assumptions.equityReturn,
        "equityReturn",
        defaults.equityReturn,
      ),
      bondReturn: sanitizeAssumptionRate(assumptions.bondReturn, "bondReturn", defaults.bondReturn),
      cashReturn: sanitizeAssumptionRate(assumptions.cashReturn, "cashReturn", defaults.cashReturn),
      inflationRate: sanitizeAssumptionRate(
        assumptions.inflationRate,
        "inflationRate",
        defaults.inflationRate,
      ),
    },
    personalInfo: {
      ...s.personalInfo,
      annualIncome: clampMonetaryAmount(s.personalInfo?.annualIncome ?? 0),
    },
    retirementGoals: {
      ...s.retirementGoals,
      inflationRate: sanitizeAssumptionRate(
        s.retirementGoals?.inflationRate,
        "inflationRate",
        defaultSettings.retirementGoals.inflationRate,
      ),
      desiredMonthlyIncome: clampMonetaryAmount(s.retirementGoals?.desiredMonthlyIncome ?? 0),
      legacyAmount: clampMonetaryAmount(s.retirementGoals?.legacyAmount ?? 0),
    },
    drawdownConfig: {
      ...s.drawdownConfig,
      minimumWithdrawal: clampMonetaryAmount(s.drawdownConfig?.minimumWithdrawal ?? 0),
      maximumWithdrawal: clampMonetaryAmount(s.drawdownConfig?.maximumWithdrawal ?? 0),
      monthlyMedicalAid:
        s.drawdownConfig?.monthlyMedicalAid == null
          ? undefined
          : clampMonetaryAmount(s.drawdownConfig.monthlyMedicalAid),
    },
    accounts: (s.accounts ?? []).map((a) => ({
      ...a,
      currentBalance: clampMonetaryAmount(a.currentBalance ?? 0),
      monthlyContribution: clampMonetaryAmount(a.monthlyContribution ?? 0),
      tfsaContributionsToDate:
        a.tfsaContributionsToDate == null
          ? undefined
          : clampMonetaryAmount(a.tfsaContributionsToDate),
    })),
  }
}

const initialState = {
  accounts: [] as Account[],
  ...defaultSettings,
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      ...initialState,

      addAccount: (account) => set((state) => ({ accounts: [...state.accounts, account] })),

      seedAccounts: (accounts) =>
        set({ accounts: accounts.map((account) => ({ ...account, id: crypto.randomUUID() })) }),

      updateAccount: (id, updates) =>
        set((state) => ({
          accounts: state.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)),
        })),

      removeAccount: (id) =>
        set((state) => ({ accounts: state.accounts.filter((acc) => acc.id !== id) })),

      setPersonalInfo: (info) =>
        set((state) => ({ personalInfo: { ...state.personalInfo, ...info } })),

      setRetirementGoals: (goals) =>
        set((state) => ({ retirementGoals: { ...state.retirementGoals, ...goals } })),

      setAssumptions: (assumptions) =>
        set((state) => ({ assumptions: { ...state.assumptions, ...assumptions } })),

      setDrawdownConfig: (config) =>
        set((state) => ({ drawdownConfig: { ...state.drawdownConfig, ...config } })),

      setDisplayMode: (mode) => set({ displayMode: mode }),

      resetToDefaults: () => set({ ...initialState }),

      loadPlan: (plan) =>
        set({
          personalInfo: plan.personalInfo,
          retirementGoals: plan.retirementGoals,
          assumptions: plan.assumptions,
          drawdownConfig: plan.drawdownConfig,
          displayMode: plan.displayMode,
          accounts: plan.accounts,
        }),
    }),
    {
      name: CALCULATOR_STORAGE_KEY,
      storage,
      skipHydration: true,
      // v4: the scenario machinery is gone. A v3 payload still carries
      // `activeScenarioId`; zustand's default merge would resurrect it as a stray
      // key on the live state, so migrate drops it.
      version: 4,
      // Sanitize monetary fields persisted before the input bounds fix (R1 trillion
      // cap): stale absurd values are clamped on rehydrate so they can neither break
      // layout nor poison calculations. Version 1 data predates the cap.
      // Version 2 data may hold invalid Market Assumptions rates: before the form
      // validated (issue #34) a cleared field persisted as null and any typed value was
      // stored. Those are reset to the defaults. Every step is idempotent, so the whole
      // function runs for any older version.
      onRehydrateStorage: () => () => storage?.release(),
      migrate: (persistedState) => {
        const { activeScenarioId: _legacyScenarioId, ...s } =
          persistedState as Partial<PlanShape> & {
            activeScenarioId?: unknown
          }
        return sanitizePlan(s) as PersistedCalculatorState
      },
      partialize: (state): PersistedCalculatorState => ({
        personalInfo: state.personalInfo,
        assumptions: state.assumptions,
        retirementGoals: state.retirementGoals,
        drawdownConfig: state.drawdownConfig,
        displayMode: state.displayMode,
        accounts: state.accounts,
      }),
    },
  ),
)
