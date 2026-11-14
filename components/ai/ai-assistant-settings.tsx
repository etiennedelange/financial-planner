"use client"

import { AiKeySection } from "@/components/ai/ai-key-settings"
import { PageCard } from "@/components/ui/page-card"
import type { NarrativeMode } from "@/lib/ai/narrative-mode"
import { useNarrativeMode } from "@/lib/hooks/use-llm-key"

const OPTIONS: { id: NarrativeMode; title: string; description: string }[] = [
  {
    id: "copy",
    title: "Copy a prompt",
    description:
      "Default. No key, nothing sent from here: copy a ready-made prompt and paste it into the chat app you already use (your Claude, ChatGPT or Gemini subscription works).",
  },
  {
    id: "key",
    title: "Your own API key (advanced)",
    description:
      "The browser talks directly to Anthropic, OpenAI or Google with a key you paste. Convenient, but you are trusting this page with a secret.",
  },
]

export function AiAssistantSettings() {
  const [mode, setMode] = useNarrativeMode()

  return (
    <PageCard
      label="AI Assistant"
      description="Optional. A plain-English summary of your plan. Choose how it is produced."
      contentClassName="space-y-4"
    >
      <fieldset className="space-y-3">
        <legend className="sr-only">How the summary is produced</legend>
        {OPTIONS.map((option) => (
          <label key={option.id} className="flex items-start gap-2 text-sm">
            <input
              type="radio"
              name="narrative-mode"
              checked={mode === option.id}
              onChange={() => setMode(option.id)}
              className="mt-1"
            />
            <span>
              <strong>{option.title}</strong> — {option.description}
            </span>
          </label>
        ))}
      </fieldset>

      {mode === "key" && <AiKeySection />}
    </PageCard>
  )
}
