"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

export function SessionList() {
  const [sessions, setSessions] = useState<Array<{
    id: string
    updated_at: string
    user_agent: string | null
    ip: string | null
    is_current: boolean
  }>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().rpc("my_sessions").then(({ data, error: rpcError }) => {
      if (rpcError) setError("Could not load your active sessions.")
      else setSessions(data ?? [])
    })
  }, [])

  async function signOutEverywhere() {
    await createClient().auth.signOut({ scope: "global" })
    window.location.href = "/calculator"
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>

  return (
    <div className="space-y-3 max-w-lg">
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {s.user_agent ?? "Unknown device"}
                {s.is_current && <span className="ml-2 text-primary">This device</span>}
              </p>
              <p className="text-sm text-muted-foreground">
                {s.ip ?? "unknown IP"} · last active {new Date(s.updated_at).toLocaleString("en-ZA")}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" size="sm" onClick={signOutEverywhere}>
        Sign Out Everywhere
      </Button>
    </div>
  )
}
