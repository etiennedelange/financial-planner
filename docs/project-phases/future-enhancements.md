# Future Enhancements (Post-MVP)

## Completed (moved from pending)

- ✅ **Tax-optimized withdrawal sequencing** — TFSA → Discretionary → Pension/RA order in drawdown phase (`projection-engine.ts`)
- ✅ **Lump sum commutation UI** — % slider in assumptions form, one-third cap enforced, tax breakdown shown
- ✅ **Medical aid tax credits** — credits applied in drawdown tax calc, escalated from today's value each retirement year
- ✅ **Account-specific withdrawal tracking** — per-account balances tracked each drawdown year, visible in CSV export and debug window

## Pending

### UI Polish (identified 2026-05-10 via visual audit)
- **Floating bottom action bar** — a fixed bar at the bottom of the viewport for quick actions (e.g. "+ Add Account", "+ Add Expense", scenario switcher). Surfaces the most common write actions without requiring the user to scroll to a section header or navigate away. Should appear on contextually relevant pages (Accounts, Expenses) and collapse/hide on scroll-down to avoid obscuring content. Design to match the sharp/minimal brand — not a mobile-app dock, more like a command-bar footer.
- **Double headings in Planning Inputs** — each sub-section has an outer label AND an inner card heading with the same text (Personal Information × 2, Retirement Goals × 2, Investment Assumptions / Market Assumptions, Detailed Insights / Insights); remove outer labels or inner card headings
- **Header two-row layout** — "My Plan" dropdown sits alone below the title, disconnected from the right-side nav; pull it into the nav bar for a single-height header
- **Overcrowded right-side nav** — 7 interactive elements in one row: debug icon, "Future Value" dropdown, "Nominal" dropdown, "Plan" dropdown, color theme toggle, dark/light toggle, email button; consolidate or move debug elsewhere, merge theme controls
- **Welcome banner is redundant** — shows username + email already visible in the nav user button; remove or replace with a dismissible first-run tip
- **Empty chart placeholders dominate viewport** — two large blank cards push all useful content (accounts, planning inputs) below the fold before any data is added; make them compact or hidden until populated
- **Duplicate CTAs in empty account state** — "+ Add Account" button (section header) and "+ Add Your First Account" (inline empty state) trigger the same action; keep only the inline one

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

## Future Phases

### Phase 7: MCP Tools Review
- Go through all available MCP tools and evaluate which ones are useful for this project
- Identify tools for: Supabase local dev, browser testing, GitHub automation, and any others worth keeping
- Update `.mcp.json` and devcontainer config based on findings
- Document final MCP setup in CLAUDE.md or a dedicated `docs/MCP.md`

### Phase 8: Stock Ticker
- Dedicated page showing live/delayed market data for JSE and global indices
- Allow users to link holdings to actual tickers for real-time portfolio valuation
- Pull current prices to auto-update account balances
