"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ReauthenticateDialogProps {
  open: boolean
  email: string
  /** What the user is about to do, e.g. "change your email address". */
  action: string
  onCancel: () => void
  onConfirmed: () => void
}

/**
 * Gate for sensitive operations. An active session is not proof of presence — a
 * borrowed unlocked laptop has one. Re-entering the password is.
 */
export function ReauthenticateDialog({
  open, email, action, onCancel, onConfirmed,
}: ReauthenticateDialogProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError("That password is not correct.")
      return
    }
    setPassword("")
    onConfirmed()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">Confirm it&apos;s you</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Enter your password to {action}.
        </DialogDescription>
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reauth-pw" className="text-xs font-medium">Password</Label>
            <Input
              id="reauth-pw"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`h-8 text-sm ${error ? "border-destructive" : ""}`}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || password.length === 0}>
              {loading ? "Checking…" : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
