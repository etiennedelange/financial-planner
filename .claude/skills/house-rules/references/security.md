# Security Checklist

Read when the diff touches `lib/ai/`, `components/ai/`, `lib/security/`, `proxy.ts`,
`lib/store/` persistence code, `lib/utils/plan-io.ts`, or `package.json` / `pnpm-lock.yaml`.

The app has **no accounts and no server-side secrets** (decided 2026-11-14). Data lives only in
the browser; the optional AI summary calls the user's chosen provider directly with the
user's own API key. The threats that matter are therefore about that key, the CSP that protects
it, and untrusted data entering the stores. Primary source:
`docs/security/byok-llm-key-handling.md`. Context:
`docs/history/2026-11-14-remove-accounts-local-first-byok.md`.

The previous auth/RLS/MFA checklist guarded code that no longer exists; its record is
`docs/security/auth-2fa-risk-register.md` (retired).

---

## SEC1 — The API key never leaves the vault's lane

**Check:** the user's LLM key is not persisted, logged, exported, placed in a URL, or held in a
Zustand store, React context or the DOM. The only homes are `lib/ai/key-vault.ts` (memory or a
passphrase-encrypted blob) and, transiently, a request's headers.

**Check:** `lib/ai/key-vault.ts` is imported only by `lib/ai/stream-narrative.ts`,
`lib/hooks/use-llm-key.ts` and `components/ai/*`. Never by stores, calculations or utils.
`lib/ai/key-isolation.test.ts` enforces this — if it needed editing, ask why.

**Check:** no plaintext key or passphrase is ever written to storage. Only the
`rc-llm-key-v1:<provider>` ciphertext blob (AES-GCM, PBKDF2 600 k, fresh IV/salt each save,
provider bound as additional data).

## SEC2 — Provider calls go through `providerFetch`

**Check:** any request carrying a key uses `lib/ai/providers/http.ts` (`credentials:"omit"`,
`redirect:"error"`, `referrerPolicy:"no-referrer"`, `cache:"no-store"`, pinned origin, timeout).
A bare `fetch` with a key is a finding.

**Check:** keys travel in **headers**, never query strings (Gemini: `x-goog-api-key`).

**Check:** user-visible errors are fixed `ProviderError` messages. Never render a provider's
response body or a caught `error.message` — providers echo masked keys in 401 text.

**Check:** every generation has a hard output-token cap; the user's money is on the line.

## SEC3 — CSP is the exfiltration guard

**Check:** `connect-src` stays an exact allowlist: `'self'`, the origins in `PROVIDER_ORIGINS`.
No telemetry, no wildcards, no bare schemes. A new provider updates `PROVIDER_ORIGINS` **and**
the exact-set assertion in `lib/security/headers.test.ts`.

**Check:** no third-party script origin is added to `script-src`; `frame-src` stays `'none'`.
A new analytics/widget script is a security change, not a UI one.

**Check:** the nonce is still minted per request in `lib/security/apply-headers.ts` and
`app/layout.tsx` still reads `x-nonce`. Do not move to a static export — it loses the nonce CSP.

## SEC4 — Untrusted data entering the stores

**Check:** anything loaded from a file or an old persisted payload goes through the shared
`sanitizePlan` / `sanitizeExpenses` (the same functions `migrate` uses). A second copy of the
clamping logic will drift. Backup import also rejects oversized files before parsing.

**Check:** storage failures are reported through `lib/store/storage-health.ts`, never swallowed —
with no server copy, silent failure is silent data loss.

**Check:** "Clear all local data" resets the in-memory stores **before** removing keys.

## SEC5 — Dependencies

**Check:** if `package.json` or `pnpm-lock.yaml` changed, run `pnpm audit`. With a key in the
browser the npm supply chain is the main attack surface, so new runtime dependencies need a
reason. `next` and `@next/bundle-analyzer` move together.

The project also has a dedicated `security-audit` skill for devcontainer, pnpm and semgrep
checks — recommend it rather than reproducing it here.

## SEC6 — Injection and rendering

**Check:** new `dangerouslySetInnerHTML`. Exactly one exists, in `components/ui/chart.tsx`
for generated CSS custom properties. Any new instance carrying user- or model-derived content
is a finding. Model output is rendered as plain text (`whitespace-pre-wrap`), never as HTML.

**Check:** secrets or user financial data in `console.*`. Logs are neither a UI nor a safe
place for user data.
