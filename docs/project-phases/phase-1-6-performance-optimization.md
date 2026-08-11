# Phase 1.6: Performance Optimization 🔄 IN PROGRESS

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

## Phase 1: Quick Wins (20-30% improvement) ✅ COMPLETED

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

## Phase 2: Medium Effort (60-70% improvement) ✅ COMPLETED

**Tasks:**
- [x] **Implement Web Workers for Monte Carlo** (Highest Impact) ✅
  - Web Worker in `lib/monte-carlo/simulation.worker.ts`
  - `useMonteCarloWorker` hook in `lib/monte-carlo/use-monte-carlo-worker.ts`
  - Stale-result handling via monotonic ID; superseded runs silently dropped
  - **Impact:** Monte Carlo off main thread entirely; no more main-thread blocking
  - **Completed:** 2026-04-11 (Phase 1.6 Phase 2 / Phase 1.7 combined work)

- [x] **Delete duplicate calculation in CalculationsBreakdown** (High Priority) ✅
  - Removed two manual projection loops (~100 lines)
  - Removed internal `calculateProjection()` call (was third computation)
  - Component now accepts `projection: ProjectionResult` prop from parent
  - Uses `projection.yearlyProjections` filtered by age for accumulation/drawdown tables
  - Spending phase labels derived from `age - retirementAge` using shared `getSpendingPhaseMultiplier`
  - **Impact:** Eliminated duplicate computation; breakdown now matches projection engine exactly
  - **Completed:** 2026-04-12

- [x] **Optimize Zustand store selectors** (Medium Priority) ✅
  - `useShallow` applied to all store destructures across all components
  - **Completed:** 2026-04-11 (Phase 1.7)

**Deferred:**
- [ ] **Add form debouncing** (Low Priority — superseded)
  - With `useDeferredValue` + Web Workers in place, store updates are cheap (cheap re-renders only; no main-thread computation per-keystroke)
  - **Status:** Deferred — diminishing returns given existing optimizations

- [ ] **Split InsightsPanel calculations** (Medium Priority)
  - `compareScenarios` runs 3×1000 Monte Carlo on main thread when panel is open
  - Only affects users who expand the Detailed Insights panel
  - **Status:** Deferred — consider moving to Web Worker in a future pass

## Phase 3: Deep Optimization (80-90% improvement) 🔲 PLANNED

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

**Documentation:** This file is the record for the 2026-01-15 quick-wins round (no separate history file was created).
