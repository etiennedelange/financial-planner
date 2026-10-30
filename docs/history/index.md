# History entries

* [2026-10-30 — docs/ converted to an Open Knowledge Format bundle](2026-10-30-docs-okf-bundle.md) - docs/ is now an OKF v0.2 bundle: frontmatter on every doc, generated index.md per directory, log.md replacing the Recent Activity feed, and a validator.
* [2026-10-24 — CI supply-chain hardening; Next.js 16.4.3 for two critical RCEs](2026-10-24-ci-supply-chain-hardening.md) - CI supply-chain hardening, and Next.js 16.4.3 for two critical RCEs.
* [2026-09-27 — Account control moved from sidebar to top bar](2026-09-27-account-menu-top-bar.md) - Account control moved from the sidebar to the top bar.
* [2026-09-27 — Sign-in dialog behind `NEXT_PUBLIC_AUTH_ENABLED`](2026-09-27-auth-feature-flag.md) - Sign-in dialog gated behind NEXT_PUBLIC_AUTH_ENABLED.
* [2026-09-27 — Rename to financial-planner and prepare the repo to go public](2026-09-27-rename-financial-planner-public-ready.md) - Rename to financial-planner and preparation for making the repo public.
* [PWA: installable + offline-capable via manifest, icons, and service worker](2026-08-29-pwa-installable.md) - PWA: installable and offline-capable via manifest, icons and service worker.
* [PWA icon: safe-zone padding, maskable manifest entries, and a single icon route](2026-08-29-pwa-maskable-icon-safe-zone.md) - PWA icon safe-zone padding, maskable manifest entries and a single icon route.
* [2026-08-24 — AnimateIcons icon motion: the instrument responds to touch](2026-08-24-animateicons-icon-motion.md) - AnimateIcons path-level icon motion on interactive controls.
* [Command palette: restyled to pre-audit design on cmdk + account-search fix](2026-08-16-command-palette-restyle.md) - Command palette restyled to the pre-audit design on cmdk, plus an account-search fix.
* [shadscan accessibility & polish audit (F → A)](2026-08-16-shadscan-accessibility-audit.md) - shadscan accessibility and polish audit, F to A; records the waived findings.
* [Vercel build failure: protocol-less VERCEL_PROJECT_PRODUCTION_URL](2026-08-16-vercel-build-url-fix.md) - Vercel build failure caused by a protocol-less VERCEL_PROJECT_PRODUCTION_URL.
* [High-priority bootstrap and data ownership hardening plan](2026-08-15-bootstrap-data-ownership-hardening-plan.md) - Decision and plan for hardening bootstrap and data ownership after the persist write-gate fix.
* [Bootstrap and Data Ownership Hardening — Implemented](2026-08-15-bootstrap-data-ownership-hardening.md) - Implemented bootstrap and data ownership hardening (Phase 9.4).
* [Persisted plan wiped on reload — pre-hydration writes clobber localStorage](2026-08-15-persist-write-gate.md) - Fix for a persisted plan wiped on reload by pre-hydration writes clobbering localStorage.
* [Monetary input bounds — absurd numbers rejected](2026-08-14-input-max-bounds.md) - Monetary inputs now reject absurd values.
* [Phase 9.1 — NaN/Infinity guards (calculation engines)](2026-08-14-phase-9-1-nan-infinity-guards.md) - NaN/Infinity guards in the calculation engines (Phase 9.1).
* [Phase 9 §9.1 (High): Tax-rule validation against SARS Budget Tax Guide 2026/2027](2026-08-14-phase-9-1-tax-rules-validation.md) - Tax-rule validation against the SARS Budget Tax Guide 2026/2027 (Phase 9.1).
* [Phase 9.3 — UI/UX polish: CSS-variable extraction, loading states, chart data tables, Zod messages](2026-08-14-phase-9-3-ui-polish.md) - Phase 9.3 UI/UX polish: CSS variable extraction, loading states, chart data tables, Zod messages.
* [Auth and 2FA Security Audit](2026-08-10-auth-2fa-security-audit.md) - Security review of authentication, TOTP, recovery codes and AAL handling.
* [Charts page: second critique pass — truthful tooltips, keyboard focus, gallery hierarchy, red deltas](2026-08-10-charts-page-critique-fixes-round-2.md) - Second charts-page critique pass: truthful tooltips, keyboard focus, gallery hierarchy, red deltas.
* [Charts page: design-critique fixes (MC live on route, honest copy, success-rate hierarchy, contrast)](2026-08-10-charts-page-critique-fixes.md) - Charts-page critique fixes: Monte Carlo live on route, honest copy, success-rate hierarchy, contrast.
* [2026-08-10 — Next.js 16.3 upgrade adoption: error boundaries, Rust React Compiler, Instant Navigations](2026-08-10-next-16-3-upgrade-adoption.md) - Adopting Next.js 16.3 features: error boundaries, Rust React Compiler, Instant Navigations.
* [2026-08-09 — Charts Page: Monte Carlo De-emphasised, All Visualisations Centralised](2026-08-09-charts-page-monte-carlo-demoted.md) - Charts page: Monte Carlo de-emphasised and all visualisations centralised.
* [2026-08-08 — Manage Account Moved from Modal to `/calculator/settings`](2026-08-08-account-settings-page-migration.md) - Manage Account moved from a modal to /calculator/settings.
* [2026-08-08 — Local-Dev Fix: Auth Email Links Unreachable (ERR_CONNECTION_REFUSED)](2026-08-08-local-dev-email-verification-fix.md) - Local-dev fix for unreachable auth email links (ERR_CONNECTION_REFUSED).
* [2026-08-08 — Fix: `/auth/mfa` "Could not load your authentication factors." (dev-proxy redirect loop)](2026-08-08-mfa-challenge-dev-proxy-redirect-loop-fix.md) - Fix for /auth/mfa failing to load authentication factors because of a dev-proxy redirect loop.
* [2026-07-26 — Multi-Agent Audit of `75f68f7` + Batch 1 Fixes](2026-07-26-audit-batch-1-fixes.md) - Multi-agent audit of commit 75f68f7 and the first batch of fixes.
* [2026-07-26 — Phase 10: Calculation Simplification (complete)](2026-07-26-phase-10-calculation-simplification.md) - Phase 10 complete: engine deduplicated, money units type-safe, Monte Carlo seeded.
* [Multi-Agent Audit: P0 Fixes + Tax Config Primary-Source Verification](2026-07-11-multiagent-audit-p0-fixes-and-tax-config-verification.md) - Multi-agent audit P0 fixes and primary-source verification of the tax config.
* [2026-07-11: P0 & P1 Calculation Bug Fixes via TDD](2026-07-11-p0-p1-fixes.md) - P0 and P1 calculation bug fixes made test-first.
* [2026-07-06 — Locked Accent Migration: Gold → Teal](2026-07-06-teal-accent-migration.md) - Migration from the gold accent to the locked teal accent, ending the dual-theme experiment.
* [Plan Page Delight Enhancement — 2026-07-04](2026-07-04-delight-animations.md) - Micro-interaction enhancements on the Plan page.
* [Drawdown Strategy Divergence After Year 1](2026-06-21-drawdown-strategy-divergence-fix.md) - Fix for drawdown strategies diverging after year 1; introduces shared drawdown-withdrawal.ts.
* [Phase 9 §9.1 (Critical): Calculation Correctness & Deduplication](2026-06-20-phase9-calculation-dedup-and-guards.md) - Phase 9 §9.1 critical calculation correctness fixes and deduplication.
* [Second Audit Pass: 2026/2027 Tax Config, Net-Income Reconciliation, MC Lump Sum Tax](2026-06-20-second-audit-tax-config-net-income-mc-lumpsum-tax.md) - Second audit pass: 2026/2027 tax config, net-income reconciliation, Monte Carlo lump sum tax.
* [SA Retirement Calc Validator Audit: Lump Sum, Annuitisation Cap, MC Tax, CGT Exclusion](2026-06-20-validator-audit-lump-sum-and-cgt-fixes.md) - Validator audit fixes: lump sum, annuitisation cap, Monte Carlo tax and CGT exclusion.
* [2026-06-16: Form Persistence Fixes & Anon→Auth Migration](2026-06-16-form-persistence-and-migration.md) - Form state restoration fixes and anonymous-to-authenticated data migration.
* [2026-05-10 — Phase 5 Export Functionality + Bug Fixes](2026-05-10-phase5-export-and-bug-fixes.md) - Phase 5 export functionality (print/PDF route) and bug fixes.
* [Section 11F Excess Contribution Credit (2026-05-10)](2026-05-10-section-11f-excess-contribution-credit.md) - Carry-forward credit for pension/RA/preservation contributions exceeding the Section 11F cap.
* [2026-05-09 — Account Depletion Tracking & RA Optimisation](2026-05-09-account-depletion-and-ra-optimisation.md) - Account depletion tracking in drawdown, and RA contribution optimisation.
* [2026-05-09: TFSA Lifetime Limits and Medical Aid Tax Credits](2026-05-09-tfsa-limits-and-medical-aid-credits.md) - Phase 6 tax features: TFSA lifetime limit tracking and medical aid tax credits.
* [Display Mode Consistency and Lump Sum Bug Fixes (2026-04-27)](2026-04-27-display-mode-and-lump-sum-fixes.md) - Display-mode consistency in the calculations breakdown, and lump sum bug fixes.
* [Lump Sum Commutation UI & Slider Performance Fix (2026-04-27)](2026-04-27-lump-sum-commutation-ui.md) - Lump sum commutation UI (Phase 6) and a slider performance fix.
* [Dependency Upgrade to Latest Versions](2026-04-11-dependency-upgrade-to-latest.md) - Upgrade of dependencies to their latest versions, with the config changes it needed.
* [Scenario Comparison Methodology Fix](2026-01-15-scenario-comparison-methodology-fix.md) - Fix to the scenario comparison methodology.
* [2026-01-12: Fix Stagnant Account Bug and Key Insights Logic](2026-01-12-fix-stagnant-accounts-and-insights.md) - Fix for the stagnant-account (0% return) bug that reduced total projections, and the key insights logic.
* [Retirement Tax Implementation - 2026-01-07](2026-01-07-retirement-tax-implementation.md) - Complete SA retirement tax calculation system with full UI integration.
* [2026-01-05: Insights Tab Fix & Testing Framework Documentation](2026-01-05-insights-tab-fix-and-testing-framework.md) - Insights tab fix and the start of the testing and validation framework.
* [Testing & Validation Plan](2026-01-05-testing-and-validation-plan.md) - Plan for the Phase 1.5 testing and validation framework.
* [Retirement Calculator Accuracy Validation Report](2026-01-02-accuracy-validation-report.md) - Accuracy validation of the calculator by the sa-retirement-calc-validator agent.
* [Project Changes: 2026-01-02](2026-01-02-calculation-fixes-and-ui-improvements.md) - Calculation accuracy fixes to match Excel FV, plus UI improvements.
