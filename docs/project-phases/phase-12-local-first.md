---
type: Phase
title: "Phase 12: Local-first storage, no outbound requests"
description: "Phase 12: remove accounts, the database, analytics and all AI calls; store everything in the browser; make 'Explain my plan' a copy-a-prompt feature."
---

# Phase 12: Local-first storage, no outbound requests ✅ Complete

**Goal:** Users should not have to trust a server with their finances. No accounts, no database,
no analytics, no server-held secrets, and no AI calls from the app — nothing a user enters leaves
the browser.

Full write-up: [2026-11-14-remove-accounts-local-first](../history/2026-11-14-remove-accounts-local-first.md).

## Completed

- [x] Stores persisted to localStorage only (fixed keys, calculator persist v4); cloud sync, identity and scenarios removed
- [x] `LocalDataProvider` hydration, cross-tab sync via `storage` events, write gate kept
- [x] Storage failures surfaced (`storage-health` + `StorageHealthBanner`); `navigator.storage.persist()` requested; backup nudge and Data & Privacy settings
- [x] Backup v2 (plan + expenses), import sanitised with the same clamps as persisted data
- [x] Clear all local data
- [x] Auth, Supabase, MFA, recovery codes, Turnstile, rate limiting, account API routes deleted; dependencies removed
- [x] Vercel Analytics and Speed Insights removed
- [x] `proxy.ts` reduced to nonce CSP + headers; `connect-src 'self'`; no third-party scripts
- [x] "Explain my plan" is **copy-a-prompt** (`copy-prompt`, `CopyPromptPanel`): no key, no request. The server AI route, a short-lived bring-your-own-key mode and an on-device model were all removed
- [x] `no-outbound-requests` test guards the promise; verified in Chromium against the production build
- [x] PR #46 review hardening: a throwing `localStorage` no longer blanks the page, `unsafe-eval` is development-only, and storage-health failures are tracked per key ([history](../history/2026-11-14-pr46-review-fixes.md))

## Pending / follow-ups

- [ ] Decide whether to offer an optional local model (e.g. Ollama on localhost) later
