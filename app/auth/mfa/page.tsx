"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { listFactors } from "@/lib/auth/mfa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mode, setMode] = useState<"totp" | "recovery">("totp")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listFactors()
      .then((factors) => {
        if (factors.length === 0) router.replace("/calculator")
        else setFactorId(factors[0].id)
      })
      .catch(() => setError("Could not load your authentication factors."))
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
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
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
        if (cErr) { setError(cErr.message); return }
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId, challengeId: challenge.id, code: value,
        })
        if (vErr) { setError("That code is not correct."); return }
      }
      // replace() alone re-requests /calculator through middleware, which is
      // what actually clears the gate now that AAL/the factor state has
      // changed — a trailing refresh() here raced that pending navigation
      // and won, re-fetching the OLD /auth/mfa route instead of the new one.
      router.replace("/calculator")
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
