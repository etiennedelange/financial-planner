# SA Retirement Calculator - Project Phases

This document provides an overview of all project phases. For detailed information about each phase, see the individual phase files linked below.

## Phase Overview

Based on REQUIREMENTS.md, the project is being developed in the following phases:

| Phase | Status | Documentation |
|-------|--------|---------------|
| **Phase 1** | ✅ Complete | [Calculation Accuracy](project-phases/phase-1-calculation-accuracy.md) |
| **Phase 1.5** | ✅ P0 resolved | [Testing & Validation](project-phases/phase-1-5-testing-validation.md) — invariants rewritten, 12/12 mutations killed |
| **Phase 1.6** | ✅ Complete | [Performance Optimization](project-phases/phase-1-6-performance-optimization.md) |
| **Phase 1.7** | ✅ Complete | [Next 16 / React 19 / Tailwind v4 Modernization](project-phases/phase-1-7-modernization.md) |
| **Phase 2** | 🔄 In Progress | [Supabase Integration](project-phases/phase-2-supabase.md) |
| **Phase 3** | ✅ Risk register resolved | [User Accounts](project-phases/phase-3-user-accounts.md) |
| **Phase 4** | ✅ Complete | [Data Persistence](project-phases/phase-4-data-persistence.md) |
| **Phase 5** | 🔄 In Progress | [Export Functionality](project-phases/phase-5-export-functionality.md) |
| **Phase 6** | ✅ Complete | [Enhanced Tax Calculations](project-phases/phase-6-enhanced-tax.md) |
| **Phase 7** | ✅ Complete | [UI Redesign — Sidebar App Shell](project-phases/phase-7-ui-redesign.md) |
| **Phase 8** | ✅ Complete | [Expense Tracker](project-phases/phase-8-expense-tracker.md) |
| **Phase 9** | 🔄 In Progress | [Site-Wide Improvement](project-phases/phase-9-site-improvement.md) |
| **Phase 10** | ✅ Complete | [Calculation Simplification](project-phases/phase-10-calculation-simplification.md) — all steps done; engine deduplicated, money units type-safe, MC seeded |
| **Phase 11** | 📋 Planned | [Dead Code Cleanup](project-phases/phase-11-dead-code-cleanup.md) — knip-verified unused files/deps/exports |
| **Future** | 📋 Planned | [Future Enhancements](project-phases/future-enhancements.md) |

## Recent Activity

One line per work session, newest first, capped at the latest 10 entries — when an 11th
arrives, delete the oldest. Full detail lives in the linked history files, never here.
Rules: [docs/README.md](README.md).

## 2026-09-27 — Renamed to financial-planner; repo prepared for public visibility

Slug `financial-planner`, display name "SA Financial Planner" (metadata, manifest, OG image, sidebar wordmark, download filenames); `retirement-calculator-storage` localStorage key deliberately unchanged so saved plans survive. Added README, all-rights-reserved LICENSE, SECURITY.md, least-privilege CI token. Full-history gitleaks scan: only published local-dev demo keys — no rewrite needed. 1003/1003 tests, typecheck/lint/build clean, shadscan 93/100 unchanged. → [full write-up](history/2026-09-27-rename-financial-planner-public-ready.md)

## 2026-08-29 — PWA icon: safe-zone padding, maskable manifest entries, single icon route

Confirmed `icon.tsx`/`icon1.tsx`/`icon2.tsx`/`apple-icon.tsx` were all live Next file-convention routes, not dead code (verified in the rendered `<head>`), then collapsed the three near-identical `icon.tsx`/`icon1.tsx`/`icon2.tsx` files into one `app/icon.tsx` via `generateImageMetadata()` (now serves `/icon/32`, `/icon/192`, `/icon/512`); `apple-icon.tsx` stays separate as its own Next convention. Closed the `maskable-icon` advisory the PWA work below had left open: `PwaIconArtwork`'s foreground chart glyph now sits in an inset `<g transform="translate(2.3 2.14) scale(0.83)">` (background stays full-bleed) so OS icon masks — Windows taskbar/Start pinning, Android adaptive icons, iOS auto-rounding — can't clip the artwork; `app/manifest.ts` adds explicit `purpose: "maskable"` entries. 1003/1003 tests (4 new), typecheck/lint/build clean, shadscan 93/100 unchanged. → [full write-up](history/2026-08-29-pwa-maskable-icon-safe-zone.md)

## 2026-08-29 — PWA: installable + offline-capable

Manifest (`/manifest.webmanifest`, `display: standalone`, teal theme/background), shared-artwork icons (`/icon1` 192, `/icon2` 512, `/apple-icon` 180), and a hand-written `public/sw.js` (network-first navigations with an inline offline fallback page, cache-first `/_next/static/*` into `static-assets-v1`, `no-store` headers on the SW) — no new dependencies. Production-only registration in the root layout + `appleWebApp` metadata. Verified against a production build: SW active/controlling, 38 cached chunks served offline, fallback renders offline with zero console errors and zero CSP violations; Lighthouse 11.7.1 PWA 0.88/1 (`installable-manifest` passes; only advisory is `maskable-icon`). 1002/1002 tests, typecheck/lint/build clean, shadscan 93/100 unchanged. → [full write-up](history/2026-08-29-pwa-installable.md)

## 2026-08-24 — AnimateIcons icon motion: the instrument responds to touch

`@animateicons/react@0.4.3` path-level animated icons on every interactive control — sidebar/bottom-nav icons are the focal moment (animate on row hover/focus), plus hover/focus feedback on quick actions, row actions, chevrons, scenario switcher, theme controls, reset/retry/export. Informational icons stay static. New primitives: `useAnimatedIcon()` hook + `AnimatedIconButton`. Reduced-motion respected; 990/990 tests, typecheck/lint/build clean, shadscan 93/100 unchanged; known cost: 84.7 KB gzip shell chunk (barrel not tree-shaken). Follow-up: theme-toggle moon icon never animated (AnimatePresence remount nulled the shared ref) — dual mounted icons + CSS crossfade. → [full write-up](history/2026-08-24-animateicons-icon-motion.md)

## 2026-08-16 — Vercel build failure fixed: protocol-less site URL

`next build` crashed on Vercel with `ERR_INVALID_URL` at `app/layout.tsx:32` — Vercel injects `VERCEL_PROJECT_PRODUCTION_URL` without a scheme (`retirement-calculator-claude.vercel.app`), and `new URL(siteUrl)` rejects it. Fixed by extracting `resolveSiteUrl()` into `lib/utils/site-url.ts` (prefers `NEXT_PUBLIC_SITE_URL`, normalises protocol-less values to `https://`, falls back to localhost), used by `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts` (robots/sitemap would have emitted protocol-less URLs too). Reproduced the exact Vercel failure locally before fixing; 5 new tests, 990/990 pass, typecheck + build clean under the simulated Vercel env. → [full write-up](history/2026-08-16-vercel-build-url-fix.md)

## 2026-08-16 — Command palette restyled to pre-audit design on cmdk + account-search P0 fixed

The cmdk palette was restyled from the shadcn-default look back to the pre-audit design (520px `rounded-xl shadow-2xl` at top 28%, compact full-width rows, teal icon + `↵` on the selected item, 10px uppercase group headings, `×` clear button, "No results for X" empty state, `bg-background` surface), keeping the audit's real a11y fixes (focus rings, aria, Escape). Also fixed: account search — item `value` was a hex UUID so "tfsa"/"pension"/account names returned "No results found"; now `value={acc.name}` + `keywords={[type label]}`. Removed the teal `focus-within` underline under the search input (kept the `bg-muted/40` focus proxy). Verified live in-browser + typecheck/lint/build clean, 985/985 tests, shadscan still 98/100. → [full write-up](history/2026-08-16-command-palette-restyle.md)

## 2026-08-16 — shadscan accessibility & polish audit: 40 → 98/100

Deterministic `@shadscan/cli@0.16.0` audit (F → A): error-boundary retry buttons in the `error.tsx` files, Suspense fallback, labels on every unlabeled control (Selects, Sliders, Inputs), focus-visible rings where outlines were suppressed, `d` theme hotkey, command palette rebuilt on cmdk + mounted at root, Toaster at root, `app/not-found.tsx`, OG/Twitter images, robots/sitemap, `data-icon` on 22 buttons, "No data yet" chart empty states, async pending states, and light `--primary` 34→30% / dark `--destructive` 50→58% contrast fixes — all browser-verified in both themes and at 320px. `mobile-nav-present` waived (bottom tab bar is the mobile pattern). 985/985 tests, coverage 92.7%. → [full write-up](history/2026-08-16-shadscan-accessibility-audit.md)

## 2026-08-15 — Phase 11 planned: knip-verified dead code cleanup

`npx knip` findings hand-verified by grep; 8 unused files, `@radix-ui/react-tabs` (only used by the unused `tabs.tsx`), ~33 truly dead exports/types and 11 internal-only symbols to un-export are catalogued as a checklist. Excluded after verification: `SelectGroup` (false positive — used by `account-form-dialog.tsx`), `money-basis.type-test.ts` (intentional, exercised by `npm run typecheck`), `tailwindcss`/`tw-animate-css` (consumed via postcss/globals.css). → [phase 11](project-phases/phase-11-dead-code-cleanup.md)

## 2026-08-15 — Bootstrap and data ownership hardening implemented

Phase 9.4 shipped: one XState bootstrap coordinator owns hydration (once per guest/user scope), verified auth, MFA gating, claim, and sync; the auth listener is a pure event forwarder. Explicit `guest`/`user:<id>` persistence scopes with one-time legacy-key migration and sign-out eviction; remote writes guarded by identity+generation re-checks; claim takes an explicit `ClaimSource`; `/print` and the layout consume provider readiness. 985/985 tests, coverage gate green, journeys 08 (MFA) and 09 (bootstrap) pass e2e. → [implementation record](history/2026-08-15-bootstrap-data-ownership-hardening.md) · [plan](superpowers/plans/2026-08-15-bootstrap-data-ownership-hardening.md)

## 2026-08-15 — High-priority plan: bootstrap and data ownership hardening

Phase 9.4 now tracks the architecture work needed to replace overlapping hydration/auth paths with serialized bootstrap, MFA-safe sync, explicit guest/user persistence scopes, and guarded remote writes. → [plan](superpowers/plans/2026-08-15-bootstrap-data-ownership-hardening.md) · [planning record](history/2026-08-15-bootstrap-data-ownership-hardening-plan.md)

## Maintaining This File

See [docs/README.md](README.md) for the three-tier rule and conventions. In short:
full detail goes in a dated `history/` file; phase files carry checkboxes and pending
lists; this file gets a one-line entry above and a status emoji only when a phase's
status genuinely changes.
