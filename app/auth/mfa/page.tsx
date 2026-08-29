"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { listFactors, unenrollAbandonedFactors } from "@/lib/auth/mfa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"

export default function MfaChallengePage() {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mode, setMode] = useState<"totp" | "recovery">("totp")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const factorLoadPromiseRef = useRef<Promise<void> | null>(null)
  const factorIdRef = useRef<string | null>(null)

  useEffect(() => {
    // Keep the in-flight load awaitable from submit(): a click that lands
    // before the factor list resolves must wait for it, never silently drop.
    // factorIdRef mirrors state because submit's closure captures a stale
    // factorId if the load resolves after the click's render.
    factorLoadPromiseRef.current = listFactors()
      .then(async (factors) => {
        if (factors.length === 0) {
          // The middleware redirected here because the session's cached AAL
          // still counts an abandoned (unverified) factor. Clean it up so the
          // next request's AAL check no longer sees a reason to gate — the
          // hard navigation below re-runs middleware against the fresh state.
          await unenrollAbandonedFactors().catch(() => {})
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- hard reload re-runs middleware against the freshly cleaned-up factor state.
          window.location.href = "/calculator"
        } else {
          factorIdRef.current = factors[0].id
          setFactorId(factors[0].id)
        }
      })
      .catch((err: unknown) =>
        setError(`Could not load your authentication factors: ${err instanceof Error ? err.message : String(err)}`)
      )
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    // The factor list loads asynchronously after mount; a submit that lands
    // before it resolves must not silently no-op (the old `if (!factorId)
    // return` dropped the click with no feedback) — wait for the load instead.
    let id = factorIdRef.current
    if (!id) {
      if (factorLoadPromiseRef.current) await factorLoadPromiseRef.current
      id = factorIdRef.current
      if (!id) {
        setError("Your security methods are not available.")
        return
      }
    }
    setLoading(true); setError(null)

    try {
      if (mode === "recovery") {
        const res = await fetch("/api/auth/recover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: value }),
        })
        if (!res.ok) {
          const { error: message } = await res.json()
          setError(message ?? "That recovery code is not valid, or has already been used.")
          return
        }
      } else {
        const supabase = createClient()
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId: id })
        if (cErr) { setError(cErr.message); return }
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId: id, challengeId: challenge.id, code: value,
        })
        if (vErr) { setError("That code is not correct."); return }
      }
      // Full navigation, not router.replace(). SupabaseProvider lives in the
      // root layout, so a client-side navigation never remounts it — and its
      // sync ran at aal1 during sign-in, when RLS legitimately returned zero
      // rows, leaving the store with a null activeScenarioId and an empty
      // scenarioList. Edits made in that window are silently dropped, since
      // scheduleScenarioSync early-returns without an active scenario. A hard
      // load remounts the provider and re-syncs at the now-satisfied aal2.
      // session-list.tsx and account-settings.tsx force a reload for the same
      // reason after changing auth state.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full reload remounts SupabaseProvider and re-syncs at the now-satisfied aal2.
      window.location.href = "/calculator"
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center px-4">
      <PageCard label="Two-Factor Authentication" contentClassName="space-y-4" className="w-full">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mfa-input" className="text-xs font-medium">
              {mode === "totp" ? "Code from your authenticator app" : "Recovery code"}
            </Label>
            <Input id="mfa-input" autoFocus autoComplete="one-time-code"
              inputMode={mode === "totp" ? "numeric" : "text"}
              maxLength={mode === "totp" ? 6 : 11}
              value={value}
              onChange={(e) => setValue(mode === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value)}
              className={`h-8 text-sm ${error ? "border-destructive" : ""}`} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading || value.length === 0}>
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>
        <button type="button"
          onClick={() => { setMode(mode === "totp" ? "recovery" : "totp"); setValue(""); setError(null) }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
          {mode === "totp" ? "Use a recovery code instead" : "Use your authenticator app instead"}
        </button>
      </PageCard>
    </div>
  )
}
