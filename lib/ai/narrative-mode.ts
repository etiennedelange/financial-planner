/**
 * How the plan summary is produced. The default needs no key and sends nothing anywhere.
 *  - "copy":  the app builds the prompt; the user pastes it into their own chat
 *             (works with a Claude / ChatGPT / Gemini subscription).
 *  - "key":   the browser calls the user's chosen provider with the user's own API key.
 */
export type NarrativeMode = "copy" | "key"

export const NARRATIVE_MODES: readonly NarrativeMode[] = ["copy", "key"]
export const DEFAULT_NARRATIVE_MODE: NarrativeMode = "copy"
export const NARRATIVE_MODE_KEY = "plan-narrative-mode"

export function isNarrativeMode(value: unknown): value is NarrativeMode {
  return typeof value === "string" && (NARRATIVE_MODES as readonly string[]).includes(value)
}
