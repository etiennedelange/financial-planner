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
| **Future** | 📋 Planned | [Future Enhancements](project-phases/future-enhancements.md) |

## Recent Activity

One line per work session, newest first, capped at the latest 10 entries — when an 11th
arrives, delete the oldest. Full detail lives in the linked history files, never here.
Rules: [docs/README.md](README.md).

## 2026-08-15 — High-priority plan: bootstrap and data ownership hardening

Phase 9.4 now tracks the architecture work needed to replace overlapping hydration/auth paths with serialized bootstrap, MFA-safe sync, explicit guest/user persistence scopes, and guarded remote writes. → [plan](superpowers/plans/2026-08-15-bootstrap-data-ownership-hardening.md) · [planning record](history/2026-08-15-bootstrap-data-ownership-hardening-plan.md)

## 2026-08-15 — Persisted plan wiped on reload; pre-hydration writes gated

Both stores use `skipHydration` + a layout-driven `rehydrate()`, and zustand persist writes to storage on every `set()`; `SupabaseProvider`'s `setSessionId` fired before rehydrate's read settled, persisting the pre-hydration defaults over the saved plan (signed-in reloads masked it via `syncFromDb`; signed-out reloads lost the plan permanently). New `createGatedPersistStorage` drops writes until the first rehydrate settles; `SupabaseProvider.init()` awaits rehydrate before auth writes. 7 new tests incl. a regression test that fails without the gate; 926/926 tests. → [history](history/2026-08-15-persist-write-gate.md)

## 2026-08-14 — Monetary inputs physically reject absurdly large numbers

Unbounded monetary fields (annual income, retirement goals, account balances/contributions, drawdown withdrawals, medical aid, expenses) accepted values far past `Number.MAX_SAFE_INTEGER`, which lost precision, poisoned calculations, and overflowed the input padding. New `MAX_MONETARY_AMOUNT` (R1 trillion) + `isAllowedMonetaryInput`; `useBoundedMonetary` blocks over-cap input before it enters the DOM (`beforeinput`), so holding a key just stops adding digits; stores persist `version: 2` + `migrate` to clamp stale pre-fix data. 920 tests. → [history](history/2026-08-14-input-max-bounds.md)

## 2026-08-14 — NaN/Infinity guards; coverage gap closed

Non-finite engine inputs (NaN balance/return/age, 0% withdrawal rate) no longer poison divisions into NaN/±Infinity: new `finiteOrZero`/`safePositiveDivide`/`sanitizeAccounts` guards in `invariant-guards.ts`, applied across both engines + optimal-contribution; non-finite ages route through the empty result. 40 new tests; branches 84.61% → 85.1% (global coverage red resolved). Supabase error-context item audited as already resolved. 898 tests. → [history](history/2026-08-14-phase-9-1-nan-infinity-guards.md)

## 2026-08-14 — Phase 9.3 UI polish: CSS vars, loading states, chart data tables

All open 9.3 Medium/Low items done: `--sidebar-width` + `--chart-height-*` tokens, `icon-sm` button variant, import/submit/print loading states (fixed latent `/print` hydration bug), reusable collapsible chart data tables for a11y, SA-context Zod messages, dead `success-gauge.tsx` deleted. 4 items audited as already resolved. 867 tests. → [history](history/2026-08-14-phase-9-3-ui-polish.md)

## 2026-08-14 — Phase 9.1 tax rules validated against Budget Tax Guide 2026/2027

All four open 9.1 items resolved as documentation: TFSA re-contribution room moot (no post-retirement contributions), s6A medical credit has no minimum contribution (premise was wrong), DWT documented as a known simplification (20% rate confirmed), spending-phase multipliers sourced (US spending-smile research, no SA equivalent). 867 tests. → [history](history/2026-08-14-phase-9-1-tax-rules-validation.md)

## 2026-08-10 — Charts critique round 2: truthful tooltips, keyboard focus, gallery hierarchy

Tooltip pipeline rebuilt in shared `lib/utils/chart-tooltip.ts` (no more "Age undefined" or "R 100" success rates), 2px teal `:focus-visible` ring on chart surfaces, page-level verdict strip, negative deltas moved to Signal Red. 862 tests. → [history](history/2026-08-10-charts-page-critique-fixes-round-2.md)

## 2026-08-10 — Next.js 16.3 feature adoption

Added root + calculator error boundaries using the new `retry()` API, enabled the native Rust React Compiler, and turned on Instant Navigations (`cacheComponents` + `partialPrefetching`); root layout opts out via `instant = false`. 854 tests. → [history](history/2026-08-10-next-16-3-upgrade-adoption.md)

## 2026-08-10 — Auth/2FA: all nine open risks resolved

Same-origin validation on auth-callback redirects, 2FA-safe account deletion, rate-limited `plan-narrative` endpoint, atomic single-use recovery codes, Turnstile startup check, `pnpm audit` clean. 840 tests. → [remediation record](security/auth-2fa-risk-register.md#remediation-record-2026-08-10)

## 2026-08-10 — Auth/2FA risk register filed; charts page hardened

Triple-check security audit opened 9 risks (resolved the same day, above). Charts fixes: MC worker now runs on `/calculator/charts`, honest empty states, success rate promoted and colour-driven, AA contrast on both themes, single H1 per page. 810 tests. → [risk register](security/auth-2fa-risk-register.md) · [audit](history/2026-08-10-auth-2fa-security-audit.md) · [charts fixes](history/2026-08-10-charts-page-critique-fixes.md)

---

*Older activity (2026-01 → 2026-08-08): see the dated files in [history/](history/) and the checkbox records in [project-phases/](project-phases/).*

*Older activity (2026-01 → 2026-08-08): see the dated files in [history/](history/) and the checkbox records in [project-phases/](project-phases/).*

## Maintaining This File

See [docs/README.md](README.md) for the three-tier rule and conventions. In short:
full detail goes in a dated `history/` file; phase files carry checkboxes and pending
lists; this file gets a one-line entry above and a status emoji only when a phase's
status genuinely changes.
