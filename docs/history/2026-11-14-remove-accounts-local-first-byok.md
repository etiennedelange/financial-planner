---
type: History Entry
title: "Accounts removed: local-first storage and bring-your-own-key AI"
description: "Why and how sign-in, the Supabase database and the server-side AI route were removed; plan data now lives only in the browser and the AI summary calls the user's chosen provider directly with the user's own key."
date: 2026-11-14
tags: [architecture, security, privacy, ai, persistence]
---

# Accounts removed: local-first storage and bring-your-own-key AI

## Why

Users will not trust a financial planner that asks them to sign up and store balances on a
server. The product goal became: **no accounts, no database, no server-held secrets.** The
maintainer neither pays for nor can see anything a user enters.

## What changed

### 1. Storage is the browser only
- Both Zustand stores (`calculator-store`, `expenses-store`) keep `persist` + `skipHydration`
  but lost all cloud machinery: identity, `syncFromDb`, debounced writes, generation/owner
  guards, claim-guest-data, scenarios. Roughly 70% of each file was deleted.
- Fixed storage keys: `financial-planner-storage` (persist **v4**) and `expenses-store-v2`.
- localStorage was kept over IndexedDB: the payload is ~5–40 KB against a 5 MB quota and
  IndexedDB would force async hydration for no gain.
- `<LocalDataProvider>` (`components/local-data-provider.tsx`) replaced `SupabaseProvider`:
  rehydrates both stores, exposes `useStoresHydrated()`, and
  re-hydrates on `storage` events so a second tab no longer clobbers the first.
- **Write gate kept** (`lib/store/persist-gate.ts`, scope logic removed): with `skipHydration`,
  a `set()` before the first rehydrate would otherwise overwrite saved data with defaults.
- **Storage failure is surfaced, not swallowed** (`lib/store/storage-health.ts`): quota errors
  and blocked storage show a `StorageHealthBanner` with a link to download a backup; the app
  also asks the browser for persistent storage to reduce eviction.
- `migrate` sanitisation was extracted to shared `sanitizePlan` / `sanitizeExpenses` so the
  backup **import** now applies the same clamps as persisted data (it previously bypassed them).
- **Backups** (`lib/utils/plan-io.ts`) are now v2: plan **and expenses**; v1 files still import.
  With no server copy the file is the only backup, so it got real tests.
- Settings gained **Data & Privacy**: download/restore backup, last-backup date, and
  **Clear all local data** (resets in-memory stores first, then removes keys — reloading alone
  would let the persist middleware write the data straight back).
- **Scenarios were removed** (single plan). Export/import covers variants.
- `generateSeedData` moved to `lib/constants/expense-seed.ts` before `lib/supabase/` was deleted.

### 2. The auth/Supabase surface is gone
Deleted: `app/auth/*`, `app/api/auth/*`, `app/api/account/*`, `app/supabase/*`, `lib/supabase/`,
`lib/auth/`, `components/auth/`, `components/scenarios/`, `account-menu`, `supabase/` (migrations,
RLS tests, config), `instrumentation.ts` (Turnstile prod check), `lib/config/features.ts`,
`lib/security/rate-limit.ts`, `types/supabase.ts`, three auth e2e journeys. Dependencies
`@supabase/ssr`, `@supabase/supabase-js`, `ai` and `otplib` removed; CI/devcontainer/MCP/skill
config cleaned. `pnpm build` now needs **no environment variables**.

### 3. CSP and headers (server kept, shrunk)
`proxy.ts` now only mints the per-request nonce and stamps security headers
(`lib/security/apply-headers.ts`). Static export was rejected: it would lose the nonce CSP that
protects the API key. `buildCsp(nonce, isDev)`:
- `connect-src 'self'` + the three provider origins, **no wildcards**
- no third-party script origins (Cloudflare Turnstile removed), `frame-src 'none'`
- provider origins live in one place, `lib/ai/providers/origins.ts`, shared with the clients.

### 4. Bring-your-own-key AI
`app/api/plan-narrative` was deleted. `streamNarrative` (`lib/ai/stream-narrative.ts`) calls
Anthropic, OpenAI or Gemini **directly from the browser** with thin `fetch` clients (no `ai`
SDK on the client). Key handling is documented in
[`docs/security/byok-llm-key-handling.md`](../security/byok-llm-key-handling.md). The model tier
selector is now real (the old server ignored it), and every request has a hard token cap.

### 5. Copy prompt is now the default (follow-up, same day)
Pasting an API key is the weakest part of the design, and AI subscriptions (Claude, ChatGPT,
Gemini) cannot be used by third-party apps. So the default is now **"Copy a prompt"**
(`lib/ai/copy-prompt.ts`, `components/ai/copy-prompt-panel.tsx`): the app builds the same prompt
the other mode sends, shows it in a read-only preview, copies it to the clipboard, and links to
claude.ai / chatgpt.com / gemini.google.com (plain URLs — no plan data ever goes in a URL). The
user pastes it into the chat app they already pay for. No key, no network call from this app.
- Settings → **AI Assistant** has two options: *Copy a prompt* (default) and *Your own API key
  (advanced)*, which reveals the key form. The choice is a non-secret preference
  (`plan-narrative-mode`, via the shared `useLocalPref` hook so Settings and Overview stay in sync).
- An **on-device model** (WebLLM / WebGPU) was built and then **dropped before commit** by
  decision: it needed a large dependency in the same origin as the key vault, a wildcard CDN
  origin (`*.hf.co`) and `'wasm-unsafe-eval'` in the CSP — all of which weaken the protection of the
  key — for a feature few users would enable. The CSP is unchanged. It remains a possible
  follow-up (Ollama on localhost would need only a localhost `connect-src` entry).

## Verification
- 75 test files / 1363 tests pass (coverage 96.6% overall); `tsc --noEmit` clean; `vp check` 0 errors; `pnpm build` clean.
- New tests: key vault (round-trip, tamper, wrong passphrase, provider binding, idle lock,
  bfcache lock), provider clients (headers, key-not-in-URL, SSE parsing, error scrubbing),
  `providerFetch` hardening, storage health/clear, provider hydration + cross-tab sync,
  backup v2 + import sanitising, CSP exact-set, and `key-isolation.test.ts` (no Supabase import,
  vault importable only by the AI layer, key never in storage/backups).
- Real browser (Chromium vs the production build): CSP blocks
  `example.com`/attacker fetches (with violations logged), session-only key in no storage,
  mocked-provider streaming with the right headers and no cookies, encrypted blob at rest,
  locked after reload / wrong passphrase rejected / right passphrase unlocks, cross-tab sync,
  backup → clear all → restore. 26/27 checks passed; the one miss was Vercel's `_vercel/*`
  analytics scripts 404ing on a local server (expected, unrelated).
- shadscan: 91/100 (A). Three new findings from the key form (autocomplete, validation, pending
  state) were fixed properly rather than waived.

## Not verified here
- **Real-provider CORS and current model ids** need real keys and open network access. The
  clients follow each provider's documented browser behaviour (Anthropic's opt-in header, Gemini
  header auth); model ids live in `lib/ai/model-tiers.ts` and **OpenAI/Gemini ids need checking
  against current docs**. A wrong id appears to the user as a "bad request" error.

## Known trade-offs
- A script running on the origin while the vault is unlocked can still spend the user's key
  (CSP stops exfiltration, a spend-capped key bounds the damage). Stated in the security doc and
  in the UI.
- Safari can evict script-written storage after ~7 days without a visit; clearing site data
  erases everything. Mitigated by the backup nudge and by telling users plainly.
- Existing data was dropped by decision (pre-launch, no users): no migration of old `:guest` keys or cloud data, and no purge of old account caches.
- Vercel Analytics / Speed Insights were removed too (decided same day): the app now loads no telemetry at all.
