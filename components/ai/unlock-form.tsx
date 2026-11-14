"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MIN_PASSPHRASE_LENGTH, unlock, VaultError } from "@/lib/ai/key-vault"
import type { ProviderId } from "@/lib/ai/providers/origins"

/** Asks for the passphrase that decrypts the remembered API key. */
export function UnlockForm({
  provider,
  onUnlocked,
}: {
  provider: ProviderId
  onUnlocked?: () => void
}) {
  const [passphrase, setPassphrase] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsPending(true)
    setError(null)
    try {
      await unlock(provider, passphrase)
      setPassphrase("") // do not keep the passphrase in component state
      onUnlocked?.()
    } catch (err) {
      setError(err instanceof VaultError ? err.message : "Couldn't unlock the key.")
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="password"
          value={passphrase}
          onChange={(e) => setPassphrase(e.target.value)}
          placeholder="Passphrase"
          aria-label="Passphrase to unlock your saved API key"
          autoComplete="current-password"
          required
          minLength={MIN_PASSPHRASE_LENGTH}
          className="h-8 w-56 text-sm"
        />
        <Button type="submit" size="sm" disabled={isPending || passphrase.length === 0}>
          {isPending ? "Unlocking…" : "Unlock"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}
