"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UnlockForm } from "@/components/ai/unlock-form"
import {
  forget,
  lock,
  MIN_PASSPHRASE_LENGTH,
  saveEncrypted,
  saveSessionOnly,
  VaultError,
} from "@/lib/ai/key-vault"
import { PROVIDER_LABELS } from "@/lib/ai/model-tiers"
import { PROVIDER_IDS, type ProviderId } from "@/lib/ai/providers/origins"
import { useKeyStatus, useProviderChoice } from "@/lib/hooks/use-llm-key"
import { toast } from "@/lib/hooks/use-toast"

type Mode = "session" | "remember"

const STATUS_TEXT = {
  none: "No key saved.",
  locked: "A key is saved on this device, encrypted. Unlock it to use it.",
  session:
    "A key is held in memory for this tab only. It is gone when you close or reload the tab.",
  unlocked: "Your saved key is unlocked for this session.",
} as const

/** Advanced option: the user's own provider API key (see docs/security/byok-llm-key-handling.md). */
export function AiKeySection() {
  const [provider, setProvider] = useProviderChoice()
  const status = useKeyStatus(provider)

  const [apiKey, setApiKey] = useState("")
  const [mode, setMode] = useState<Mode>("session")
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  const reset = () => {
    // Secrets must not linger in component state once they've been handed to the vault.
    setApiKey("")
    setPassphrase("")
    setConfirm("")
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (mode === "remember" && passphrase !== confirm) {
      setError("The passphrases don't match.")
      return
    }
    setIsPending(true)
    try {
      if (mode === "remember") await saveEncrypted(provider, apiKey, passphrase)
      else saveSessionOnly(provider, apiKey)
      reset()
      toast({ title: mode === "remember" ? "Key saved (encrypted)" : "Key ready for this session" })
    } catch (err) {
      setError(err instanceof VaultError ? err.message : "Couldn't save the key.")
    } finally {
      setIsPending(false)
    }
  }

  const handleForget = (target: ProviderId) => {
    forget(target)
    toast({ title: "Key removed" })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Your key is used only by this browser, talking directly to the provider. It is never sent to
        us. Create a <strong>dedicated key with a spending limit</strong> for this app so you can
        revoke it at any time.
      </p>

      <div className="space-y-2">
        <Label htmlFor="ai-provider">Provider</Label>
        <Select value={provider} onValueChange={(v) => setProvider(v as ProviderId)}>
          <SelectTrigger id="ai-provider" className="w-60 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PROVIDER_IDS.map((id) => (
                <SelectItem key={id} value={id}>
                  {PROVIDER_LABELS[id]}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm" data-testid="ai-key-status">
        {STATUS_TEXT[status]}
      </p>

      {status === "locked" && <UnlockForm provider={provider} />}

      {(status === "unlocked" || status === "session") && (
        <div className="flex flex-wrap gap-2">
          {status === "unlocked" && (
            <Button variant="outline" size="sm" onClick={() => lock(provider)}>
              Lock
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => handleForget(provider)}>
            Remove key
          </Button>
        </div>
      )}
      {status === "locked" && (
        <Button variant="outline" size="sm" onClick={() => handleForget(provider)}>
          Remove saved key
        </Button>
      )}

      <form onSubmit={save} className="space-y-3" autoComplete="off">
        <div className="space-y-2">
          <Label htmlFor="ai-key">{status === "none" ? "API key" : "Replace API key"}</Label>
          <Input
            id="ai-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            minLength={8}
            maxLength={512}
            // new-password: never autofills a saved account password into the key field
            // (there are no accounts); the data-* attributes ask password managers not to
            // capture an API key as a login.
            autoComplete="new-password"
            spellCheck={false}
            autoCapitalize="off"
            data-1p-ignore
            data-lpignore="true"
            className="h-8 max-w-md text-sm font-mono"
          />
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">How long should it be kept?</legend>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="ai-key-mode"
              checked={mode === "session"}
              onChange={() => setMode("session")}
              className="mt-1"
            />
            <span>
              <strong>This session only</strong> — most private. Held in memory, gone when you close
              or reload the tab.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="ai-key-mode"
              checked={mode === "remember"}
              onChange={() => setMode("remember")}
              className="mt-1"
            />
            <span>
              <strong>Remember on this device</strong> — encrypted with a passphrase you choose. You
              unlock it once per visit. We can&apos;t recover a forgotten passphrase.
            </span>
          </label>
        </fieldset>

        {mode === "remember" && (
          <div className="grid max-w-md gap-2">
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
              minLength={MIN_PASSPHRASE_LENGTH}
              placeholder={`Passphrase (${MIN_PASSPHRASE_LENGTH}+ characters)`}
              aria-label="Passphrase"
              autoComplete="new-password"
              className="h-8 text-sm"
            />
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={MIN_PASSPHRASE_LENGTH}
              placeholder="Confirm passphrase"
              aria-label="Confirm passphrase"
              autoComplete="new-password"
              className="h-8 text-sm"
            />
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="sm" disabled={isPending || apiKey.trim().length === 0}>
          {isPending ? "Saving…" : "Save key"}
        </Button>
      </form>
    </div>
  )
}
