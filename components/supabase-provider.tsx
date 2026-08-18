"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createBootstrapCoordinator } from "@/lib/auth/bootstrap-coordinator"
import type { AuthEvent, AuthEventType, BootstrapDependencies } from "@/lib/auth/bootstrap-machine"
import { currentAal } from "@/lib/auth/mfa"
import { createClient } from "@/lib/supabase/client"
import { claimLocalData } from "@/lib/supabase/claim"
import { setScope } from "@/lib/store/persistence-scope"
import {
  migrateLegacyKeys,
  readAmbiguousLegacyStates,
  adoptAmbiguousLegacy,
  discardAmbiguousLegacy,
  type AmbiguousLegacyState,
} from "@/lib/store/legacy-scope-migration"
import { LegacyLocalPlanPrompt } from "@/components/auth/legacy-local-plan-prompt"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useExpensesStore } from "@/lib/store/expenses-store"
import type { BootstrapPhase } from "@/lib/auth/bootstrap-machine"

interface AuthContextValue {
  user: User | null
  phase: BootstrapPhase
  error: Error | null
  isLoaded: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  phase: "idle",
  error: null,
  isLoaded: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

// One browser client per page load, created lazily: the coordinator's actors
// (which start after the effect registers the listener) and the listener itself
// must share the same instance so auth state stays consistent between them.
let supabaseClient: ReturnType<typeof createClient> | null = null
function getSupabase() {
  if (!supabaseClient) supabaseClient = createClient()
  return supabaseClient
}

/**
 * SupabaseProvider is the single bootstrap owner.
 *
 * All hydration, auth verification, MFA gating, claim, and server sync run inside
 * one XState coordinator (lib/auth/bootstrap-coordinator.ts). The auth listener
 * registered here is a pure forwarder: it captures only the event type and whether
 * a session exists, and enqueues it into the coordinator. It must never call a
 * Supabase method, call a store, or mutate React state — anything asynchronous
 * happens inside the coordinator's actors, after the callback has returned.
 */
export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ambiguousLegacy, setAmbiguousLegacy] = useState<AmbiguousLegacyState[]>([])

  // The coordinator is created once per provider instance. Its dependencies
  // close over setUser (stable) and the store getState functions (stable), and
  // rehydrate/persist helpers that are safe to reference at any time.
  const coordinator = useMemo(() => {
    const supabase = getSupabase()
    const dependencies: BootstrapDependencies = {
      // One-time legacy un-scoped key migration + guest scope + store hydration.
      // Runs pre-auth: a legacy payload is routed by the sessionId inside its
      // own payload, so no identity is needed. The machine's hydratingGuest
      // capture handler guarantees an early auth event cannot cancel it.
      hydrateGuestScope: async () => {
        // New migration this load, plus any holding-area payloads parked by an
        // earlier load before the user made a choice.
        migrateLegacyKeys()
        setAmbiguousLegacy(readAmbiguousLegacyStates())
        setScope({ kind: "guest" })
        await Promise.all([
          useCalculatorStore.persist.rehydrate(),
          useExpensesStore.persist.rehydrate(),
        ])
      },
      // Second, user-scoped hydration: set the user scope (which re-closes the
      // write gate on every store instance) then rehydrate both stores.
      hydrateUserScope: async (userId: string) => {
        setScope({ kind: "user", userId })
        await Promise.all([
          useCalculatorStore.persist.rehydrate(),
          useExpensesStore.persist.rehydrate(),
        ])
      },
      getUser: async () => {
        // getUser() verifies the token with the auth server.
        // getSession() trusts the cookie unverified — do not substitute it.
        const { data } = await supabase.auth.getUser()
        return data.user
      },
      currentAal,
      applyAuthTransition: async (event: AuthEvent) => {
        // The listener only forwards event type + session presence; the verified
        // user is resolved here, outside the auth callback (never await Supabase
        // inside onAuthStateChange — it deadlocks against its own init promise).
        const current =
          event.userId != null ? (await supabase.auth.getUser()).data.user : null

        setUser(current)

        if (!current) {
          // Signed out: the app runs entirely from localStorage.
          // Both stores no-op their DB writes while identity is guest.
          useCalculatorStore.getState().setIdentity({ kind: "guest" })
          return
        }
        const scope = { kind: "user", userId: current.id } as const
        useCalculatorStore.getState().setIdentity(scope)
        useExpensesStore.getState().setIdentity(scope)
      },
      claimLocalData: async (userId: string, source: "guest" | "user" | "legacy-unknown") => {
        // Snapshot local state BEFORE any sync overwrites it. The coordinator
        // calls claim before sync (never concurrently). The source is the
        // ownership claim — the coordinator only ever claims guest-owned
        // startup snapshots, and claim.ts rejects any other source.
        const calc = useCalculatorStore.getState()
        const exp = useExpensesStore.getState()
        await claimLocalData(
          userId,
          {
            personalInfo: calc.personalInfo,
            retirementGoals: calc.retirementGoals,
            assumptions: calc.assumptions,
            drawdownConfig: calc.drawdownConfig,
            displayMode: calc.displayMode,
            accounts: calc.accounts,
            expenseGroups: exp.groups,
            expenses: exp.expenses,
          },
          source
        )
      },
      syncFromDb: async (userId: string, generation: number) => {
        await useCalculatorStore.getState().syncFromDb(userId, generation)
        await useExpensesStore.getState().syncFromDb(userId, generation)
      },
      syncExpensesFromDb: async (userId: string, generation: number) => {
        await useExpensesStore.getState().syncFromDb(userId, generation)
      },
    }
    return createBootstrapCoordinator(dependencies)
  }, [])

  const [phase, setPhase] = useState<BootstrapPhase>("idle")
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const supabase = getSupabase()

    // Register the listener BEFORE starting the coordinator: supabase-js's
    // INITIAL_SESSION typically arrives while the guest hydration is still
    // running, and the machine captures it (never cancelling the hydration).
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const type = event as AuthEventType
      coordinator.enqueueAuthEvent({
        type,
        userId: session?.user?.id ?? null,
        hasSession: session != null,
      })
    })

    // Start the coordinator after listener registration. StrictMode's double
    // effect shares the cached startup promise (see bootstrap-coordinator.ts).
    coordinator.start().catch((err) => {
      console.error("Bootstrap failed:", err)
    })

    const unsubscribe = coordinator.subscribe((state) => {
      setPhase(state.phase)
      setError(state.error)
    })

    return () => {
      subscription.unsubscribe()
      unsubscribe()
    }
  }, [coordinator])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      phase,
      error,
      isLoaded: phase === "ready",
    }),
    [user, phase, error]
  )

  const handleUseLocalPlan = () => {
    // Convert the ambiguous legacy states into the guest scope, then let the
    // normal claim path (on the next sign-in) carry them into the account.
    setScope({ kind: "guest" })
    for (const state of ambiguousLegacy) adoptAmbiguousLegacy(state)
    void Promise.all([
      useCalculatorStore.persist.rehydrate(),
      useExpensesStore.persist.rehydrate(),
    ])
    setAmbiguousLegacy([])
  }

  const handleKeepAccountData = () => {
    for (const state of ambiguousLegacy) discardAmbiguousLegacy(state)
    setAmbiguousLegacy([])
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LegacyLocalPlanPrompt
        open={ambiguousLegacy.length > 0}
        states={ambiguousLegacy}
        onUseLocalPlan={handleUseLocalPlan}
        onKeepAccountData={handleKeepAccountData}
      />
    </AuthContext.Provider>
  )
}
