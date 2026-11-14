---
type: Phase
title: "Future Enhancements (Post-MVP)"
description: "Post-MVP enhancement ideas, split into completed and still pending."
---

# Future Enhancements (Post-MVP)

## Completed (moved from pending)

- ✅ **Tax-optimized withdrawal sequencing** — TFSA → Discretionary → Pension/RA order in drawdown phase (`projection-engine.ts`)
- ✅ **Lump sum commutation UI** — % slider in assumptions form, one-third cap enforced, tax breakdown shown
- ✅ **Medical aid tax credits** — credits applied in drawdown tax calc, escalated from today's value each retirement year
- ✅ **Vite+ toolchain (2026-10-31)** — lint, format and tests on Vite+ (Oxlint, Oxfmt, Vitest 5); ESLint and the separate Vitest config removed. See [history](../history/2026-10-31-vite-plus-oxc-migration.md)
- ✅ **Account-specific withdrawal tracking** — per-account balances tracked each drawdown year, visible in CSV export and debug window

## Pending

### UI Polish (identified 2026-05-10 via visual audit)
- ✅ **Floating bottom action bar** (2026-06-28) — `components/ui/floating-action-bar.tsx`; scroll-hide behavior; added to Accounts (Add Account + Seed) and Expenses (New Group) pages
- ✅ **Double headings in Planning Inputs** — resolved by prior redesign (phase 9.3 layout pass)
- ✅ **Header two-row layout** — resolved by prior redesign; single-row top bar in current layout
- ✅ **Overcrowded right-side nav** — resolved by prior redesign; debug icon relocated, theme controls merged
- ✅ **Welcome banner is redundant** — resolved by prior redesign; banner removed
- ✅ **Duplicate CTAs in empty account state** (2026-06-28) — removed ghost "Add another account" from populated accounts list; removed "Add accounts" banner from metrics grid; overview shows GettingStarted exclusively when no projection
- ✅ **Accounts page visual language mismatch** (2026-06-28) — full rebuild: replaced floating hero number + 2-col card grid + custom section headers with `PageCard` + `SectionLabel` structure; compact list rows with expand-in-place detail; type colors constrained to badge chip and allocation bar only; no colored top-bar stripes
- **Empty chart placeholders dominate viewport** — two large blank cards push all useful content below the fold before any data is added; make them compact or hidden until populated

### High Priority
- **Reliable calculation audit report** — Rework the debug page or provide a dedicated report generator that copies all relevant plan inputs, assumptions, calculation outputs, and money basis directly from the actual projection/simulation implementation. Avoid duplicated formulas and stale explanatory text; make the report easy to paste to another agent for an independent accuracy review.
- **Spouse/joint retirement planning** — model two incomes, two retirement dates, combined expenses and tax
- **Annuity vs living annuity comparison** — side-by-side drawdown projections for guaranteed annuity vs living annuity
- **Healthcare cost modeling** — medical cost escalation above CPI in retirement (e.g. medical inflation 8-9% vs 5.5% CPI)

### Medium Priority
- **Offshore investment allocation** — separate offshore sleeve with currency/returns assumptions; CGT on forex gains
- **Social security/government pension integration** — SASSA old-age grant (currently R2,180/month) as income floor in drawdown
- **Monte Carlo contribution allocation optimizer** — find optimal split across TFSA/RA/discretionary for target success rate

### Lower Priority
- **Estate planning** — model estate duty, executor fees, bequest goals
- **Legacy goals** — target end-of-plan balance for inheritance

### E2E journeys (identified 2026-11-14)

Journeys 1-3 were repaired and pass on desktop, tablet and the phone layout; see [history](../history/2026-11-14-number-field-inputs.md). The rest is still open. Journeys 4-7 were assessed by reading the specs (their steps and waits), not by running them.

- [ ] **Port journey 04 (insights exploration).** It clicks the removed "Insights", "Assumptions" and "Goals" tabs and waits for charts on the landing page. Decide which pages now carry what "Insights" documented (Overview's next-best-step card, Charts' sensitivity and cost-of-delay, Risk's investment scenarios), then rebuild the journey on `goToPage`.
- [ ] **Port journey 05 (display modes).** The display-mode toggle is in the top bar (accessible name `"<Future|Today's> Value, change display mode"`). The compounding method is now two option cards on Plan > Market Assumptions, so the old `getByRole("button", { name: /nominal/i })` is ambiguous. It also visits the removed tabs to check the mode on each.
- [ ] **Port journey 06 (calculations review).** The "Calculations" tab no longer exists. `/calculator/debug` (reconciliation checks, once merged) is the closest successor; decide what this journey should now document.
- [ ] **Port journey 07 (responsive layouts).** Visits the removed tabs. Use `goToPage` (works for the sidebar and the phone bottom bar), and note the add-account dialog is a bottom drawer on phones.
- [ ] **Run and fix journeys 08 (two-factor), 09 (bootstrap data ownership) and 02-password-reset.** They need local Supabase and were not run in this work.
- [ ] **Make the `mobile` project runnable.** It uses WebKit, which is not installed in the devcontainer (`npx playwright install webkit`), or switch it to Chromium emulation of the iPhone viewport.
- [ ] **Stop the seed version drifting.** `StateManager.seedState` hard-codes the calculator store's persist version (3). Export the version from `calculator-store.ts` and import it, so a store bump cannot silently produce a seed with `personalInfo` missing (the Overview then shows "Retiring at undefined").

### Follow-ups from the input redesign (identified 2026-11-14)

From PR #43; details in [history](../history/2026-11-14-number-field-inputs.md).

- [ ] **Expense and group delete** still use a confirmation dialog. Give them the same one-click delete with an Undo toast as accounts (`DELETE_UNDO_MS`).
- [ ] **Undo restores an account at the end of its group**, not its original position. Needs a store API to re-insert at an index.
- [ ] **Review dark mode and 390 px** for the converted forms beyond the Plan page, and view the auth modal after the base `Input` change.
- [ ] **Confirm the 1Password icon is gone** from number and name fields (manual check with the extension; the opt-out attributes are verified in the DOM).
- [ ] **Audit the stepper hit area** (24 x 26 px) at 320 px.

### Monetization (discussed 2026-08-02, not scoped)
- **Bill users for AI plan-narrative access** — the AI narrative feature (`app/api/plan-narrative/`) currently has no usage limits or payment gate beyond a client-side cooldown. Two approaches discussed:
  - **Metered credits (leaning this way)** — small free monthly allowance per account, tracked in a Supabase table, top-up packs or subscription via Stripe when exhausted. Mirrors how the AI Gateway itself is billed, reuses the existing anonymous→real Supabase auth upgrade path.
  - **Flat subscription tier** — single paid plan unlocks unlimited narratives. Simpler to build, but no protection against a single Pro user driving up Gateway costs.
  - Either approach needs: Stripe via the Vercel Marketplace integration (not a hand-rolled SDK call), a `credits`/`subscription` table in Supabase, and an enforcement check in the route handler before it calls the Gateway.
  - Not brainstormed/spec'd yet — needs a full design pass before implementation.

## Future Phases

### Phase 7: MCP Tools Review
- Go through all available MCP tools and evaluate which ones are useful for this project
- Identify tools for: Supabase local dev, browser testing, GitHub automation, and any others worth keeping
- Update `.mcp.json` and devcontainer config based on findings
- Document final MCP setup in CLAUDE.md or a dedicated `docs/MCP.md`

