"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { listFactors, recoveryCodesRemaining, unenrollTotp } from "@/lib/auth/mfa"
import { MfaEnrollment } from "./mfa-enrollment"
import { TotpReauthDialog } from "./totp-reauth-dialog"

export function SecuritySection({ email }: { email: string }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const factors = await listFactors()
      setFactorId(factors[0]?.id ?? null)
      setRemaining(factors.length > 0 ? await recoveryCodesRemaining() : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load security settings.")
    }
  }, [])

  // Defer the initial load out of the effect's synchronous body: the state
  // updates land after the listFactors/recoveryCodesRemaining promises resolve.
  useEffect(() => {
    const id = requestAnimationFrame(() => { void load() })
    return () => cancelAnimationFrame(id)
  }, [load])

  async function disable() {
    if (!factorId) return
    try {
      await unenrollTotp(factorId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable two-factor authentication.")
    }
  }

  return (
    <PageCard label="Security" contentClassName="space-y-3">
      {error && <p className="text-sm text-destructive">{error}</p>}

      {factorId === null ? (
        <MfaEnrollment onEnrolled={load} />
      ) : (
        <div className="space-y-3 max-w-sm">
          <p className="text-sm text-muted-foreground">
            Two-factor authentication is on. Sign-in requires a code from your authenticator app.
          </p>
          {remaining !== null && (
            <p className={`text-sm ${remaining <= 2 ? "text-destructive" : "text-muted-foreground"}`}>
              {remaining} recovery {remaining === 1 ? "code" : "codes"} remaining
              {remaining <= 2 && " — disable and re-enrol to get a fresh set."}
            </p>
          )}
          <Button variant="outline" size="sm" onClick={() => setConfirmingDisable(true)}>
            Disable Two-Factor Authentication
          </Button>
        </div>
      )}

      <TotpReauthDialog
        open={confirmingDisable}
        factorId={factorId ?? ""}
        action="disable two-factor authentication"
        onCancel={() => setConfirmingDisable(false)}
        onConfirmed={() => { setConfirmingDisable(false); void disable() }}
      />
    </PageCard>
  )
}
