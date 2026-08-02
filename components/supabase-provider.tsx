"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { migrateExpensesToSession } from "@/lib/supabase/expenses"
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)

      if (newUser && newUser.id !== useCalculatorStore.getState().sessionId) {
        // Capture expenses from Zustand BEFORE syncExpensesFromDb overwrites the store.
        // If this is an anon→real sign-in, we'll copy them to the new session in the DB.
        const { groups, expenses } = useExpensesStore.getState()
        const isAnonUpgrade = !newUser.is_anonymous && groups.length > 0

        setSessionId(newUser.id)
        await syncFromDb()

        if (isAnonUpgrade) {
          await migrateExpensesToSession(newUser.id, groups, expenses).catch(console.error)
        }

        await syncExpensesFromDb(newUser.id)
      }
      // On SIGNED_OUT: user becomes null, UserMenu shows "Sign In".
      // A new anon session is created on the next page load via init().
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={{ user, isLoaded }}>{children}</AuthContext.Provider>
}
