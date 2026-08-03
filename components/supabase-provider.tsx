"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { claimLocalData } from "@/lib/supabase/claim"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { useExpensesStore } from "@/lib/store/expenses-store"

interface AuthContext {
  user: User | null
  isLoaded: boolean
}

const AuthContext = createContext<AuthContext>({ user: null, isLoaded: false })

export function useAuth() {
  return useContext(AuthContext)
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setSessionId = useCalculatorStore((s) => s.setSessionId)
  const syncFromDb = useCalculatorStore((s) => s.syncFromDb)
  const sessionId = useCalculatorStore((s) => s.sessionId)
  const syncExpensesFromDb = useExpensesStore((s) => s.syncFromDb)

  const [user, setUser] = useState<User | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      try {
        // getUser() verifies the token with the auth server.
        // getSession() trusts the cookie unverified — do not substitute it.
        const { data: { user: current } } = await supabase.auth.getUser()

        if (!current) {
          // Signed out: the app runs entirely from localStorage.
          // Both stores no-op their DB writes while sessionId is null.
          setUser(null)
          setSessionId(null)
          return
        }

        setUser(current)
        if (current.id !== useCalculatorStore.getState().sessionId) {
          setSessionId(current.id)
        }
        await syncFromDb()
        await syncExpensesFromDb(current.id)
      } catch (err) {
        console.error("Supabase init failed:", err)
      } finally {
        setIsLoaded(true)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)

      if (!newUser) {
        setSessionId(null)
        return
      }
      if (newUser.id === useCalculatorStore.getState().sessionId) return

      // Snapshot local state BEFORE any sync overwrites it.
      const calc = useCalculatorStore.getState()
      const exp = useExpensesStore.getState()

      setSessionId(newUser.id)

      // Deferred: the Supabase client is still resolving its own internal
      // initialization while this callback runs (it's invoked from inside
      // `_recoverAndRefresh`/`_initialize`). Any call in here that awaits
      // another Supabase method (claimLocalData/syncFromDb go through
      // Postgrest, which fetches the session via the same client) would wait
      // on that same initialization promise and deadlock forever. Supabase's
      // own docs warn against awaiting Supabase calls inside
      // onAuthStateChange for this reason — defer with setTimeout instead.
      setTimeout(async () => {
        // A second auth event (e.g. rapid sign-out-then-sign-in as a different
        // user) may have already fired and moved sessionId on before this
        // deferred block runs — bail rather than write this stale snapshot
        // under a user the app has already left behind.
        if (useCalculatorStore.getState().sessionId !== newUser.id) return

        try {
          await claimLocalData(newUser.id, {
            personalInfo: calc.personalInfo,
            retirementGoals: calc.retirementGoals,
            assumptions: calc.assumptions,
            drawdownConfig: calc.drawdownConfig,
            displayMode: calc.displayMode,
            accounts: calc.accounts,
            expenseGroups: exp.groups,
            expenses: exp.expenses,
          })
        } catch (err) {
          // Local state is untouched; the next sign-in retries.
          console.error("Claiming local data failed:", err)
        }

        if (useCalculatorStore.getState().sessionId !== newUser.id) return
        await syncFromDb()
        await syncExpensesFromDb(newUser.id)
      }, 0)
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={{ user, isLoaded }}>{children}</AuthContext.Provider>
}
