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

## 2026-08-10 — Charts critique round 2: truthful tooltips, keyboard focus, gallery hierarchy

Tooltip pipeline rebuilt in shared `lib/utils/chart-tooltip.ts` (no more "Age undefined" or "R 100" success rates), 2px teal `:focus-visible` ring on chart surfaces, page-level verdict strip, negative deltas moved to Signal Red. 862 tests. → [history](history/2026-08-10-charts-page-critique-fixes-round-2.md)

## 2026-08-10 — Next.js 16.3 feature adoption

Added root + calculator error boundaries using the new `retry()` API, enabled the native Rust React Compiler, and turned on Instant Navigations (`cacheComponents` + `partialPrefetching`); root layout opts out via `instant = false`. 854 tests. → [history](history/2026-08-10-next-16-3-upgrade-adoption.md)

## 2026-08-10 — Auth/2FA: all nine open risks resolved

Same-origin validation on auth-callback redirects, 2FA-safe account deletion, rate-limited `plan-narrative` endpoint, atomic single-use recovery codes, Turnstile startup check, `pnpm audit` clean. 840 tests. → [remediation record](security/auth-2fa-risk-register.md#remediation-record-2026-08-10)

## 2026-08-10 — Auth/2FA risk register filed; charts page hardened

Triple-check security audit opened 9 risks (resolved the same day, above). Charts fixes: MC worker now runs on `/calculator/charts`, honest empty states, success rate promoted and colour-driven, AA contrast on both themes, single H1 per page. 810 tests. → [risk register](security/auth-2fa-risk-register.md) · [audit](history/2026-08-10-auth-2fa-security-audit.md) · [charts fixes](history/2026-08-10-charts-page-critique-fixes.md)

## 2026-08-09 — Charts page created; Monte Carlo demoted from Overview

All visualisations centralised on `/calculator/charts` (portfolio growth, Will It Last?, income sustainability, sensitivity tornado, scenario comparison, cost of delay); Overview keeps only a quiet sim-status line. New tested calc utils `income-sustainability.ts` + `sensitivity-tornado.ts`. 806 tests. → [history](history/2026-08-09-charts-page-monte-carlo-demoted.md)

## 2026-08-08 — Fix: `/auth/mfa` dev-proxy redirect loop

The `isMfaExempt` allowlist now covers the dev-only `/supabase/*` proxy path — a one-line fix for the redirect-to-self that broke the TOTP challenge page in the devcontainer. → [history](history/2026-08-08-mfa-challenge-dev-proxy-redirect-loop-fix.md)

## 2026-08-08 — Local-dev auth email links fixed

New GoTrue confirmation/recovery templates route links through the app origin; the dev proxy forwards redirects manually instead of following them. Verified end-to-end via Playwright + Mailpit. → [history](history/2026-08-08-local-dev-email-verification-fix.md)

## 2026-08-08 — Account management moved from modal to `/calculator/settings`

Full account surface (email/password, 2FA, sessions, deletion, export) rebuilt as a `PageCard` settings page; dead `user-menu.tsx` deleted; fixed the missing Turnstile token that broke reauthentication. → [history](history/2026-08-08-account-settings-page-migration.md)

## 2026-08-08 — Auth-hardening phase complete

13 tasks: mandatory login, optional TOTP 2FA enforced at the RLS layer, session management, POPIA self-service deletion/export, per-request CSP nonces, Turnstile bot protection. 1 critical + 4 important bugs fixed; 789 tests. → [phase 3](project-phases/phase-3-user-accounts.md)

## 2026-07-26 — Phase 10 complete: engine deduplication, type-safe money, seeded MC

Three copies of the withdrawal function became one shared export; branded `Rands<B>` money units; seeded Monte Carlo (flaky → deterministic); golden-output harnesses for both engines. Also fixed the replacement-ratio inflation bug and unrecorded final-year depletion. 698 tests. → [history](history/2026-07-26-audit-batch-1-fixes.md) · [phase 10](project-phases/phase-10-calculation-simplification.md)

## 2026-07-11 — Debug window redesign + P0/P1 calculation fixes via TDD

Debug window moved to a centered Dialog. Fixed ~5x overstated "today's Rands" income, structurally-zero shortfall, medical aid escalating at 5.5% instead of 9%, Box-Muller `log(0)`, MC 0-runs NaN, negative cost-of-delay, and added TFSA excess-contribution penalty tracking. SARS constants verified against the Budget 2026 PDF. → [P0/P1 fixes](history/2026-07-11-p0-p1-fixes.md) · [audit](history/2026-07-11-multiagent-audit-p0-fixes-and-tax-config-verification.md)

---

*Older activity (2026-01 → 2026-07-06): see the dated files in [history/](history/) and the checkbox records in [project-phases/](project-phases/).*

## Maintaining This File

See [docs/README.md](README.md) for the three-tier rule and conventions. In short:
full detail goes in a dated `history/` file; phase files carry checkboxes and pending
lists; this file gets a one-line entry above and a status emoji only when a phase's
status genuinely changes.
