# Future Enhancements (Post-MVP)

## Completed (moved from pending)

- ✅ **Tax-optimized withdrawal sequencing** — TFSA → Discretionary → Pension/RA order in drawdown phase (`projection-engine.ts`)
- ✅ **Lump sum commutation UI** — % slider in assumptions form, one-third cap enforced, tax breakdown shown
- ✅ **Medical aid tax credits** — credits applied in drawdown tax calc, escalated from today's value each retirement year
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

