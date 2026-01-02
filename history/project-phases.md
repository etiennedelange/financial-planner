# SA Retirement Calculator - Project Phases

## Phase Overview

Based on REQUIREMENTS.md, the project is being developed in the following phases:

---

## Phase 1: Calculation Accuracy ✅ COMPLETED

**Goal:** Ensure all projections match Excel FV formula and SA financial standards.

**Completed Items:**
- [x] Monthly rate conversion (simple division to match Excel)
- [x] Contribution timing (end-of-period, Excel type=0)
- [x] Nominal vs real returns (nominal for accumulation, real for sustainability)
- [x] Insights tab consistency with main projections
- [x] JavaScript operator precedence fixes
- [x] Auto-calculate Monte Carlo with debouncing
- [x] Account form dialog conversion

**Documentation:** See `history/2026-01-02-calculation-fixes-and-ui-improvements.md`

---

## Phase 2: Supabase Integration 🔲 PENDING

**Goal:** Set up database infrastructure for persistent data storage.

**Tasks:**
- [ ] Initialize Supabase project
- [ ] Design database schema:
  - `users` table (handled by Supabase Auth)
  - `accounts` table (retirement accounts per user)
  - `scenarios` table (saved calculation scenarios)
  - `calculation_history` table (historical results)
- [ ] Implement Row Level Security (RLS) policies
- [ ] Set up database migrations
- [ ] Create TypeScript types from database schema

**Schema Design:**
```sql
-- accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  provider TEXT,
  type TEXT NOT NULL, -- pension_fund, retirement_annuity, preservation_fund, tfsa, discretionary
  current_balance DECIMAL(15,2) NOT NULL,
  monthly_contribution DECIMAL(15,2) NOT NULL,
  expected_return DECIMAL(5,2) NOT NULL,
  annual_fees DECIMAL(5,2) NOT NULL,
  contribution_escalation DECIMAL(5,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- scenarios table
CREATE TABLE scenarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  personal_info JSONB NOT NULL,
  retirement_goals JSONB NOT NULL,
  assumptions JSONB NOT NULL,
  drawdown_config JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Phase 3: User Accounts 🔲 PENDING

**Goal:** Implement user authentication and profile management.

**Tasks:**
- [ ] Supabase Auth integration
- [ ] Sign up flow (email/password)
- [ ] Login/logout functionality
- [ ] Password reset
- [ ] Profile management page
- [ ] Protected routes (redirect to login if not authenticated)
- [ ] Optional: Social login (Google, etc.)

---

## Phase 4: Data Persistence 🔲 PENDING

**Goal:** Save and load user data from database.

**Tasks:**
- [ ] CRUD operations for accounts (currently in-memory only)
- [ ] Save/load scenarios
- [ ] Auto-save functionality
- [ ] Calculation history storage
- [ ] Import/export functionality (JSON)
- [ ] Sync state between local and database

---

## Phase 5: Export Functionality 🔲 PENDING

**Goal:** Generate downloadable reports and data exports.

**Tasks:**
- [ ] PDF report generation (projection summary)
- [ ] CSV data export (year-by-year projections)
- [ ] Print-friendly view
- [ ] Shareable scenario links

---

## Phase 6: Enhanced Tax Calculations 🔲 PENDING

**Goal:** Complete SA tax treatment implementation.

**Tasks:**
- [ ] Retirement lump sum tax tables (2024/2025)
- [ ] Monthly annuity income tax calculations
- [ ] Tax bracket modeling
- [ ] TFSA contribution tracking (lifetime limit)
- [ ] RA/Pension contribution optimization suggestions

---

## Future Enhancements (Post-MVP)

From REQUIREMENTS.md:
- Estate planning considerations
- Healthcare cost modeling
- Annuity vs living annuity comparison
- Offshore investment allocation
- Social security/government pension integration
- Spouse/joint retirement planning
- Legacy goals (leaving inheritance)
- Monte Carlo optimization for contribution allocation

---

## Current Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Calculation Accuracy | ✅ Complete | 100% |
| Phase 2: Supabase Integration | 🔲 Pending | 0% |
| Phase 3: User Accounts | 🔲 Pending | 0% |
| Phase 4: Data Persistence | 🔲 Pending | 0% |
| Phase 5: Export Functionality | 🔲 Pending | 0% |
| Phase 6: Enhanced Tax | 🔲 Pending | 0% |
