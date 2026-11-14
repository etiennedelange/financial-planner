---
type: History Entry
title: "Accounts removed: local-first storage, no outbound requests"
description: "Why and how sign-in, the Supabase database, analytics and all AI calls were removed: plan data lives only in the browser, the app makes no outbound requests, and 'Explain my plan' is a copy-a-prompt feature."
date: 2026-11-14
tags: [architecture, security, privacy, ai, persistence]
---

# Accounts removed: local-first storage, no outbound requests

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
(`lib/security/apply-headers.ts`). Static export was rejected: it would lose the nonce CSP.
`buildCsp(nonce, isDev)` ends with **`connect-src 'self'`** — the page can contact nothing else —
no third-party script origins, and `frame-src 'none'`.

### 4. "Explain my plan" is copy-a-prompt; the app makes no AI calls
`app/api/plan-narrative` (server-side AI) was deleted. For a while the replacement was a
bring-your-own-key mode (browser → Anthropic/OpenAI/Gemini with a passphrase-encrypted key); it
was **removed the same day**. Pasting a secret into a website is exactly the trust problem this
change set out to remove, and AI subscriptions (Claude, ChatGPT, Gemini) can't be used by
third-party apps. What exists now (`lib/ai/copy-prompt.ts`, `components/ai/copy-prompt-panel.tsx`):
- the app builds the prompt (`lib/ai/plan-narrative-prompt.ts`), shows it in a read-only preview,
  copies it to the clipboard, and links to claude.ai / chatgpt.com / gemini.google.com — plain
  URLs, **no plan data in any URL**;
- the user pastes it into the chat app they already use. No key, no network call from this app.
- Removed with it: key vault, three provider clients, key/unlock forms, model-tier table, the
  `ai` dependency, the narrative store, and the AI card in Settings (nothing left to configure).
- An on-device model (WebLLM/WebGPU) was also built and dropped before commit: it needed a
  large same-origin dependency, a wildcard CDN origin and `'wasm-unsafe-eval'` in the CSP.
- Vercel Analytics / Speed Insights were removed too.
- `lib/security/no-outbound-requests.test.ts` enforces the promise: no `fetch`/XHR/WebSocket/
  EventSource/beacon in app source, no provider/analytics client, `connect-src 'self'`, no
  Supabase, no API routes.

## Verification
- 71 test files / 1280 tests pass; `tsc --noEmit` clean; `vp check` 0 errors; `pnpm build` clean
  with no environment variables; shadscan 91/100 (A); `docs:check` ok.
- Tests cover: stores (persist, write gate, migrate, rehydrate), `LocalDataProvider` hydration and
  cross-tab sync, storage health and the failure banner, backup v2 + import sanitising, clear-all,
  the exact CSP, copy-prompt (preview == clipboard, links have no query string, no key/URL leaks).
- Real browser (Chromium vs the production build): persistence across reloads, cross-tab sync,
  backup → clear all → restore, CSP blocks every cross-origin fetch, Copy prompt copies exactly
  the previewed text, makes no external request, and the links are plain.

## Known trade-offs
- Safari can evict script-written storage after ~7 days without a visit; clearing site data erases
  everything. Mitigated by the backup nudge, a storage-failure banner and `storage.persist()`.
- No in-app AI summary: users paste the prompt into a chat themselves.
- Existing data was dropped by decision (pre-launch, no users): no migration of old keys or cloud data.
