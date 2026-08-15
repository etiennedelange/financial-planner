"use client"

import { createContext, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createBootstrapCoordinator } from "@/lib/auth/bootstrap-coordinator"
import type { AuthEvent, AuthEventType, BootstrapDependencies } from "@/lib/auth/bootstrap-machine"
import { currentAal } from "@/lib/auth/mfa"
import { createClient } from "@/lib/supabase/client"
import { claimLocalData } from "@/lib/supabase/claim"
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

  // The coordinator is created once per provider instance. Its dependencies
  // close over setUser (stable) and the store getState functions (stable), and
  // rehydrate/persist helpers that are safe to reference at any time.
  const coordinator = useMemo(() => {
    const supabase = getSupabase()
    const dependencies: BootstrapDependencies = {
      // Legacy-key migration + scope switching land in Task 3; until then the
      // guest hydration is the only hydration and reads the un-scoped keys.
      hydrateGuestScope: async () => {
        await Promise.all([
          useCalculatorStore.persist.rehydrate(),
          useExpensesStore.persist.rehydrate(),
        ])
      },
      // Task 3 makes this rehydrate user-scoped. Between Task 2 and Task 3 the
      // app hydrates exactly once into the un-scoped key (see plan: "Do not ship
      // from the Task 2 / Task 3 boundary").
      hydrateUserScope: async () => {},
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
          // Both stores no-op their DB writes while sessionId is null.
          useCalculatorStore.getState().setSessionId(null)
          return
        }
        useCalculatorStore.getState().setSessionId(current.id)
        useExpensesStore.getState().setSessionId(current.id)
      },
      claimLocalData: async (userId: string) => {
        // Snapshot local state BEFORE any sync overwrites it. The coordinator
        // calls claim before sync (never concurrently).
        const calc = useCalculatorStore.getState()
        const exp = useExpensesStore.getState()
        await claimLocalData(userId, {
          personalInfo: calc.personalInfo,
          retirementGoals: calc.retirementGoals,
          assumptions: calc.assumptions,
          drawdownConfig: calc.drawdownConfig,
          displayMode: calc.displayMode,
          accounts: calc.accounts,
          expenseGroups: exp.groups,
          expenses: exp.expenses,
        })
      },
      syncFromDb: async (userId: string) => {
        await useCalculatorStore.getState().syncFromDb()
        await useExpensesStore.getState().syncFromDb(userId)
      },
      syncExpensesFromDb: async (userId: string) => {
        await useExpensesStore.getState().syncFromDb(userId)
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

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
