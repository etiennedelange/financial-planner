---
type: History Entry
title: "2026-11-14 — PR #46 review fixes: storage fallback, CSP eval scope, per-key save health"
description: "Three review findings on PR #46 fixed: a throwing localStorage no longer blanks the page during hydration, production over plain HTTP no longer gets unsafe-eval, and a successful save of one store no longer hides another store's failed save."
date: 2026-11-14
tags: [security, persistence, reliability]
---

# 2026-11-14 — PR #46 review fixes

Three open review threads on PR #46 (browser-only storage) were valid and are fixed here. Each has a regression test.

## 1. Throwing `localStorage` left the page blank

`createGatedPersistStorage` returns `undefined` when reading `window.localStorage` throws, and zustand's non-persistent fallback has no `persist` API. `LocalDataProvider` called `persist.rehydrate()` unguarded, so hydration rejected and calculator content stayed hidden (and `/print` loaded indefinitely).

- `components/local-data-provider.tsx`: `rehydrateSafely` wraps each rehydrate so it never rejects. Startup and the cross-tab `storage` handler both use it. The existing storage-health probe still reports `unavailable`, so the user is told nothing is being saved.
- Test: `components/local-data-provider.test.tsx` renders with a throwing getter, asserts hydration completes and health is `unavailable`, and dispatches a storage event without throwing.

## 2. `unsafe-eval` in production over plain HTTP

`withSecurityHeaders` used one `isDev` flag for both eval permission and the HTTPS upgrade. Any non-HTTPS request therefore gained `'unsafe-eval'`, including the supported `next start` over HTTP.

- `lib/security/headers.ts`: `buildCsp(nonce, { allowEval, upgradeInsecureRequests })` takes two named, required options instead of one boolean (CLAUDE.md: a behavioural difference must not be an omitted or overloaded parameter).
- `lib/security/apply-headers.ts`: `allowEval` is `NODE_ENV === "development"` only; `upgradeInsecureRequests` is production and HTTPS.
- Tests: `lib/security/headers.test.ts` (production over HTTP has neither), new `lib/security/apply-headers.test.ts` covering HTTPS, plain HTTP, development, and per-request nonces. `no-outbound-requests.test.ts` updated to the new signature.

## 3. One store's successful save hid another's failure

`reportStorageSuccess()` cleared a single global state, so a small expenses save could clear a quota failure from a larger plan save. The user then reloaded and lost the unsaved plan edits with no warning.

- `lib/store/storage-health.ts`: failures are tracked per storage key; the overall state is the worst outstanding failure. A success clears only its own key. Calls without a key use a default key, so existing callers keep their behaviour.
- `lib/store/persist-gate.ts`: reports failures and successes under the storage key being written.
- Tests: `lib/store/storage-health.test.ts` (other keys' failures survive, worst state wins) and new `lib/store/persist-gate.test.ts` reproducing the review scenario with a fake `localStorage`.

## 4. Clear-all missed scoped keys and could not reset in memory when storage was blocked

`clearAllLocalData` removed only the three exact keys, so `financial-planner-storage:guest`, `expenses-store-v2:user:<id>` and the pre-rename `retirement-calculator-storage` (with its scoped variants) survived a "clear all" that reported success. Its `storage` parameter defaulted to `window.localStorage`, which is evaluated before the body runs, so blocked storage threw before the in-memory reset.

- `lib/store/clear-local-data.ts`: keys match a prefix plus its scoped variants (`<prefix>` or `<prefix>:...`), so a key that merely starts with the same text is kept. Storage is read inside the function through `browserStorage()`, and the in-memory reset runs first regardless.
- Tests: scoped and legacy keys removed, look-alike keys and the theme kept, and clear-all resets the plan with storage blocked.

## 5. Backup import did not validate its records

`parseBackupText` cast accounts straight through: an unknown `type` entered the store, and a `null` account crashed with a raw `TypeError`. Expense and group records had the same gap.

- `lib/utils/plan-io.ts`: zod schemas check field presence and types for every account, group and expense. A bad record fails with a readable message. Numeric ranges are still left to `sanitizePlan` / `sanitizeExpenses`, so extreme but finite values import clamped, as before. An unrecognised `investmentType` still imports as untyped.
- Tests: null account, unknown type, non-numeric balance, malformed expense and group, missing provider defaults to `""`, and numeric extremes still clamp.

## Test-suite hygiene

`components/pages/expenses-page.groups.test.tsx` produced unhandled `AbortError`s from `@animateicons`, which calls `Element.animate` directly, outside Motion's `skipAnimations`. The file now swaps `Element.prototype.animate` for an inert animation for its duration and restores the original descriptor afterwards. The full suite runs without unhandled errors.

## Verification

- `npm run test`: 90 files, 1522 tests passing, no unhandled errors.
- `npm run typecheck`: clean.
- `vp check` on all changed files: formatted, no lint warnings.
