/** One streaming request to a provider. `apiKey` is passed in, used for the request's headers only, and never stored. */
export interface StreamRequest {
  apiKey: string
  model: string
  system: string
  prompt: string
  /** Hard cap on generated tokens — the user is paying, so every request is bounded. */
  maxOutputTokens: number
  signal?: AbortSignal
}

export type ProviderErrorCode =
  | "no-key"
  | "locked"
  | "invalid-key"
  | "rate-limited"
  | "quota"
  | "bad-request"
  | "blocked"
  | "network"
  | "aborted"
  | "timeout"
  | "unknown"

/**
 * Every failure is mapped to a code with a FIXED, friendly message. Provider
 * response bodies are never shown: several providers echo a masked copy of the key
 * in their 401 text, and a fixed message can't leak what it never contained.
 */
export class ProviderError extends Error {
  readonly code: ProviderErrorCode
  constructor(code: ProviderErrorCode) {
    super(PROVIDER_ERROR_MESSAGES[code])
    this.name = "ProviderError"
    this.code = code
  }
}

const PROVIDER_ERROR_MESSAGES: Record<ProviderErrorCode, string> = {
  "no-key": "Add an API key in Settings to use this feature.",
  locked: "Your saved key is locked. Unlock it with your passphrase.",
  "invalid-key": "The provider rejected your API key. Check it and try again.",
  "rate-limited": "The provider is rate-limiting this key. Wait a moment and try again.",
  quota: "Your provider account is out of credit or over its spending limit.",
  "bad-request": "The provider couldn't process this request. Try a different model tier.",
  blocked:
    "The browser blocked the request to the provider. Check your connection or extensions and try again.",
  network: "Couldn't reach the provider. Check your connection and try again.",
  aborted: "Cancelled.",
  timeout: "The provider took too long to respond. Please try again.",
  unknown: "Couldn't generate a summary right now. Please try again.",
}
