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
- [x] Dark mode support with theme toggle (Light/Dark/System)

**Documentation:**
- See `history/2026-01-02-calculation-fixes-and-ui-improvements.md`
- See `history/2026-01-05-insights-tab-fix-and-testing-framework.md`

---

## Phase 1.5: Testing & Validation Framework ✅ COMPLETED

**Goal:** Establish comprehensive testing to maintain calculation accuracy and cross-tab consistency.

**Completed Tasks:**
- [x] **P0: Consolidate duplicate `projectFinalSavings` functions** (Critical) ✅
  - Created single source of truth in `lib/calculations/utils/projection.ts`
  - Updated 3 files to import from shared utility
  - Added helper functions: `calculateMonthlyReturn()`, `formatMonthlyReturnFormula()`
  - Prevents drift between calculation engines
  - **Status:** Completed 2026-01-05

- [x] **P0: Add compounding method to Debug Window** (Critical) ✅
  - Added prominent "Calculation Method" section at top of debug window
  - Displays compounding method with description
  - Shows monthly return formula with actual calculation
  - Added display mode information
  - Added calculation checksums (accounts, balances, returns, fees)
  - **Status:** Completed 2026-01-05

- [x] **P1: Unit tests for core calculations** (High Priority) ✅
  - Created `lib/calculations/utils/projection.test.ts` - 22 tests (100% coverage)
  - Created `lib/calculations/__tests__/optimal-contribution.test.ts` - 13 tests (100% coverage)
  - Created `lib/calculations/__tests__/projection-engine.test.ts` - 24 tests (90%+ coverage)
  - Created `lib/monte-carlo/__tests__/simulation-engine.test.ts` - 26 tests (87%+ coverage)
  - Created `lib/monte-carlo/__tests__/random-returns.test.ts` - 19 tests (90%+ coverage)
  - Tests verify Excel FV formula compatibility, compounding methods, edge cases
  - **Status:** Completed 2026-01-07

- [x] **P1: Cross-tab consistency tests** (High Priority) ✅
  - Created `tests/integration/cross-tab-consistency.test.ts` - 13 tests
  - Validates projection vs optimal contribution consistency
  - Validates Monte Carlo vs deterministic projection alignment
  - Tests inflation adjustments, compounding methods, withdrawal strategies
  - Tests SA-specific scenarios (TFSA limits, old pension funds)
  - **Status:** Completed 2026-01-07

- [x] **Test Coverage Achievement** ✅
  - Overall statement coverage: **90.97%** (exceeds 90% target)
  - Overall line coverage: **93.08%** (exceeds 90% target)
  - Core calculation files: **100%** statement coverage
  - Total tests: **117 passing** (6 test files, 0 failures)
  - **Status:** Completed 2026-01-07

**Deferred Tasks (P2-P3):**
- [ ] **P2: Display mode tests** (Medium Priority)
  - Verify real vs nominal conversion across all tabs
  - Test that toggling updates all currency values
  - Snapshot testing for UI updates
  - **Status:** Deferred - not critical for current phase

- [ ] **P2: Create validation script** (Medium Priority)
  - Automated debug output validation
  - Check calculation consistency
  - Verify compounding method is applied correctly
  - **Status:** Deferred - not critical for current phase

- [ ] **P3: Property-based testing** (Optional)
  - Mathematical property tests (e.g., delay composition)
  - Fuzzing with random valid inputs
  - **Status:** Deferred - optional enhancement

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

## Phase 1.6: Performance Optimization 🔄 IN PROGRESS

**Goal:** Optimize Next.js application performance for faster rendering, smaller bundles, and smoother UX.

**Current Performance Baseline (2026-01-15):**
- Bundle Size: 710KB (largest chunk - recharts)
- Time to Interactive: ~3-4s (with 1,000 simulations)
- Calculation Time: 500-800ms per simulation
- Node Modules: 642MB
- Client Components: 36 files

**Target Metrics:**
- Bundle Size: <400KB (44% reduction)
- Time to Interactive: <1.5s (62% improvement)
- Calculation Time: <50ms perceived (Web Workers)
- Re-renders: 60-70% reduction

### Phase 1: Quick Wins (20-30% improvement) ✅ COMPLETED

**Tasks:**
- [x] **Add Next.js bundle analyzer** (High Priority) ✅
  - Installed @next/bundle-analyzer
  - Configured webpack analysis in next.config.js
  - Created npm script: `npm run analyze`
  - **Impact:** Visibility into bundle composition
  - **Completed:** 2026-01-15

- [x] **Optimize recharts imports** (High Priority) ✅
  - Replaced `import * as RechartsPrimitive` with named imports
  - File: `components/ui/chart.tsx:4-8`
  - **Impact:** Better tree-shaking, estimated 200-400KB bundle reduction
  - **Completed:** 2026-01-15

- [x] **Remove displayMode from InsightsPanel dependencies** (Medium Priority) ✅
  - Removed displayMode from useMemo dependency array
  - displayMode only affects display formatting, not calculations
  - File: `components/results/insights-panel.tsx:121`
  - **Impact:** Prevent unnecessary recalculations on display toggle
  - **Completed:** 2026-01-15

- [x] **Add React.memo to chart components** (Medium Priority) ✅
  - Memoized PortfolioGrowthChart
  - Memoized MonteCarloChart
  - Memoized DashboardMetricsGrid
  - Memoized DashboardMetricCard (rendered 6-7 times)
  - **Impact:** 40-50% reduction in wasted renders
  - **Completed:** 2026-01-15

**Deferred:**
- [ ] **Reduce Monte Carlo simulations during typing** (Deferred)
  - Consider "Calculate" button instead of auto-run in future phase
  - Would allow user to control when expensive simulations run
  - **Status:** Deferred for future consideration

**Status:** Completed 2026-01-15
**Build Status:** ✅ All optimizations verified with successful production build

### Phase 2: Medium Effort (60-70% improvement) 🔲 PLANNED

**Tasks:**
- [ ] **Implement Web Workers for Monte Carlo** (Highest Impact)
  - Offload 1,000 simulation runs to background thread
  - Non-blocking UI during calculations
  - File: `lib/monte-carlo/simulation-engine.ts:265-280`
  - **Impact:** 80-90% reduction in perceived lag

- [ ] **Delete duplicate calculation in CalculationsBreakdown** (High Priority)
  - Remove manual projection loop (lines 88-206)
  - Use only `fullProjection` from projection engine
  - File: `components/results/calculations-breakdown.tsx`
  - **Impact:** 50% faster calculations, consistent formulas

- [ ] **Add form debouncing** (High Priority)
  - Debounce store updates by 500ms during typing
  - Files: All form components (personal-info-form, retirement-goals-form, etc.)
  - **Impact:** 70% fewer store updates

- [ ] **Optimize Zustand store selectors** (Medium Priority)
  - Use granular selectors instead of destructuring entire store
  - File: `app/calculator/page.tsx:37-47`
  - **Impact:** 30-40% fewer re-renders

- [ ] **Split InsightsPanel calculations** (Medium Priority)
  - Separate useMemo hooks for each calculation type
  - Remove displayMode from dependencies
  - File: `components/results/insights-panel.tsx:36-121`
  - **Impact:** 3-4x faster insights rendering

### Phase 3: Deep Optimization (80-90% improvement) 🔲 PLANNED

**Tasks:**
- [ ] **Consider chart library replacement**
  - Evaluate Chart.js (50KB) vs recharts (150KB+)
  - Evaluate Visx (tree-shakeable, modular)
  - **Impact:** 200-400KB bundle reduction

- [ ] **Implement progressive simulation results**
  - Show results as they complete (10 batches of 100 runs)
  - Update UI progressively
  - **Impact:** Perceived instant feedback

- [ ] **Add WASM for hot calculation paths**
  - Compile numerical computations to WebAssembly
  - **Impact:** 2-10x speedup for calculations

- [ ] **Comprehensive component memoization audit**
  - Audit all 36 client components
  - Add React.memo where appropriate
  - **Impact:** Significant render reduction

- [ ] **Add performance monitoring**
  - Web vitals tracking
  - Error boundaries
  - Slow component detection
  - **Impact:** Visibility into production performance

**Documentation:** See `history/2026-01-15-performance-optimization.md` (to be created)

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

**Tax Optimization (Phase 6):**
- **Tax-optimized withdrawal sequencing**: Automatically sequence withdrawals from different account types to minimize lifetime tax burden
  - Withdraw from TFSA first (tax-free)
  - Then from discretionary accounts (capital gains tax more favorable)
  - Preserve tax-deferred accounts (pension, RA) as long as possible
  - Account for required minimum distributions and annuitization requirements
- **Medical aid tax credits**: Model medical aid contributions that qualify for tax credits
- **Lump sum commutation UI**: Allow users to configure what percentage to take as lump sum vs annuity
- **Account-specific withdrawal tracking**: Track which accounts are drawn from each year

---

## Current Status

| Phase | Status | Progress |
|-------|--------|----------|
| Phase 1: Calculation Accuracy | ✅ Complete | 100% |
| Phase 1.5: Testing & Validation | ✅ Complete | 100% (216 tests passing, 90%+ coverage) |
| Phase 1.6: Performance Optimization | 🔄 In Progress | 33% (Phase 1 complete, Phase 2-3 pending) |
| Phase 2: Supabase Integration | 🔲 Pending | 0% |
| Phase 3: User Accounts | 🔲 Pending | 0% |
| Phase 4: Data Persistence | 🔲 Pending | 0% |
| Phase 5: Export Functionality | 🔲 Pending | 0% |
| Phase 6: Enhanced Tax | 🔄 In Progress | 60% (Core calculations complete, UI complete, optimization pending) |

**Latest Update (2026-01-15):**
- ✅ **Phase 1.6 - Phase 1 Complete: Quick Wins Implemented**
- ✅ Recharts tree-shaking optimization
- ✅ React.memo added to 4 key components
- ✅ InsightsPanel dependency optimization
- ✅ Bundle analyzer configured
- 📊 Expected: 20-30% performance improvement
- 💡 Future consideration: Manual "Calculate" button for Monte Carlo
- 🎯 Next: Phase 2 (Web Workers, form debouncing)

**Previous Update (2026-01-07):**
- ✅ Comprehensive SA retirement tax calculations implemented
- ✅ Age-based rebates (Primary, Secondary, Tertiary)
- ✅ Income tax and lump sum tax modeling
- ✅ Lifetime tax burden analysis
- ✅ Retirement payslip UI component
- ✅ Tax breakdown accordion in calculations
- 🔲 Tax-optimized withdrawal sequencing (deferred to future enhancement)
