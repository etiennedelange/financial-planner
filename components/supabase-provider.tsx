"use client"

import { createContext, useContext, useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient, SUPABASE_ENABLED } from "@/lib/supabase/client"
import { useCalculatorStore } from "@/lib/store/calculator-store"

interface AuthContext {
  user: User | null
}

const AuthContext = createContext<AuthContext>({ user: null })

export function useAuth() {
  return useContext(AuthContext)
}

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setSessionId = useCalculatorStore((s) => s.setSessionId)
  const syncAccountsFromDb = useCalculatorStore((s) => s.syncAccountsFromDb)
  const syncScenarioFromDb = useCalculatorStore((s) => s.syncScenarioFromDb)
  const sessionId = useCalculatorStore((s) => s.sessionId)

  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!SUPABASE_ENABLED) return

    const supabase = createClient()!

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        setUser(session.user)
        if (session.user.id !== sessionId) {
          setSessionId(session.user.id)
          await Promise.all([syncAccountsFromDb(), syncScenarioFromDb()])
        }
        return
      }

      const { data, error } = await supabase.auth.signInAnonymously()
      if (error) {
        console.error("Anonymous sign-in failed:", error.message)
        return
      }
      if (data.user) {
        setUser(data.user)
        setSessionId(data.user.id)
        await Promise.all([syncAccountsFromDb(), syncScenarioFromDb()])
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)

      if (newUser && newUser.id !== useCalculatorStore.getState().sessionId) {
        setSessionId(newUser.id)
        await Promise.all([syncAccountsFromDb(), syncScenarioFromDb()])
      }
      // On SIGNED_OUT: user becomes null, UserMenu shows "Sign In".
      // A new anon session is created on the next page load via init().
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <AuthContext.Provider value={{ user }}>{children}</AuthContext.Provider>
}
