"use client"

import { useState } from "react"
import { elevateWithTotp } from "@/lib/auth/mfa"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface TotpReauthDialogProps {
  open: boolean
  factorId: string
  action: string
  onCancel: () => void
  onConfirmed: () => void
}

export function TotpReauthDialog({
  open, factorId, action, onCancel, onConfirmed,
}: TotpReauthDialogProps) {
  const [code, setCode] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await elevateWithTotp(factorId, code)
      setCode("")
      onConfirmed()
    } catch {
      setError("That code is not correct.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">Confirm it&apos;s you</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Enter the code from your authenticator app to {action}.
        </DialogDescription>
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="totp-reauth-code" className="text-xs font-medium">Six-digit code</Label>
            <Input
              id="totp-reauth-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className={`h-8 text-sm ${error ? "border-destructive" : ""}`}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || code.length !== 6}>
              {loading ? "Verifying…" : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
