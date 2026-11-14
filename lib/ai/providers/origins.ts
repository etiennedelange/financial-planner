// The ONLY third-party origins the browser may call with a user's API key.
// Single source of truth: the CSP `connect-src` (lib/security/headers.ts) and the
// provider clients (lib/ai/providers/*) both read from here, so a client cannot
// be added without the CSP allowing it — and the CSP cannot silently grow.
//
// Why this matters: connect-src is the exfiltration guard. If a script is ever
// injected, it can still only talk to these hosts, never to an attacker's server.

export type ProviderId = "anthropic" | "openai" | "gemini"

export const PROVIDER_ORIGINS: Record<ProviderId, string> = {
  anthropic: "https://api.anthropic.com",
  openai: "https://api.openai.com",
  gemini: "https://generativelanguage.googleapis.com",
}

export const PROVIDER_IDS = Object.keys(PROVIDER_ORIGINS) as ProviderId[]
