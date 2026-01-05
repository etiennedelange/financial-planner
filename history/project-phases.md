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
- [x] Compounding method configuration (nominal vs compound)
- [x] Display mode toggle (today's value vs future value)
- [x] Debug window with calculation parameters

**Documentation:** See `history/2026-01-02-calculation-fixes-and-ui-improvements.md`

---

## Phase 1.5: Testing & Validation Framework 🔄 IN PROGRESS

**Goal:** Establish comprehensive testing to maintain calculation accuracy and cross-tab consistency.

**Priority Tasks:**
- [ ] **P0: Consolidate duplicate `projectFinalSavings` functions** (Critical)
  - Currently duplicated in: optimal-contribution.ts, cost-of-delay.ts, scenario-comparison.ts
  - Create single source of truth in `lib/calculations/utils/projection.ts`
  - Prevents drift between calculation engines
  - **Estimated effort:** 30 minutes

- [ ] **P0: Add compounding method to Debug Window** (Critical)
  - Show which formula is being used (nominal vs compound)
  - Display calculated monthly return for verification
  - Add calculation checksums
  - **Estimated effort:** 20 minutes

- [ ] **P1: Unit tests for core calculations** (High Priority)
  - Test `projectFinalSavings` with known Excel FV results
  - Test compounding method differences
  - Test edge cases (zero balance, zero contributions)
  - Test weighted return calculations
  - **Estimated effort:** 2-3 hours

- [ ] **P1: Cross-tab consistency tests** (High Priority)
  - Ensure Debug Window matches Projection Summary
  - Ensure Debug Window matches Insights tab
  - Ensure Monte Carlo uses same parameters as deterministic
  - **Estimated effort:** 1-2 hours

- [ ] **P2: Display mode tests** (Medium Priority)
  - Verify real vs nominal conversion across all tabs
  - Test that toggling updates all currency values
  - Snapshot testing for UI updates
  - **Estimated effort:** 1 hour

- [ ] **P2: Create validation script** (Medium Priority)
  - Automated debug output validation
  - Check calculation consistency
  - Verify compounding method is applied correctly
  - **Estimated effort:** 1 hour

- [ ] **P3: Property-based testing** (Optional)
  - Mathematical property tests (e.g., delay composition)
  - Fuzzing with random valid inputs
  - **Estimated effort:** 2 hours

**Testing Strategy:**
1. **Unit Tests:** Individual calculation functions with known inputs/outputs
2. **Integration Tests:** Cross-tab consistency and state management
3. **Visual Regression:** Snapshot tests for display mode toggles
4. **Property-Based:** Mathematical invariants and edge cases
5. **Manual Validation:** SA retirement validator agent for complex scenarios

**Test Coverage Goals:**
- Core calculations: 100%
- UI components: 80%
- Integration flows: 90%

**Documentation:** See `history/testing-and-validation-plan.md` (to be created)

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
| Phase 1.5: Testing & Validation | 🔄 In Progress | 0% |
| Phase 2: Supabase Integration | 🔲 Pending | 0% |
| Phase 3: User Accounts | 🔲 Pending | 0% |
| Phase 4: Data Persistence | 🔲 Pending | 0% |
| Phase 5: Export Functionality | 🔲 Pending | 0% |
| Phase 6: Enhanced Tax | 🔲 Pending | 0% |
