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
import { createGatedPersistStorage } from "@/lib/store/persist-gate"
import {
  evictUserScopedKeys,
  registerStorageBaseName,
  setScope,
  type PersistenceScope,
} from "@/lib/store/persistence-scope"
import { clampMonetaryAmount } from "@/lib/utils/monetary"

// Sign-out must be able to evict this store's user-scoped keys.
registerStorageBaseName("financial-planner-storage")

// See persist-gate.ts: writes are held back until the first rehydrate() settles,
// so auth-driven set() calls that race the layout's manual rehydrate can never
// clobber the user's persisted plan with the pre-hydration defaults.
// NOTE: `identity` is deliberately NOT persisted — the storage key encodes the
// scope (see persistence-scope.ts), so the payload needs no owner marker.
type PersistedCalculatorState = {
  activeScenarioId: string | null
  personalInfo: PersonalInfo
  assumptions: MarketAssumptions
  retirementGoals: RetirementGoals
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
}
const storage = createGatedPersistStorage<PersistedCalculatorState>()

let scenarioSyncTimer: ReturnType<typeof setTimeout> | null = null
// Per-(userId, generation) in-flight sync map: a re-run for the same identity
// does not duplicate fetches; a newer generation supersedes an older one.
const dbSyncInFlight = new Map<string, Promise<void>>()
let latestGeneration = 0

function scheduleScenarioSync() {
  if (scenarioSyncTimer) clearTimeout(scenarioSyncTimer)
  // Capture the owner + scenario at schedule time; re-check both at fire time
  // so a debounced write can never land under a different user or scenario.
  const { identity, activeScenarioId } = useCalculatorStore.getState()
  const userId = identity.kind === "user" ? identity.userId : null
  scenarioSyncTimer = setTimeout(() => {
    scenarioSyncTimer = null
    const current = useCalculatorStore.getState()
    const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
    if (currentUserId !== userId || current.activeScenarioId !== activeScenarioId) return
    if (!activeScenarioId) return
    updateScenario(activeScenarioId, {
      personalInfo: current.personalInfo,
      retirementGoals: current.retirementGoals,
      assumptions: current.assumptions,
      drawdownConfig: current.drawdownConfig,
      displayMode: current.displayMode,
    }).catch(console.error)
  }, 800)
}

export interface CalculatorState {  accounts: Account[]
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  identity: PersistenceScope
  activeScenarioId: string | null
  scenarioList: ScenarioMeta[]
  displayMode: "nominal" | "real"

  setIdentity: (scope: PersistenceScope) => void
  syncFromDb: (userId: string, generation?: number) => Promise<void>
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
    // Standard Guyton-Klinger guardrail bands (20% above/below the target rate)
    upperGuardrail: 20,
    lowerGuardrail: 20,
  } as DrawdownConfig,
  displayMode: "nominal" as const,
}

const initialState = {
  accounts: [] as Account[],
  identity: { kind: "guest" } as PersistenceScope,
  activeScenarioId: null as string | null,
  scenarioList: [] as ScenarioMeta[],
  ...defaultSettings,
}

export const useCalculatorStore = create<CalculatorState>()(
  persist(
    (set) => ({
      ...initialState,

      setIdentity: (scope) => {
        const prev = useCalculatorStore.getState().identity
        set({ identity: scope })
        // Sign-out transition: clear scenario metadata, cancel pending timers,
        // switch persistence back to the guest scope, and evict the signed-out
        // user's scoped keys so a shared device does not accumulate every past
        // account's plan. Sign-in sets the user scope before loading server data
        // (handled by the coordinator's hydrateUserScope), so only the guest
        // transition needs the scope switch here.
        if (scope.kind === "guest" && prev.kind === "user") {
          if (scenarioSyncTimer) {
            clearTimeout(scenarioSyncTimer)
            scenarioSyncTimer = null
          }
          set({ activeScenarioId: null, scenarioList: [] })
          setScope({ kind: "guest" })
          evictUserScopedKeys(prev.userId)
        }
      },

      // userId + generation are explicit: the coordinator passes the transition
      // generation so a late response (a fetch already in flight when the
      // transition was superseded) can be dropped at the store, not just by
      // actor cancellation. The in-flight entry is registered BEFORE the async
      // body runs so a synchronous early-return (guest identity) cannot leave a
      // stale completed promise behind.
      syncFromDb: (userId: string, generation = 0) => {
        const key = `${userId}:${generation}`
        const existing = dbSyncInFlight.get(key)
        if (existing) return existing

        latestGeneration = Math.max(latestGeneration, generation)

        const promise = Promise.resolve().then(async () => {
          try {
            // The requested user must still own the store — a guest or another
            // user must never read under this identity.
            const before = useCalculatorStore.getState()
            if (before.identity.kind !== "user" || before.identity.userId !== userId) return

            const scenarios = await listScenarios(userId)

            // Stale check before committing: the same user must still own the
            // store, and no newer generation may have superseded this one.
            const current = useCalculatorStore.getState()
            const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
            if (currentUserId !== userId || generation < latestGeneration) return

            if (scenarios.length === 0) {
              // Claiming is owned by claimLocalData(), called from SupabaseProvider on
              // sign-in. syncFromDb must not create scenarios — two code paths creating
              // "My Plan" is how duplicate plans appear.
              set({ activeScenarioId: null, scenarioList: [] })
              return
            }

            // Pick previously active scenario if still exists, else most recent
            const targetId =
              current.activeScenarioId && scenarios.find((s) => s.id === current.activeScenarioId)
                ? current.activeScenarioId
                : scenarios[0].id

            const [data, accounts] = await Promise.all([
              fetchScenario(targetId),
              fetchAccounts(targetId),
            ])
            if (data) set({ ...data, accounts, activeScenarioId: targetId, scenarioList: scenarios })
            else set({ accounts: [], activeScenarioId: scenarios[0].id, scenarioList: scenarios })
          } finally {
            dbSyncInFlight.delete(key)
          }
        })
        dbSyncInFlight.set(key, promise)
        return promise
      },

      addAccount: (account) => {
        const { identity, activeScenarioId } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null
        set((state) => ({ accounts: [...state.accounts, account] }))
        // Re-check owner + scenario immediately before the request.
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (activeScenarioId && currentUserId === userId && current.activeScenarioId === activeScenarioId) {
          upsertAccount(account, activeScenarioId).catch(console.error)
        }
      },

      seedAccounts: (accounts) => {
        const seeded = accounts.map((account) => ({ ...account, id: crypto.randomUUID() }))
        const { identity, activeScenarioId, accounts: existingAccounts } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null

        set({ accounts: seeded })

        // Capture owner + scenario before scheduling; the async chain re-checks
        // before any request so a sign-out mid-chain cannot delete/insert under
        // a previous user's identity.
        if (activeScenarioId) {
          Promise.all(existingAccounts.map((account) => deleteAccount(account.id)))
            .then(() => {
              const current = useCalculatorStore.getState()
              const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
              if (currentUserId !== userId || current.activeScenarioId !== activeScenarioId) return []
              return Promise.all(seeded.map((account) => upsertAccount(account, activeScenarioId)))
            })
            .catch(console.error)
        }
      },

      updateAccount: (id, updates) => {
        const { identity, activeScenarioId } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null
        set((state) => ({
          accounts: state.accounts.map((acc) => (acc.id === id ? { ...acc, ...updates } : acc)),
        }))
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (activeScenarioId && currentUserId === userId && current.activeScenarioId === activeScenarioId) {
          const updated = current.accounts.find((a) => a.id === id)
          if (updated) upsertAccount(updated, activeScenarioId).catch(console.error)
        }
      },

      removeAccount: (id) => {
        const { identity } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null
        set((state) => ({ accounts: state.accounts.filter((acc) => acc.id !== id) }))
        // Only delete remotely while the account still belongs to the current user.
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (currentUserId === userId && userId != null) {
          deleteAccount(id).catch(console.error)
        }
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
        const { identity, activeScenarioId } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null

        set({
          personalInfo: plan.personalInfo,
          retirementGoals: plan.retirementGoals,
          assumptions: plan.assumptions,
          drawdownConfig: plan.drawdownConfig,
          displayMode: plan.displayMode,
          accounts: plan.accounts,
        })
        // Re-check owner + scenario before any remote write.
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (activeScenarioId && currentUserId === userId && current.activeScenarioId === activeScenarioId) {
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
        const { identity, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts } =
          useCalculatorStore.getState()
        const sessionId = identity.kind === "user" ? identity.userId : null
        if (!sessionId) return
        // Re-check the owner before the request (sign-out between the capture
        // and the await would otherwise create a scenario for a stale identity).
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (currentUserId !== sessionId) return
        const scenarioId = await createScenario(sessionId, name, {
          personalInfo,
          retirementGoals,
          assumptions,
          drawdownConfig,
          displayMode,
        })
        // Clone current accounts into the new scenario so it starts as an independent copy
        const cloned = await cloneAccounts(accounts, scenarioId)
        const meta: ScenarioMeta = { id: scenarioId, name, updatedAt: new Date().toISOString(), claimComplete: true }
        set((state) => ({
          activeScenarioId: scenarioId,
          scenarioList: [meta, ...state.scenarioList],
          accounts: cloned,
        }))
      },

      renameScenario: async (id, name) => {
        const { identity } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null
        if (!userId) return
        await renameScenarioInDb(id, name)
        // Only mutate local list while the same user still owns the store.
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (currentUserId !== userId) return
        set((state) => ({
          scenarioList: state.scenarioList.map((s) => (s.id === id ? { ...s, name } : s)),
        }))
      },

      deleteScenario: async (id) => {
        const { scenarioList, activeScenarioId, identity } = useCalculatorStore.getState()
        const userId = identity.kind === "user" ? identity.userId : null
        if (scenarioList.length <= 1) return
        const current = useCalculatorStore.getState()
        const currentUserId = current.identity.kind === "user" ? current.identity.userId : null
        if (currentUserId !== userId) return
        await deleteScenarioFromDb(id) // CASCADE deletes accounts for this scenario too
        // Re-check after the await: a sign-out or user switch mid-delete must
        // not mutate local state owned by the previous identity.
        const after = useCalculatorStore.getState()
        const afterUserId = after.identity.kind === "user" ? after.identity.userId : null
        if (afterUserId !== userId) return
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
      name: "financial-planner-storage",
      storage,
      skipHydration: true,
      version: 2,
      onRehydrateStorage: () => () => storage?.release(),
      // Sanitize monetary fields persisted before the input bounds fix (R1 trillion
      // cap): stale absurd values are clamped on rehydrate so they can neither break
      // layout nor poison calculations. Version 1 data predates the cap.
      migrate: (persistedState) => {
        const s = persistedState as CalculatorState
        return {
          ...s,
          personalInfo: {
            ...s.personalInfo,
            annualIncome: clampMonetaryAmount(s.personalInfo?.annualIncome ?? 0),
          },
          retirementGoals: {
            ...s.retirementGoals,
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
      },
      partialize: (state) => ({
        // NOTE: identity is deliberately NOT persisted — the storage key
        // encodes the scope, so the payload needs no owner marker.
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
