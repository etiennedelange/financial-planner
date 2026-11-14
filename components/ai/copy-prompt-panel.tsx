"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { buildCopyablePrompt, CHAT_APPS, copyToClipboard } from "@/lib/ai/copy-prompt"
import type { PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

/**
 * The no-key, no-network way to get a summary: show the exact prompt, let the user copy
 * it, and point them at the chat apps they already use (a Claude / ChatGPT / Gemini
 * subscription works). The app never sends anything — the user does, knowingly.
 */
export function CopyPromptPanel({ payload }: { payload: PlanNarrativePayload }) {
  const prompt = buildCopyablePrompt(payload)
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  useEffect(() => {
    if (status !== "copied") return
    const id = setTimeout(() => setStatus("idle"), 3000)
    return () => clearTimeout(id)
  }, [status])

  const copy = async () => setStatus((await copyToClipboard(prompt)) ? "copied" : "failed")

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Copy a ready-made prompt, then paste it into the chat app you already use — your Claude,
        ChatGPT or Gemini subscription works. Nothing is sent from here.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={copy}>
          {status === "copied" ? "Copied ✓" : "Copy prompt"}
        </Button>
        <span className="text-xs text-muted-foreground">then open</span>
        {CHAT_APPS.map((app) => (
          <a
            key={app.id}
            href={app.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-2"
          >
            {app.label}
          </a>
        ))}
      </div>

      <p role="status" className="min-h-4 text-xs text-muted-foreground">
        {status === "copied" && "Prompt copied to your clipboard."}
        {status === "failed" &&
          "Your browser wouldn't let us copy automatically — open the preview below and copy the text yourself."}
      </p>

      <details open={status === "failed"} className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">
          Preview exactly what will be copied
        </summary>
        <textarea
          readOnly
          value={prompt}
          rows={12}
          aria-label="Prompt to copy"
          onFocus={(e) => e.currentTarget.select()}
          className="mt-2 w-full resize-y rounded-md border border-input bg-background p-2 font-mono text-xs text-foreground"
        />
      </details>

      <p className="text-xs text-muted-foreground">
        The prompt contains your balances, contributions, ages and goals, so it goes to whichever
        chat service you paste it into, under their terms. This is an automated educational summary,
        not financial advice — consult a licensed financial advisor before making decisions.
      </p>
    </div>
  )
}
