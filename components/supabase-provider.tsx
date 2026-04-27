"use client"

import { useEffect } from "react"
import { createClient, SUPABASE_ENABLED } from "@/lib/supabase/client"
import { useCalculatorStore } from "@/lib/store/calculator-store"

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setSessionId = useCalculatorStore((s) => s.setSessionId)
  const syncAccountsFromDb = useCalculatorStore((s) => s.syncAccountsFromDb)
  const syncScenarioFromDb = useCalculatorStore((s) => s.syncScenarioFromDb)
  const sessionId = useCalculatorStore((s) => s.sessionId)

  useEffect(() => {
    if (!SUPABASE_ENABLED) return

    const supabase = createClient()!

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
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
        setSessionId(data.user.id)
        await Promise.all([syncAccountsFromDb(), syncScenarioFromDb()])
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
