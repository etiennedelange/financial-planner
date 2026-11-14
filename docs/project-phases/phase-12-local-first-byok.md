---
type: Phase
title: "Phase 12: Local-first storage and bring-your-own-key AI"
description: "Phase 12: remove accounts and the database, store everything in the browser, and move the AI summary to the user's own provider key."
---

# Phase 12: Local-first storage and bring-your-own-key AI ✅ Complete

**Goal:** Users should not have to trust a server with their finances. No accounts, no database,
no server-held secrets; the optional AI feature uses a key the user supplies and keeps secure.

Full write-up: [2026-11-14-remove-accounts-local-first-byok](../history/2026-11-14-remove-accounts-local-first-byok.md).
Threat model: [BYOK LLM key handling](../security/byok-llm-key-handling.md).

## Completed

- [x] Stores persisted to localStorage only (fixed keys, persist v4); cloud sync, identity and scenarios removed
- [x] `LocalDataProvider` hydration, cross-tab sync via `storage` events, write gate kept
- [x] Storage failures surfaced (`storage-health` + `StorageHealthBanner`); `navigator.storage.persist()` requested; backup nudge and Data & Privacy settings
- [x] Backup v2 (plan + expenses), import sanitised with the same clamps as persisted data
- [x] Clear all local data
- [x] Auth, Supabase, MFA, recovery codes, Turnstile, rate limiting, account API routes deleted; dependencies removed
- [x] `proxy.ts` reduced to nonce CSP + headers; `connect-src` pinned to the three providers; no third-party scripts
- [x] Key vault (session-only default; opt-in PBKDF2 → AES-GCM encryption), provider clients, `streamNarrative`
- [x] Tests incl. mechanical key-isolation guards; verified in Chromium against the production build

## Pending / follow-ups

- [ ] **Verify OpenAI and Gemini model ids** in `lib/ai/model-tiers.ts` against current provider docs
- [ ] **Manual real-key CORS check** for each provider (needs real keys and open network)
- [ ] Decide whether to keep Vercel Analytics / Speed Insights given the privacy positioning
