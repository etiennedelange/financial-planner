# Documentation Update Log

## 2026-11-14
* **Update**: [E2E journey and input follow-ups logged as TODO](project-phases/future-enhancements.md) - Journeys 4-7, the unrun auth journeys, WebKit, seed-version drift and the PR #43 follow-ups are listed under Pending in future-enhancements.
* **Update**: [Input size, password-manager opt-out, phone-layout e2e fixes](history/2026-11-14-number-field-inputs.md) - Field values match body text (14px; 16px on phones), number and name fields opt out of 1Password and similar, the display-mode button gets an accessible name on phones, and journeys 1-3 pass on desktop, tablet and phone.
* **Update**: [E2E journeys 1-3 repaired; wizard Continue no longer saves](history/2026-11-14-number-field-inputs.md) - The journeys now drive the sidebar app and assert stored values; they exposed a bug where one click on Continue in the add-account wizard saved the account and skipped step 2.
* **Update**: [Account delete without a confirmation dialog](history/2026-11-14-number-field-inputs.md) - One click deletes; the toast's Undo (now 8 s instead of 3 s) is the safety net, so the floating dialog is gone.
* **Update**: [NumberField on every remaining form](history/2026-11-14-number-field-inputs.md) - Risk volatility, drawdown, account dialog and expense editors use `NumberField`/`NumberInput`, and the base `Input` gets the stronger border and focus ring.
* **Update**: [NumberField for Plan inputs](history/2026-11-14-number-field-inputs.md) - Plan, Retirement Goals and Market Assumptions fields now show grouped values with the unit inside, widths that fit the data, steppers and a clearer focus ring, from one tested component.
* **Update**: [AI summaries: Workers AI, your own key, and the fixes that made them work](history/2026-11-14-ai-providers-own-key.md) - Explain My Plan was always 401 with sign-in off and failed on older plans; it now runs on Vercel AI Gateway or Cloudflare Workers AI, accepts the user's own key, and reports real errors.
* **Update**: [Debug page second critique pass](history/2026-11-14-debug-reconciliation-page.md) - Filter now covers Reconciliation, tolerance shown on matches, one empty-state message, a11y and mobile figure fixes.
* **Update**: [Debug page critique fixes](history/2026-11-14-debug-reconciliation-page.md) - Verdict line, shadcn tabs instead of sticky anchors, stacked checks on mobile, tolerance and per-check copy on mismatch.
* **Update**: [Debug window becomes a reconciliation page](history/2026-11-14-debug-reconciliation-page.md) - `/calculator/debug` replaces the floating dialog: one tested model, four engine reconciliation checks, wrong-number states fixed, mobile reachable.
* **Update**: [Stale service-worker cache broke the Risk workers](history/2026-11-14-stale-service-worker-cache.md) - Asset cache bumped to v2 and the worker now names the keys of a malformed request.
* **Update**: [Bug and performance audit](history/2026-11-14-bug-and-performance-audit.md) - Dead Risk worker is replaced and failures are shown, superseded runs are cancelled, store sync races and the shortfall amount are fixed, and render cost is trimmed.
* **Update**: [Theme contrast fixes](history/2026-11-14-theme-contrast-fixes.md) - Light-mode warning and success text and input borders in both themes now meet WCAG; a test checks every text and boundary token pair in both themes against `globals.css`.

## 2026-11-12
* **Update**: [Risk simulation stuck on 'Waiting for simulation': one worker entry](history/2026-11-12-single-worker-entry.md) - The second worker entry added for #34 was crossed with the first in the production build; both request kinds now go through `simulation.worker.ts`, guarded by a test.
* **Update**: [Page freezes after editing Plan inputs (issue #34)](history/2026-11-12-page-freeze-scenario-worker.md) - A hidden Risk page re-ran 3 × 1,000 main-thread simulations on every Plan keystroke; the scenario comparison now runs in a Web Worker, and Market Assumptions validate before saving (store v3 repairs bad persisted rates).

## 2026-11-04
* **Update**: [Overview redesigned: verdict first](history/2026-11-04-overview-verdict-first.md) - The metric-tile grid and Key Insights give way to one verdict sentence, a market-risk caveat linking to Risk, a timeline and a next-best-step card.
* **Update**: [Balance charts now respect Today's Value](history/2026-11-04-charts-today-value.md) - Fan chart and growth chart always plotted nominal rands; series builders now take a required display basis.
* **Update**: [Coverage gaps closed: worker lifecycle, currency, tooltips](history/2026-11-04-coverage-gaps-worker-currency.md) - Worker lifecycle extracted to a tested client; currency tests found and fixed five display bugs; global branch coverage back above 85% (82.8% → 85.87%).
* **Update**: [Balance charts plotted each year a year early](history/2026-11-04-chart-age-off-by-one.md) - Both balance charts put year-end balances at the age during the year (R66.3M shown at 65 vs R65.0M at retirement); fixed with shared series builders; table deflation corrected; Overview says "steady returns only".
* **Update**: [Historical stress test: a 2008-style first year of retirement](history/2026-11-04-historical-stress-test.md) - Deterministic Risk-page card comparing steady returns with each investment's worst researched 12-month fall in year one; reuses the projection engine through a required drawdown return override.
* **Update**: [Success shown as a cautious–central range](history/2026-11-04-success-range.md) - Risk page runs the same futures at 1× and 1.3× volatility and shows "likely X–Y%"; verdict follows the lower bound; success labels unified; scenario memo no longer reruns on volatility keystrokes.
* **Update**: [Investment types per account](history/2026-11-04-investment-types-per-account.md) - Optional investmentType drives Monte Carlo volatility and one-factor correlation; untyped accounts reproduce the old result exactly; DB column, import, form, list and Risk page updated.
* **Update**: [Investment-type risk research: volatilities, worst falls and correlations in rand](history/2026-11-04-investment-type-risk-research.md) - Sourced rand volatility, worst 12-month return, drawdown and one-factor loadings for six investment types; gaps listed.
* **Update**: [Monte Carlo expected return is the typical (median) return](history/2026-11-04-mc-median-return-basis.md) - The −σ²/2 drag removed so the projection is the middle of the Monte Carlo range; tests, golden file and methodology copy updated.

## 2026-11-01
* **Update**: [Multi-agent audit fixes: on-track definition, headline income, MC bias, withdrawal order, s11F carry-forward](history/2026-11-01-audit-fixes.md) - Five audit findings fixed with tests; the withdrawal-order trade-off measured; main vs branch compared on the user's exact plan.

## 2026-10-31
* **Update**: [Risk page: Monte Carlo and volatility moved into their own section](history/2026-10-31-risk-page.md) - New /calculator/risk page holds every Monte Carlo input and result; all other pages, and the AI narrative, show deterministic results only.
* **Update**: [SA retirement calculation audit: tax relief setting, living annuity band, monthly drawdown, MC correlation](history/2026-10-31-sa-retirement-calc-audit.md) - Seven confirmed calculation defects fixed with independent tests; future tax relief defaults to the last decade's SARS history with a no-relief stress test; open statutory gaps listed.
* **Update**: [Next.js 16.4 re-verified; in-range dependency refresh; pnpm audit clean](history/2026-10-31-next-16-4-verification-dep-refresh.md) - Full suite re-run on Next 16.4.3 (closes #9); dev-only undici and zod advisories fixed; Playwright journeys found stale.
* **Update**: [Lint, format and tests moved to Vite+ (Oxlint, Oxfmt, Vitest 5)](history/2026-10-31-vite-plus-oxc-migration.md) - ESLint and Prettier-style tooling replaced by `vp check`; the money-time guard ported to an Oxlint plugin; repo reformatted in one blame-ignored commit.

## 2026-10-30
* **Update**: [docs/ frontmatter, log.md and docs:check (OKF-style)](history/2026-10-30-docs-okf-bundle.md) - Frontmatter on every doc, log.md replacing the Recent Activity feed, and docs:check; generated OKF indexes were added then removed after an A/B test showed no benefit.

## 2026-10-24
* **Update**: [CI supply-chain hardening; Next.js 16.4.3 for two critical RCEs](history/2026-10-24-ci-supply-chain-hardening.md) - CI supply-chain hardening, and Next.js 16.4.3 for two critical RCEs.

## 2026-09-27
* **Update**: [Account control moved from sidebar to top bar](history/2026-09-27-account-menu-top-bar.md) - Account control moved from the sidebar to the top bar.
* **Update**: [Sign-in dialog behind `NEXT_PUBLIC_AUTH_ENABLED` flag](history/2026-09-27-auth-feature-flag.md) - Sign-in dialog gated behind NEXT_PUBLIC_AUTH_ENABLED.
* **Update**: [Renamed to financial-planner; repo prepared for public visibility](history/2026-09-27-rename-financial-planner-public-ready.md) - Rename to financial-planner and preparation for making the repo public.

## 2026-08-29
* **Update**: [PWA icon: safe-zone padding, maskable manifest entries, single icon route](history/2026-08-29-pwa-maskable-icon-safe-zone.md) - PWA icon safe-zone padding, maskable manifest entries and a single icon route.
* **Update**: [PWA: installable + offline-capable](history/2026-08-29-pwa-installable.md) - PWA: installable and offline-capable via manifest, icons and service worker.

## 2026-08-24
* **Update**: [AnimateIcons icon motion: the instrument responds to touch](history/2026-08-24-animateicons-icon-motion.md) - AnimateIcons path-level icon motion on interactive controls.

## 2026-08-16
* **Update**: [Vercel build failure fixed: protocol-less site URL](history/2026-08-16-vercel-build-url-fix.md) - Vercel build failure caused by a protocol-less VERCEL_PROJECT_PRODUCTION_URL.
* **Update**: [Command palette restyled to pre-audit design on cmdk + account-search P0 fixed](history/2026-08-16-command-palette-restyle.md) - Command palette restyled to the pre-audit design on cmdk, plus an account-search fix.
* **Update**: [shadscan accessibility & polish audit: 40 → 98/100](history/2026-08-16-shadscan-accessibility-audit.md) - shadscan accessibility and polish audit, F to A; records the waived findings.
