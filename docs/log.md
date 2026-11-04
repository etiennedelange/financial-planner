# Documentation Update Log

## 2026-11-04
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
