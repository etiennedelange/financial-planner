"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { enrollTotp, verifyEnrollment, type TotpEnrollment } from "@/lib/auth/mfa"
import { RecoveryCodesDialog } from "./recovery-codes-dialog"

interface MfaEnrollmentProps {
  onEnrolled: () => void
}

export function MfaEnrollment({ onEnrolled }: MfaEnrollmentProps) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true); setError(null)
    try { setEnrollment(await enrollTotp()) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start enrolment") }
    finally { setLoading(false) }
  }

  async function confirm() {
    if (!enrollment) return
    setLoading(true); setError(null)
    try { setCodes(await verifyEnrollment(enrollment.factorId, code)) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not verify the code") }
    finally { setLoading(false) }
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Add an authenticator app so a stolen password alone cannot reach your plan.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={start} disabled={loading} className="w-full">
          {loading ? "Starting…" : "Set Up Two-Factor Authentication"}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Scan this with your authenticator app, then enter the six-digit code it shows.
        </p>
        <div className="flex justify-center rounded-md border bg-background p-3">
          <Image src={enrollment.qrCode} alt="TOTP enrolment QR code" width={180} height={180} unoptimized />
        </div>
        <p className="text-center font-mono text-xs text-muted-foreground break-all">
          {enrollment.secret}
        </p>
        <div className="space-y-1">
          <Label htmlFor="totp-code" className="text-xs font-medium">Six-digit code</Label>
          <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`h-8 text-sm ${error ? "border-destructive" : ""}`} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button onClick={confirm} disabled={loading || code.length !== 6} className="w-full">
          {loading ? "Verifying…" : "Verify & Enable"}
        </Button>
      </div>

      <RecoveryCodesDialog
        open={codes !== null}
        codes={codes ?? []}
        onClose={() => { setCodes(null); onEnrolled() }}
      />
    </>
  )
}
