"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useCalculatorStore } from "@/lib/store/calculator-store"

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const setSessionId = useCalculatorStore((s) => s.setSessionId)
  const syncAccountsFromDb = useCalculatorStore((s) => s.syncAccountsFromDb)
  const sessionId = useCalculatorStore((s) => s.sessionId)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        if (session.user.id !== sessionId) {
          setSessionId(session.user.id)
          await syncAccountsFromDb()
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
        await syncAccountsFromDb()
      }
    }

    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return <>{children}</>
}
