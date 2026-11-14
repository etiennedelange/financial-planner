"use client"

import { useId } from "react"
import { useShallow } from "zustand/react/shallow"
import { PageCard } from "@/components/ui/page-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAiSettingsHydration, useAiSettingsStore } from "@/lib/store/ai-settings-store"
import { AI_PROVIDER_IDS, AI_PROVIDER_LABELS } from "@/lib/ai/model-tiers"
import { OWN_KEY_PROBLEM_MESSAGES, ownKeyProblem, type OwnKeyProblem } from "@/lib/ai/own-key"

const KEY_HELP = {
  gateway: "Create one in the Vercel dashboard under AI Gateway → API Keys.",
  cloudflare:
    "Create an API token with the Workers AI permission. Your account ID is on the Cloudflare dashboard overview.",
} as const

/** Field-level problems are only shown once the field has content, so an empty form isn't a wall of red. */
function visibleProblem(problem: OwnKeyProblem | null, field: "key" | "account", touched: boolean) {
  if (!problem || !touched) return null
  if (field === "key" && (problem === "invalid-key" || problem === "missing-key")) return problem
  if (field === "account" && (problem === "invalid-account" || problem === "missing-account"))
    return problem
  return null
}

export function AiProviderSettings() {
  useAiSettingsHydration()
  const settings = useAiSettingsStore(
    useShallow((state) => ({
      mode: state.mode,
      provider: state.provider,
      gatewayApiKey: state.gatewayApiKey,
      cloudflareAccountId: state.cloudflareAccountId,
      cloudflareApiToken: state.cloudflareApiToken,
      remember: state.remember,
      update: state.update,
      forgetKeys: state.forgetKeys,
    })),
  )
  const keyId = useId()
  const accountId = useId()
  const rememberId = useId()
  const modeLabelId = useId()
  const providerLabelId = useId()

  const { mode, provider, update } = settings
  const keyValue = provider === "gateway" ? settings.gatewayApiKey : settings.cloudflareApiToken
  const problem = mode === "own" ? ownKeyProblem(settings) : null
  const keyProblem = visibleProblem(problem, "key", keyValue.length > 0)
  const accountProblem = visibleProblem(problem, "account", settings.cloudflareAccountId.length > 0)
  const hasStoredKey =
    settings.gatewayApiKey.length > 0 ||
    settings.cloudflareApiToken.length > 0 ||
    settings.cloudflareAccountId.length > 0

  return (
    <PageCard label="AI Provider" contentClassName="space-y-4">
      <div className="space-y-2">
        <p id={modeLabelId} className="text-sm font-medium">
          Explain My Plan uses
        </p>
        {/* aria-pressed: the selected option must not be conveyed by colour alone */}
        <div role="group" aria-labelledby={modeLabelId} className="flex flex-wrap gap-2">
          <Button
            variant={mode === "hosted" ? "default" : "outline"}
            size="sm"
            aria-pressed={mode === "hosted"}
            onClick={() => update({ mode: "hosted" })}
          >
            App default
          </Button>
          <Button
            variant={mode === "own" ? "default" : "outline"}
            size="sm"
            aria-pressed={mode === "own"}
            onClick={() => update({ mode: "own" })}
          >
            My own API key
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {mode === "hosted"
            ? "Summaries run on the AI provider this app is set up with, using the standard model."
            : "Summaries run on your own provider account, billed to you. You can choose Fast, Balanced or Best on the card."}
        </p>
      </div>

      {mode === "own" && (
        <>
          <div className="space-y-2">
            <p id={providerLabelId} className="text-sm font-medium">
              Provider
            </p>
            <div role="group" aria-labelledby={providerLabelId} className="flex flex-wrap gap-2">
              {AI_PROVIDER_IDS.map((id) => (
                <Button
                  key={id}
                  variant={provider === id ? "default" : "outline"}
                  size="sm"
                  aria-pressed={provider === id}
                  onClick={() => update({ provider: id })}
                >
                  {AI_PROVIDER_LABELS[id]}
                </Button>
              ))}
            </div>
          </div>

          {provider === "cloudflare" && (
            <div className="space-y-1.5">
              <Label htmlFor={accountId}>Cloudflare account ID</Label>
              <Input
                id={accountId}
                value={settings.cloudflareAccountId}
                onChange={(e) => update({ cloudflareAccountId: e.target.value })}
                autoComplete="off"
                spellCheck={false}
                inputMode="text"
                placeholder="32-character account ID"
                aria-invalid={accountProblem !== null}
                aria-describedby={accountProblem ? `${accountId}-error` : undefined}
              />
              {accountProblem && (
                <p id={`${accountId}-error`} className="text-xs text-destructive">
                  {OWN_KEY_PROBLEM_MESSAGES[accountProblem]}
                </p>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor={keyId}>
              {provider === "gateway" ? "AI Gateway API key" : "Workers AI API token"}
            </Label>
            <Input
              id={keyId}
              type="password"
              value={keyValue}
              onChange={(e) =>
                update(
                  provider === "gateway"
                    ? { gatewayApiKey: e.target.value }
                    : { cloudflareApiToken: e.target.value },
                )
              }
              // Browsers ignore "off" on password fields and may autofill the
              // site login password here; "new-password" stops that.
              autoComplete="new-password"
              spellCheck={false}
              aria-invalid={keyProblem !== null}
              aria-describedby={`${keyId}-help`}
            />
            <p id={`${keyId}-help`} className="text-xs text-muted-foreground">
              {keyProblem ? (
                <span className="text-destructive">{OWN_KEY_PROBLEM_MESSAGES[keyProblem]} </span>
              ) : null}
              {KEY_HELP[provider]}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              id={rememberId}
              type="checkbox"
              className="h-4 w-4 accent-primary"
              checked={settings.remember}
              onChange={(e) => update({ remember: e.target.checked })}
            />
            <Label htmlFor={rememberId} className="font-normal">
              Remember on this device
            </Label>
          </div>

          <p className="text-xs text-muted-foreground">
            Your key stays in this browser
            {settings.remember ? " until you remove it" : " until you close it"}. It is sent with
            each summary request and used for that request only; it is never saved on our servers.
          </p>
        </>
      )}

      {hasStoredKey && (
        <Button variant="outline" size="sm" onClick={settings.forgetKeys}>
          Remove saved keys
        </Button>
      )}
    </PageCard>
  )
}
