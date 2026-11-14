import { buildPlanNarrativePrompt, type PlanNarrativePayload } from "@/lib/ai/plan-narrative-prompt"

/** Chat apps the user can paste into. Plain links only — no plan data ever goes in a URL. */
export const CHAT_APPS = [
  { id: "claude", label: "Claude", href: "https://claude.ai/new" },
  { id: "chatgpt", label: "ChatGPT", href: "https://chatgpt.com/" },
  { id: "gemini", label: "Gemini", href: "https://gemini.google.com/app" },
] as const

/**
 * The same prompt the in-app modes send, shaped as one message a person can paste into
 * any chat. Pure; the user sees exactly this text before copying it.
 */
export function buildCopyablePrompt(payload: PlanNarrativePayload): string {
  const { system, prompt } = buildPlanNarrativePrompt(payload)
  return [
    "Please explain my retirement plan in plain English. Follow these rules:",
    "",
    system,
    "",
    "Here is my plan:",
    "",
    prompt,
  ].join("\n")
}

/** Copies text to the clipboard; resolves false if the browser refuses. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
