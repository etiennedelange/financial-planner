# SA Retirement Calculator - Project Phases

This document provides an overview of all project phases. For detailed information about each phase, see the individual phase files linked below.

## Phase Overview

Based on REQUIREMENTS.md, the project is being developed in the following phases:

| Phase | Status | Documentation |
|-------|--------|---------------|
| **Phase 1** | ✅ Complete | [Calculation Accuracy](project-phases/phase-1-calculation-accuracy.md) |
| **Phase 1.5** | ✅ Complete | [Testing & Validation](project-phases/phase-1-5-testing-validation.md) |
| **Phase 1.6** | ✅ Complete | [Performance Optimization](project-phases/phase-1-6-performance-optimization.md) |
| **Phase 1.7** | ✅ Complete | [Next 16 / React 19 / Tailwind v4 Modernization](project-phases/phase-1-7-modernization.md) |
| **Phase 2** | 🔄 In Progress | [Supabase Integration](project-phases/phase-2-supabase.md) |
| **Phase 3** | ✅ Complete | [User Accounts](project-phases/phase-3-user-accounts.md) |
| **Phase 4** | ✅ Complete | [Data Persistence](project-phases/phase-4-data-persistence.md) |
| **Phase 5** | 🔄 In Progress | [Export Functionality](project-phases/phase-5-export-functionality.md) |
| **Phase 6** | ✅ Complete | [Enhanced Tax Calculations](project-phases/phase-6-enhanced-tax.md) |
| **Phase 7** | ✅ Complete | [UI Redesign — Sidebar App Shell](project-phases/phase-7-ui-redesign.md) |
| **Phase 8** | ✅ Complete | [Expense Tracker](project-phases/phase-8-expense-tracker.md) |
| **Phase 9** | 🔄 In Progress | [Site-Wide Improvement](project-phases/phase-9-site-improvement.md) |
| **Future** | 📋 Planned | [Future Enhancements](project-phases/future-enhancements.md) |

## Current Status Summary

**Latest Update (2026-07-06) — Locked accent migrated from gold to teal:**
- ✅ **Retired the gold/teal-yellow color-theme switcher** — the dual-theme experiment (`ColorThemeProvider`, `theme-gold`/`theme-teal-yellow` classes) is gone; the system is back to the original "one locked accent" philosophy, now with teal instead of gold
- ✅ **`app/globals.css`** — `--primary`, `--ring`, `--chart-1/2/3` recolored to a teal palette (`162 70% 34%` light / `162 70% 55%` dark primary; chart-2/3 use complementary deep-teal and mint tones); `--chart-4` (blue) and `--chart-5` (red) left unchanged
- ✅ **Deleted dead code** — `components/color-theme-context.tsx`, `color-theme-provider.tsx`, `color-theme-toggle.tsx` (the latter two were an unused earlier 6-color-picker experiment, never wired into the app)
- ✅ **`components/theme-toggle.tsx`** simplified back to a 2-state Light/Dark toggle; `app/layout.tsx` no longer needs a custom pre-hydration `<script>` (`next-themes` handles dark-mode flash prevention on its own)
- ✅ **`docs/THEMING.md`, `DESIGN.md`, `.impeccable/design.json`, `CLAUDE.md`** all updated to describe the single locked teal accent
- 🎯 See `docs/docs/history/2026-07-06-teal-accent-migration.md` for full rationale and color mapping

**Previous Update (2026-07-04 @ 21:10) — Accounts dialog: live portfolio impact preview:**
- ✅ **New `components/ui/spring-number.tsx`** — Reusable critically-damped spring-physics number display (no overshoot/bounce), replacing the ad-hoc unused `AnimatedNumber` previously dead-coded in `accounts-page.tsx`
- ✅ **New `components/accounts/portfolio-impact-strip.tsx`** — Add/Edit Account dialog now shows a live "Portfolio impact" panel: total balance, weighted net return, and monthly contribution recompute against the store's other accounts on every keystroke, with spring-animated ticking numbers and up/down arrows on changed rows
- ✅ Wired into both the 2-step Add wizard (`Step1`/`Step2`) and the single-view Edit form in `account-form-dialog.tsx`, sharing one `form.watch()` across steps so the panel stays consistent as the user moves between steps
- 🐛 **Bug caught during browser verification and fixed:** initial implementation flagged a row "changed" via a raw-value epsilon threshold, which could disagree with the rendered text (e.g. a return moving from 8.955% → 8.917% is a tiny raw delta but crosses a rounding boundary, rendering "9.0%" → "8.9%" while still labeled "(unchanged)"). Fixed by comparing the *formatted* strings instead of raw deltas
- ✅ All 573 tests passing; `npm run build` clean; verified interactively via Chrome DevTools MCP in both light and dark themes

**Previous Update (2026-07-04 @ 20:30) — Plan page delight enhancement pass:**
- ✅ **New `components/ui/animated-value.tsx`** — Reusable component for smooth number value transitions with fade-in/fade-out animation; respects reduced-motion preferences; accepts format functions for currency, percentages, etc.
- ✅ **Derived value animations across Plan page forms:**
  - Personal Info: Years to retirement, years in retirement, annual income display now animate on change (fade-in when value appears, fade-out when cleared)
  - Retirement Goals: Desired monthly income (today & at retirement), legacy goal amount animate smoothly when input changes
  - Drawdown Strategy: Lump sum calculated amount animates when the lump sum slider moves
- ✅ **Summary box reveal animation** — The "-15 years until retirement | 70 years in retirement" box fades in when the user inputs valid ages; animates out if values become invalid
- ✅ **Form input feedback enhancement** — Annual income display switches between populated/empty states with smooth animation instead of instant appearance/disappearance
- ✅ All 573 tests passing; TypeScript type safety maintained; build succeeds; no breaking changes
- 🎯 **Delight moment pattern:** Animations are under 200ms, use ease-out curves, fade-based (not distraction-inducing), respect user motion preferences, enhance precision/control without noise

**Previous Update (2026-07-02) — Plan page delight pass:**
- ✅ **Drawdown strategy conditional fields** — Withdrawal Floor & Ceiling and Guardrail Bands now reveal/collapse with a `motion/react` height+opacity animation (reduced-motion aware) instead of an instant DOM show/hide
- ✅ **Slider tactile feedback** — `components/ui/slider.tsx` thumb scales up with a gold ring glow on active drag
- ✅ **Compounding Method selector** — replaced the hard color-swap button pair with a shared-`layoutId` sliding gold pill (Linear/Raycast-style segmented control)
- ✅ **SA-defaults reset button** — `RotateCcw` icon spins on click as tactile confirmation
- ✅ **New `components/ui/field-error.tsx`** — validation errors fade/slide in instead of popping in abruptly; adopted in personal-info-form and retirement-goals-form
- ✅ **Select component focus ring fix** — Implemented `SelectOpenedByPointerContext` to suppress Radix's auto-refocus for pointer-driven selections, removing stray focus ring after mouse clicks while preserving keyboard navigation feedback
- 🎯 **Found, not fixed:** Personal Info / Retirement Goals forms never actually trigger their Zod validation errors — `useForm` has no `mode` set and no submit handler, so RHF's default `onSubmit` trigger never runs. Tracked in Phase 9.3 Low Priority.

**Previous Update (2026-06-28) — Accounts page full rebuild to match app design language:**
- ✅ **Accounts page rebuilt** — replaced floating hero number + 2-col card grid + custom section headers with `PageCard` + `SectionLabel` structure matching Overview/Expenses/Plan; compact horizontal list rows with inline expand-in-place detail accordion; type colors constrained to type badge chip and allocation bar (data encoding) only; no colored top-bar stripes; `rounded-lg` throughout
- ✅ **Expand interaction** — click row to reveal `EXPECTED RETURN / ANNUAL FEES / NET RETURN / ESCALATION` + TFSA limit bars (where applicable); edit/delete actions appear on hover
- ✅ **Portfolio summary card** — total balance, thin allocation bar, legend + stats (monthly, net return, account count) all in a single compact `PageCard`; `Add Account` + `Seed` in trailing slot; build clean, no TS errors
- 🎯 **Next:** Empty chart placeholders still dominate viewport before any data is added

**Previous Update (2026-06-28) — UI Polish: floating action bar + CTA cleanup:**
- ✅ **`FloatingActionBar` component** — new `components/ui/floating-action-bar.tsx`; fixed-position bar with scroll-hide behavior (hides after 12px down-scroll past 80px, shows after 8px up-scroll); clears BottomNav on mobile (`bottom-14`), respects sidebar on desktop (`md:left-[220px]`)
- ✅ **Accounts page** — FloatingActionBar with "Add Account" (primary) + "Seed" (secondary) actions; removed ghost "Add another account" button from populated list bottom
- ✅ **Expenses page** — FloatingActionBar with "New Group" primary action and hint text
- ✅ **Redundant CTAs removed** — "Add accounts" nudge banner removed from `dashboard-metrics-grid.tsx`; overview now shows `GettingStarted` exclusively when no projection exists (was showing both `GettingStarted` and an empty `KeyInsightsSummary` card in parallel)
- ✅ **All prior Phase 9.3 high-priority items confirmed complete** — success rate color logic, semantic tokens, aria labels, delete confirmation, toast notifications (all done 2026-06-27, docs accidentally reverted; restored)
- 🎯 **Next:** Empty chart placeholders still dominate viewport when no data; Phase 9.1 High Priority remaining items (TFSA re-contribution room, dividend withholding tax)

**Previous Update (2026-06-21) — Drawdown strategies now diverge after year 1:**
- ✅ **Per-year withdrawal recompute** — new shared `calculateNextWithdrawal()` (`lib/calculations/utils/drawdown-withdrawal.ts`) replaces the blind `annualWithdrawal *= 1 + inflationRate` that every strategy fell back to from year 1 onward; called from both `projection-engine.ts` and `simulation-engine.ts`
- ✅ **Fixed Percentage** now recomputed against the live balance every year (Monte Carlo retains the existing "greater of % or desired income" floor); **Variable Percentage** redefined for year 1+ as percentage-of-portfolio clamped to the inflation-adjusted min/max band every year (not just t=0); **Guardrails** implements the Guyton-Klinger ±10% decision rule against configurable upper/lower bands (default 20%)
- ✅ **Guardrail bands and min/max now editable in the main UI** — `drawdown-strategy-form.tsx` gained "Withdrawal Floor & Ceiling" inputs (Variable Percentage / Guardrails) and "Guardrail Bands" sliders (Guardrails only); previously debug-window-only
- ✅ 21 new tests (14 unit + 5 deterministic-engine + 2 Monte Carlo); 563/563 tests pass; build succeeds; coverage 96.6-100% on touched calculation files
- ⚠️ UI changes not verified in a live browser this session (chrome-devtools MCP browser could not launch headful in this sandbox) — verified by code review against the `DrawdownConfig` type contract instead
- 🎯 **Next:** Phase 9.1 High Priority remaining items (TFSA re-contribution room, dividend withholding tax) per suggested work order

**Previous Update (2026-06-20) — Second audit pass: 2026/2027 tax config, net-income reconciliation, MC lump sum tax:**
- ✅ **2026/2027 SARS figures corrected** — `tax-year.config.ts` income tax brackets, medical aid tax credits, and CGT annual exclusion were carried over from the prior tax year; updated to the current `INCOME_TAX_BRACKETS_CONFIG` (top bracket now starts at R1,878,600), `MEDICAL_AID_CREDITS_CONFIG` (R376 member/first dependant, R254 additional), and `CGT_ANNUAL_EXCLUSION_CONFIG.individual` (R50,000, up from R40,000); rebates and tax thresholds were verified self-consistent and left unchanged
- ✅ **`monthlyNetIncomeAtRetirement` mismatch fixed** — `projection-engine.ts` previously recomputed tax on the full gross withdrawal via a flawed shortcut, ignoring medical aid credits and account-type tax segregation, so it disagreed with the detailed "Sample Retirement Payslip" breakdown; now sourced directly from the first drawdown year's already-correct `netIncome`
- ✅ **Monte Carlo lump sum tax added** — `simulation-engine.ts` deducted the commuted lump sum from pension-type balances but never taxed it; now calls `calculateLumpSumCommutation` once per run and reports the result via new optional `SimulationRun.lumpSumTax` / `SimulationResult.averageLumpSumTax` (does not affect the success-rate metric, which only depends on portfolio balance)
- ✅ 542/542 tests pass (10 new); build succeeds; coverage 95-100% on touched calculation files
- 🎯 **Next:** Phase 9.1 High Priority remaining items (TFSA re-contribution room, dividend withholding tax) per suggested work order; revisit fees double-counting in CSV export (flagged as debatable, not yet actioned)

**Previous Update (2026-06-20) — `sa-retirement-calc-validator` audit: lump sum, annuitisation cap, MC tax, CGT exclusion fixes:**
- ✅ **Account-type-aware lump sum commutation** — `projection-engine.ts` and `simulation-engine.ts` no longer apply `lumpSumPercentage` to TFSA/discretionary balances; the commutation fraction now derives from and applies only to pension/RA/preservation-fund balances
- ✅ **One-third annuitisation cap enforced in-engine** — new `SA_TAX_LIMITS.maxLumpSumCommutationPercentage` (100/3); both engines clamp the requested percentage at the call site rather than trusting the UI slider
- ✅ **R40,000 CGT annual exclusion** — new `SA_TAX_LIMITS.cgtAnnualExclusion`; discretionary capital gains (summed across accounts) are reduced by the exclusion before the 40% inclusion rate applies, in both engines
- ✅ **Monte Carlo drawdown rewritten** — per-account stochastic growth + TFSA→discretionary→pension sequential withdrawal (mirrors the deterministic engine) replaces the old single-blended-pool model; per-year income/CGT tax now tracked for reporting via new optional `SimulationRun.lifetimeIncomeTax` / `SimulationResult.averageLifetimeIncomeTax`
- ✅ 536/536 tests pass (11 new); build succeeds; coverage on touched files 95.5-99.1%
- 🎯 **Next:** Phase 9.1 High Priority remaining items (TFSA re-contribution room, medical aid credit threshold, dividend withholding tax) per suggested work order

**Previous Update (2026-06-20) — Phase 9.1 Critical: calculation correctness & deduplication:**
- ✅ **Negative years guard** — `calculateProjection` returns a safe degenerate result instead of producing nonsense output when `retirementAge <= currentAge` or `lifeExpectancy <= retirementAge`; 3 new tests
- ✅ **CGT inclusion rate constant** — `0.40` hardcode replaced with `SA_TAX_LIMITS.cgtInclusionRateIndividual`
- ✅ **`calculateMonthlyReturn()` deduplicated** — removed copies in `projection-engine.ts` and `simulation-engine.ts`; both import the canonical version from `lib/calculations/utils/projection.ts`
- ✅ **Monte Carlo duplication removed** — `scenario-comparison.ts` no longer reimplements accumulation/drawdown; `runFullMonteCarloSimulation` now wraps scenario inputs into a synthetic account and delegates to `runMonteCarloSimulation` in `simulation-engine.ts`
- ✅ 523/523 tests pass; build succeeds; coverage on touched files 95-99%
- 🎯 **Next:** Phase 9.3 High (color logic dedup + aria labels) per suggested work order, then 9.2 High (tax/projection edge case tests)

**Previous Update (2026-06-20) — Debug window maintenance:**
- ✅ **Debug page verification** — ensured all DrawdownConfig fields are displayed: added `lumpSumPercentage` (always), optional `monthlyMedicalAid` and `medicalAidDependants` (conditional)
- ✅ **Bug fix** — fixed Accounts section title interpolation (`{accounts.length}` literal → template literal)
- ✅ **Test coverage maintained** — 520/520 tests passing, build verified

**Previous Update (2026-06-16) — Store test coverage & form persistence:**
- ✅ **Store tests (Phase 9 blocker)** — added 52 comprehensive tests for `calculator-store.ts` (27) and `expenses-store.ts` (25); full coverage of state initialization, mutations, async operations, debouncing, scenario management, edge cases; 520/520 tests pass
- ✅ **Form persistence fixes** — PersonalInfoForm and AssumptionsForm now properly restore state after Zustand hydration; fixes stale field values on page reload
- ✅ **Anon→Auth migration** — `migrateExpensesToSession()` copies user's expense groups/items from anonymous session to authenticated account on first login (120 unit tests)
- ✅ **Expense UX refinement** — removed auto-seed on reload; added "Load Sample Data" button for explicit user choice in empty state
- ✅ **Local dev setup** — `.env.development` with JWT anon key for Supabase proxy routing (localhost:3000/supabase → localhost:54321)
- ✅ **SUPABASE_ENABLED consistency** — all stores properly gate DB operations; Vercel fallback to localStorage works gracefully
- 📚 **New docs** — PostgreSQL best practices (`docs/supabase-postgres-best-practices.md`), skills-lock.json for Supabase skill definitions

**Previous Update (2026-06-10) — Phase 7 & 8 complete: UI redesign + expense tracker:**
- ✅ **Phase 7 — Sidebar app shell** — fixed 220px sidebar, sticky top bar, scrollable content; four SPA-style page routes (Overview, Accounts, Plan, Projections) + Settings + Expenses; Account Sheet overlay; semantic color tokens throughout
- ✅ **Phase 8 — Expense tracker** — `expense_groups` + `expenses` Supabase tables; user-defined groups with colour coding; per-item `inRetirement` toggle; debounced Supabase sync; offline seed; wired into sidebar nav
- ⚠️ **Zero tests** — `calculator-store.ts` and `expenses-store.ts` both untested; Phase 9 critical gap

**Latest Update (2026-06-07) — Phase 9 planned: site-wide improvement audit:**
- 📋 **Phase 9 doc created** — `docs/project-phases/phase-9-site-improvement.md`; three-agent parallel audit covering UI/UX, calculation correctness, and test coverage
- 📋 **9.1 Calculations** — 4 critical fixes (negative years guard, CGT constant, Monte Carlo deduplication, `calculateMonthlyReturn` triplicated); 4 high-priority SA-specific gaps (TFSA drawdown room, dividend tax, medical credit threshold, spending phase sources)
- 📋 **9.2 Tests** — `calculator-store.ts` and `expenses-store.ts` have zero tests; estimated coverage ~65-70% vs 90% threshold; 6 additional gap areas identified
- 📋 **9.3 UI/UX** — success rate color logic duplicated 4×; only 5 aria-labels across 58 components; missing confirmation dialogs and success toasts; responsive gaps on mobile

**Latest Update (2026-05-10) — UI audit (visual clunkiness):**
- 📋 **6 UI polish items logged** in `future-enhancements.md`: double headings in Planning Inputs cards, two-row header layout, overcrowded right-side nav, redundant welcome banner, oversized empty chart placeholders, duplicate account CTAs

**Latest Update (2026-05-10) — Section 11F excess contribution credit:**
- ✅ **Excess contribution tracking** — accumulation loop now tracks RA/pension/preservation contributions vs inflation-escalated Section 11F limit (`min(income × 27.5%, R430k)`) each year; excess accumulates as carry-forward credit
- ✅ **Lump sum credit application** — `calculateLumpSumCommutation` reduces taxable lump sum by accumulated credit; unused credit carried into drawdown
- ✅ **Drawdown credit offset** — remaining credit applied annually against pension/RA annuity income (not CGT, not TFSA) until exhausted
- ✅ **New fields** — `LumpSumCommutationResult.taxableLumpSum/creditAppliedToLumpSum/creditCarriedIntoDrawdown`, `YearlyProjection.excessCreditApplied/excessCreditRemaining`, `ProjectionResult.accumulatedExcessCredit`
- ✅ **Tests** — 6 unit tests for `calculateExcessContributionCredit`, 5 for lump sum with credit, 5 projection engine integration tests

**Latest Update (2026-05-10) — share link removed from UI:**
- ↩️ **Share link UI removed** — `lib/utils/share-link.ts` retained for future use; UI wiring, `useSearchParams`, and `<Suspense>` wrapper removed; marked as pending in Phase 5

**Latest Update (2026-05-10) — Phase 5 mostly complete + bug fixes:**
- ✅ **Print / PDF** — `/print` route; reads plan from localStorage (Zustand hydration), recalculates projection, renders clean A4 report, auto-triggers `window.print()`; respects `displayMode` with per-row age-based deflation
- ✅ **CSV export** — `lib/utils/export-csv.ts`; `exportProjectionCsv()` downloads all year-by-year projection columns
- ✅ **Print-friendly view** — `@media print` CSS; A4 page size, hidden UI chrome, print-color-adjust
- ⏳ **Share link** — `lib/utils/share-link.ts` implemented (base64 URL token) but UI wiring pending
- ✅ **Medical aid escalation fix** — `monthlyMedicalAid` now inflated from today's value each retirement year; label clarified; 4 tests added
- ✅ **Lump Sum slider** — now shows actual Rand value alongside %, respects `displayMode`
- ✅ **Print page unit bugs fixed** — percentage fields no longer double-multiplied; inflationRate correctly divided by 100 for `formatCurrency`; 23 tests added
- 🎯 **Next:** See `docs/project-phases/future-enhancements.md`

**Latest Update (2026-05-09) — Phase 4 complete: named scenarios, import/export, per-scenario accounts:**
- ✅ **Named scenarios** — `ScenarioSwitcher` in header; inline rename/delete/create; each scenario is an independent copy with its own accounts
- ✅ **Per-scenario accounts** — accounts linked via `scenario_id` FK (not user-level); new scenario clones current accounts; delete cascades
- ✅ **Import/export plan** — full JSON round-trip via Plan dropdown; validates on import; 9 tests
- ✅ **39 new tests** — `plan-io.test.ts` (9), `scenarios.test.ts` (17), `accounts.test.ts` (13)
- ✅ **Phase 4 complete**
- 🎯 **Next:** Phase 5 (export functionality — PDF/CSV report)

**Previous Update (2026-05-09) — Phase 3 complete: profile management:**
- ✅ **Profile modal** — `ProfileModal` with change-email + change-password forms; "Manage Account" in user dropdown; compact `h-8` inputs; same visual style as auth modal
- ✅ **Phase 3 complete** — all auth flows done (sign up, sign in, sign out, password reset, profile management)
- 🎯 **Next:** Phase 4 (data persistence / named scenarios)

**Previous Update (2026-05-09) — Phase 3 core auth complete + finance animations:**
- ✅ **Auth modal** (redesigned) — contextual mode-switching via footer links; Motion finance animation in header (60fps bars + trend line + pulsing dot); inline "Forgot password?"; pill-style status messages
- ✅ **User menu** — "Sign In" for anon; email + "Sign Out" dropdown for real users; wired into calculator header
- ✅ **Welcome banner** — static finance chart + "Welcome back, {name}" shown on home page for authenticated users only
- ✅ **Sign-out race condition fixed** — removed `signInAnonymously()` from `SIGNED_OUT` handler; it was restoring the real user session by racing with cookie cleanup
- ✅ **SupabaseProvider** — `onAuthStateChange` listener; `useAuth()` hook; post-signout handled gracefully via localStorage
- ✅ **proxy.ts + auth callback** — Next.js 16 session refresh + email confirmation/password reset redirect handler
- ✅ **Motion installed** — `pnpm add motion`; use pnpm for all installs (npm broken due to pnpm/jiti lockfile conflict)
- ✅ **Favicon** — `app/icon.tsx`; blue rounded-square chart icon via Next.js `ImageResponse`
- 🎯 **Next:** Profile management page, or Phase 4 (data persistence / scenarios)

**Latest Update (2026-05-09) — Phase 6 complete: account depletion tracking, RA optimisation, tax constant fixes:**
- ✅ **Account Depletion Timeline** — `accountBalances` per-year snapshots in `YearlyProjection`; `accountBalancesAtRetirement` in `ProjectionResult`; drawdown accordion shows per-account depletion age + progress bar
- ✅ **RA Optimisation (section 8)** — `calculateRAOptimization()` utility; deduction limit, utilisation bar, annual tax saving, optimal contribution; 16 tests
- ✅ **Stale tax constants fixed** — R350k cap replaced with `SA_TAX_LIMITS.pensionRaMaxDeduction` in 4 components; TFSA R500k hardcode replaced with `SA_TAX_LIMITS.tfsaLifetimeLimit`
- ✅ **Phase 6 complete** — 377 tests passing
- 🎯 **Next:** Phase 3 (user accounts / auth) or Phase 4 (data persistence)

**Previous Update (2026-05-09) — Medical aid tax credits + TFSA lifetime tracking:**
- ✅ **Medical aid s6A credits** — `calculateMedicalAidTaxCredit()` reduces income tax directly; `monthlyMedicalAid` + `medicalAidDependants` in `DrawdownConfig`; wired into projection engine; UI fields in Assumptions form; 2026/2027 rates (R364 member/first dependant, R246 additional)
- ✅ **TFSA lifetime limit** — `tfsaContributionsToDate` on Account; projection engine caps at R36k/year + R500k lifetime; account card shows remaining room + warnings; Supabase migration applied

**Previous Update (2026-04-27) — Supabase / localStorage fallback:**
- ✅ **Env-var gate** — `SUPABASE_ENABLED` flag in `lib/supabase/client.ts`; when `NEXT_PUBLIC_SUPABASE_URL` is absent all Supabase calls no-op and data lives entirely in `localStorage`
- ✅ **Accounts persisted locally** — added `accounts` to Zustand `partialize` so they survive page refreshes without a DB
- ✅ **SupabaseProvider** — skips anonymous auth and DB sync when Supabase is not configured
- 🎯 **Effect:** local dev uses Supabase; Vercel without env vars works fully via localStorage

**Previous Update (2026-04-27) — Sticky results bar + collapsible spacing fix:**
- ✅ **StickyResultsBar** — new fixed-bottom bar showing Portfolio at Retirement, Monthly Income, Success Rate; appears via IntersectionObserver once the metrics grid scrolls out of view; pulses a spinner when recalculating
- ✅ **Collapsible section spacing** — removed `dashboard-section` class (mb-12/mb-16) from `CollapsibleSection` accordion; sections now use border dividers only with no excessive gap
- 🔄 **Phase 6 (Tax):** ~93% complete; pending — account-specific depletion timeline, medical aid credits, TFSA lifetime limit tracking
- 🎯 **Next:** medical aid credits or TFSA lifetime limit tracking

**Previous Update (2026-04-27) — Phase 6 bug fixes and display mode:**
- ✅ **Display mode** — nominal/real toggle now applies to all currency values in the calculations breakdown; per-row `yearsFromNow` deflation in yearly tables
- ✅ **Payslip fix** — `monthlyIncomeAtRetirement` now correctly uses the post-lump-sum portfolio
- ✅ **Monte Carlo fix** — success rate now reflects the reduced drawdown portfolio when a lump sum is configured; was previously too optimistic

**Previous Update (2026-04-19) — Phase 2 started:**
- ✅ **Accounts persist to Supabase** — anonymous auth, RLS, fire-and-forget store sync all working
- ✅ **Local Supabase stack** — docker-in-docker added to devcontainer; `npx supabase start` to run
- 🎯 **Next:** scenarios table, TypeScript type generation, then Phase 3 (real auth)

**Previous Update (2026-04-12) — Phase 1.6 complete:**
- ✅ **Removed duplicate calculation in CalculationsBreakdown** — component now accepts `projection` prop from parent, eliminating two manual projection loops and a second `calculateProjection()` call. Breakdown figures now match the projection engine exactly.
- ✅ **Phase 1.6 marked complete** — Web Workers (2026-04-11), Zustand useShallow (Phase 1.7), and duplicate calculation fix (2026-04-12) cover all high-impact items. Remaining deferred items (form debouncing, InsightsPanel worker) have diminishing returns.

**Previous Update (2026-04-11):**
- ✅ **Phase 1.7 Complete:** Next 16 / React 19 / Tailwind v4 Modernization (all 6 steps, commits 3640f93…6e45ed3)
- ✅ **All deferred items resolved** including React Compiler audit, RSC split, and Node.js/Zod migrations
- 📊 **Production perf vs baseline:** interactive TBT **597ms → 533ms (-10.7%)**, longTaskMs **847ms → 783ms (-7.6%)**
- 🎯 **Next:** Phase 2 (Supabase integration)

**Previous Update (2026-01-15):**
- ✅ **Phase 1.6 Phase 1 Complete:** Quick Wins Implemented
- ✅ Recharts tree-shaking optimization
- ✅ React.memo added to 4 key components
- ✅ InsightsPanel dependency optimization
- 📊 Expected: 20-30% performance improvement

**Previous Update (2026-01-07):**
- ✅ Comprehensive SA retirement tax calculations implemented
- ✅ Age-based rebates, income tax, and lump sum tax modeling
- ✅ Retirement payslip UI and tax breakdown components

## How to Use This Documentation

1. **For Phase Details:** Click on any phase link in the table above to see:
   - Specific completed tasks and deliverables
   - Pending work and deferred items
   - Documentation references
   - Implementation sketches and code examples

2. **For Planning:** Review the "Current Status Summary" to understand:
   - What's complete and ready to build on
   - What's in progress and timeline
   - What's pending for future work

3. **For Contributing:** When updating a phase:
   - Edit the corresponding file in `docs/project-phases/`
   - Update the status indicator (✅/🔄/🔲) in the phase table above
   - Add a dated entry to the "Current Status Summary" section
   - Keep each phase file focused and concise (under 500 lines where possible)

## Filing Structure

```
docs/
├── project-phases/
│   ├── phase-1-calculation-accuracy.md
│   ├── phase-1-5-testing-validation.md
│   ├── phase-1-6-performance-optimization.md
│   ├── phase-1-7-modernization.md
│   ├── phase-2-supabase.md
│   ├── phase-3-user-accounts.md
│   ├── phase-4-data-persistence.md
│   ├── phase-5-export-functionality.md
│   ├── phase-6-enhanced-tax.md
│   ├── phase-7-ui-redesign.md
│   ├── phase-8-expense-tracker.md
│   ├── phase-9-site-improvement.md
│   └── future-enhancements.md
└── project-phases.md (this file)
```

## Guidelines for Maintaining This Documentation

**When updating a phase:**
1. Edit the corresponding file in `docs/project-phases/{phase-name}.md`
2. Update the status emoji in the phase table above (✅ for complete, 🔄 for in progress, 🔲 for pending)
3. Add a dated status update to the "Current Status Summary" section
4. Each phase file should be self-contained and focus on that phase's scope
5. Reference related history files in `docs/history/` for deep dives
6. Keep the main `project-phases.md` file as a lightweight index

**When creating new phases:**
1. Create a new file: `docs/project-phases/phase-N-{description}.md`
2. Use the template from an existing phase file
3. Add a row to the phase table in `project-phases.md`
4. Link to the new file in the phase overview table
