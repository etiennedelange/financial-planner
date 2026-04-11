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

## Phase 1.7: Next 16 / React 19 / Tailwind v4 Modernization ✅ COMPLETE

**Goal:** Fully adopt the features shipped by the recent stack upgrade (Next 14 → 16, React 18 → 19.2, Tailwind 3 → 4, Zustand 4 → 5, Zod 3 → 4). Reduce boilerplate, fix real correctness issues uncovered during audit, and produce measurable deltas against the committed perf baselines.

**Scope note:** this phase is scoped to *modernization* — adopting features the new versions shipped — not general perf tuning. There is deliberate overlap with Phase 1.6 Phase 2 (e.g., Zustand selectors, form work) but the framing is different: 1.6 is "make it faster", 1.7 is "make it idiomatic for the current stack." Both eventually converge; do whichever the current refactor branch is closer to.

### Measurement methodology

Every step MUST be verified against the committed perf baselines added in commit `c359b81`:

```bash
pnpm build && pnpm start                  # in a separate terminal
pnpm perf:after                            # empty scenario
pnpm perf:after:interactive                # interactive scenario (3-account portfolio)
pnpm perf:compare                          # diff vs perf/baseline.json
pnpm perf:compare:interactive              # diff vs perf/baseline-interactive.json
```

Committed baselines at commit `ae8f18c` (Chromium headless, 4× CPU throttle, 5 runs median):

| metric       | empty  | interactive |
|--------------|-------:|------------:|
| fcp          |   88ms |        88ms |
| lcp          |   88ms |        88ms |
| tbt          |  166ms |       597ms |
| longTaskCount|      2 |           5 |
| longestTask  |  185ms |       314ms |
| jsBytes      |  409KB |       409KB |

For root-cause analysis on a regression or a metric that isn't moving as expected, use the `chrome-devtools-mcp` server registered in `.mcp.json` — it exposes full Chrome DevTools Protocol tracing (`performance_start_trace`, `performance_analyze_insight`, etc.) for interactive profiling sessions.

### Reference audit

Full technical design review with rationale per item is in the conversation record from 2026-04-11. Key findings that drive the steps below:
- Tailwind v4 running through the v3-compat bridge (`@config` directive)
- All 15 `components/ui/` files still use `React.forwardRef` (React 19 obsoletes this)
- `ColorThemeProvider` has a real hydration bug masked by `suppressHydrationWarning`
- `calculator/page.tsx` debounces Monte Carlo via `setTimeout` + `useRef`
- `.eslintrc.json` still legacy format; ESLint 10 installed

---

### Step 1: Metadata/viewport split + ESLint flat config ✅ DONE (commit 3640f93)

**Why now:** Unblocks tooling for later steps and clears standing build warnings.
- Next 15+ requires `viewport` as a separate export (currently warns on `next build`)
- ESLint 9+ uses flat config; `eslint-config-next@16` ships a flat-config entrypoint

**Files:**
- `app/layout.tsx:10-13` — split `metadata` + `viewport` exports
- `.eslintrc.json` → delete
- `eslint.config.mjs` → create

**Implementation sketch:**
```tsx
// app/layout.tsx
export const metadata: Metadata = { title: "...", description: "..." }
export const viewport: Viewport = { width: "device-width", initialScale: 1 }
```
```js
// eslint.config.mjs
import next from "eslint-config-next"
export default [...next()]
```

**Verification:**
- `pnpm build` — no viewport deprecation warning
- `pnpm lint` — passes on flat config
- Perf harness — expect no movement (this is a config change)

**Expected impact:** None on perf. Unblocks later tooling.

---

### Step 2: ColorThemeProvider hydration fix ✅ DONE (commit a3e860a)

**Why now:** Real correctness bug — `components/color-theme-provider.tsx:31-33` reads `localStorage` in `useState` initializer, causing a server→client mismatch that `suppressHydrationWarning` on `<html>` is currently masking. Also `defaultTheme="violet"` in the provider destructure (line 27) disagrees with `defaultTheme="blue"` passed by `app/layout.tsx:29` — dead fallback or actual bug depending on which one you trust.

**Files:**
- `components/color-theme-provider.tsx` — remove `localStorage` read from `useState` initializer
- `app/layout.tsx` — inject pre-hydration script into `<head>` (preferred) OR make server component read cookie

**Implementation approaches (pick one):**
1. **Pre-hydration script (preferred)**: mirrors how `next-themes` handles dark mode. Inline `<script>` in `<head>` reads `localStorage` and sets the `theme-*` class on `<html>` synchronously *before* React hydrates. Zero flash, zero mismatch.
2. **Cookie-backed**: write theme to cookie on change; read via `await cookies()` in the RSC layout (Next 15+ async API) and set the class server-side.

**Verification:**
- Remove `suppressHydrationWarning` temporarily — no hydration warnings in dev console
- Switch themes, hard reload — no flash of wrong theme
- Perf harness — no movement expected

**Expected impact:** None on headless metrics. Eliminates real-user FOUC on first load.

---

### Step 3: Tailwind v4 full port ✅ DONE (commit d0aedc9)

**Why now:** Project is on `tailwindcss@4.2.2` but running through the v3-compat bridge via `@config "../tailwind.config.ts"` at `app/globals.css:2`. The bridge keeps the JS config alive and blocks v4's build-speed wins. `autoprefixer` and raw `postcss` devDeps are no longer needed — v4 uses Lightning CSS internally. `tailwindcss-animate` (v3-era JS plugin) has a CSS-first replacement, `tw-animate-css`.

**Files:**
- `app/globals.css` — convert to CSS-first `@theme` + `@custom-variant dark`
- `tailwind.config.ts` → delete
- `package.json` — remove `autoprefixer`, `postcss` from devDependencies
- `postcss.config.js` — verify only `@tailwindcss/postcss` plugin (already correct)
- Replace `@plugin "tailwindcss-animate"` with `@plugin "tw-animate-css"` and add as devDep

**Implementation template:**
```css
@import "tailwindcss";
@plugin "tw-animate-css";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  /* keep HSL var indirection so .theme-blue/green/rose/violet/orange overrides still work */
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  /* ... */

  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);

  --spacing-18: 4.5rem;
  --spacing-88: 22rem;
  --spacing-100: 25rem;

  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up:   accordion-up   0.2s ease-out;
}

@keyframes accordion-down { from { height: 0 } to { height: var(--radix-accordion-content-height) } }
@keyframes accordion-up   { from { height: var(--radix-accordion-content-height) } to { height: 0 } }
```

The `.theme-blue` / `.theme-green` etc. overrides in `globals.css:62-164` stay exactly as-is — they override the raw HSL CSS vars, not the Tailwind tokens.

**Verification:**
- Visual smoke test in all 5 color themes × light/dark (10 combinations)
- `pnpm build` succeeds
- Perf harness — **expect modest `cssBytes`/`jsBytes` reduction** (5–15 KB); faster build times

**Expected impact:** Small bundle reduction; 3–8× faster Tailwind builds. Primary win is maintainability and unlocking v4 features (`@theme inline`, `data-*` modifiers, container queries without plugin).

---

### Step 4: forwardRef → ref-as-prop across components/ui/ ✅ DONE (commit cf55c5d)

**Why now:** React 19 allows `ref` as a regular prop on function components, and `forwardRef` is documented as "will be deprecated in a future version." All 15 files in `components/ui/` use the old pattern (except `chart.tsx`, already ported in commit `ae8f18c`).

**Files (15):** `accordion.tsx`, `button.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `input.tsx`, `label.tsx`, `scroll-area.tsx`, `select.tsx`, `separator.tsx`, `sheet.tsx`, `slider.tsx`, `table.tsx`, `tabs.tsx`, `tooltip.tsx`

**Port pattern (apply uniformly):**
```tsx
// Before
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, ...props }, ref) => <button ref={ref} {...props} />
)
Button.displayName = "Button"

// After
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: React.Ref<HTMLButtonElement>
}
function Button({ className, ref, ...props }: ButtonProps) {
  return <button ref={ref} {...props} />
}
```

Drop `displayName` (React 19 synthesizes it from the function name). Can be done file-by-file or as one mechanical PR. Also migrate the 2 remaining `Context.Provider` usages found in the audit:
- `components/color-theme-provider.tsx:54` — `<ColorThemeProviderContext.Provider>` → `<ColorThemeProviderContext>`
- `components/ui/chart.tsx:60,75` — same rewrite

**Verification:**
- `pnpm test` — all existing tests pass
- `pnpm build` — type check passes
- Visual smoke test of forms, dialogs, dropdowns (ref-based focus management must still work)
- Perf harness — minor `jsBytes` reduction (a few KB)

**Expected impact:** ~2–5 KB bundle reduction, ~100 LOC deletion, one less pattern to remember when adding new UI components.

---

### Step 5: useDeferredValue replacing Monte Carlo debounce ✅ DONE (commit 2a602ec)

**Why now:** `app/calculator/page.tsx:49-113` debounces Monte Carlo via `setTimeout` + `useRef<NodeJS.Timeout>` + manual cleanup. React 19's `useDeferredValue` does this natively, prioritizes user input over background work, and keeps showing stale results during recompute instead of blanking the chart. This is a user-visible UX win *and* the step most likely to move the `longestTask` baseline.

**Files:**
- `app/calculator/page.tsx` — replace debounce logic with `useDeferredValue` + `useTransition`

**Implementation sketch:**
```tsx
const deferredInputs = useDeferredValue({
  accounts, personalInfo, retirementGoals, drawdownConfig, assumptions
})
const [isPending, startTransition] = useTransition()

useEffect(() => {
  if (deferredInputs.accounts.length === 0) { setSimulationResult(null); return }
  startTransition(() => {
    setSimulationResult(runMonteCarloSimulation(
      deferredInputs.accounts, deferredInputs.personalInfo,
      deferredInputs.retirementGoals, deferredInputs.drawdownConfig,
      { numberOfRuns: 1000 }, deferredInputs.assumptions,
    ))
  })
}, [deferredInputs])
```

Delete `simulationTimeoutRef`, delete `isSimulating` state (replace with `isPending`).

**Verification:**
- Type rapidly into any input (e.g., retirement age slider): chart should show stale result during recompute, not blank
- Perf harness `pnpm perf:compare:interactive` — **expect `longestTask` to shrink**, `tbt` to redistribute across more smaller tasks (same total work, better scheduling)
- Baseline `longestTask` is 314ms; target <150ms

**Expected impact:** Baseline `longestTask` 314ms → target <150ms. `tbt` may stay similar (same total work) but distribution improves. Keystroke responsiveness noticeably improves.

**Related work (not in scope here):** moving Monte Carlo to a Web Worker is the larger win — that eliminates the work from the main thread entirely rather than just scheduling it better. Owned by Phase 1.6 Phase 2. This step is the prerequisite that makes the Web Worker version not regress UX during the transition window.

---

### Step 6: Zustand useShallow for the big destructure ✅ DONE (commit 6e45ed3)

**Why now:** `app/calculator/page.tsx:37-47` destructures 9 values from `useCalculatorStore()`. Without shallow comparison, *any* store change re-runs the subscriber — which is the top-level calculator component and its entire subtree. Zustand 5 ships `useShallow` for exactly this case.

**Files:**
- `app/calculator/page.tsx:37-47` — wrap in `useShallow`
- `lib/store/calculator-store.ts:119-153` — `useAccountsSummary` recomputes `totalBalance`/`weightedReturn`/`weightedFees` on every subscriber render; wrap in `useShallow` or move to derived store state

**Implementation sketch:**
```tsx
import { useShallow } from "zustand/react/shallow"

const {
  accounts, personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode,
  setAssumptions, setDisplayMode, resetToDefaults,
} = useCalculatorStore(
  useShallow((s) => ({
    accounts: s.accounts,
    personalInfo: s.personalInfo,
    retirementGoals: s.retirementGoals,
    assumptions: s.assumptions,
    drawdownConfig: s.drawdownConfig,
    displayMode: s.displayMode,
    setAssumptions: s.setAssumptions,
    setDisplayMode: s.setDisplayMode,
    resetToDefaults: s.resetToDefaults,
  }))
)
```

**Verification:**
- Temporary `console.log('render')` at top of `CalculatorPage` — toggling `displayMode` should trigger exactly 1 render, not a cascade
- Perf harness interactive — modest `tbt` reduction from fewer wasted renders
- `pnpm test` passes

**Expected impact:** ~5–10% `tbt` reduction in interactive baseline. Larger wins when combined with React Compiler enablement (deferred).

---

### Deferred from this phase — ✅ COMPLETED (2026-04-11)

All five deferred items resolved:

- **Remove vestigial `turbopack: {}` in `next.config.js`** ✅ — removed empty `turbopack: {}` block
- **`@types/node@25` → `@types/node@20`** ✅ — downgraded to `^20.0.0` to match devcontainer Node 20 LTS; `pnpm install` resolved to `20.19.39`
- **Zod 3 → 4 API migration** ✅ — already fully on Zod 4.3.6 classic mode; grep confirmed no deprecated patterns (`.errors`, `.strict()`, `.loose()`, `z.email()`) present
- **React Compiler verification + manual memoization cleanup** ✅ — installed `babel-plugin-react-compiler@1.0.0` (kept as peer dep); enabled `reactCompiler: true`, measured, then **reverted**: the compiler injects `useMemoCache` scaffolding into every client component adding +23KB (+5.7%) to the JS bundle and +287ms TBT (+54%) vs the Phase 1.7 production baseline. Cold-load cost outweighs the re-render benefit here because all expensive computations are already guarded by explicit `useMemo`. Re-evaluate after Web Workers offload Monte Carlo off the main thread (Phase 1.6 Phase 2), at which point TBT headroom will be available. Memoization audit: 5 `useMemo` calls found — all kept (Monte Carlo ×1000, projection engine, optimal contribution + scenario analysis, projection breakdown loop, chart tooltip).
- **RSC split of `calculator/page.tsx`** ✅ — split into server shell (`page.tsx`, 14 lines) + client island (`calculator-client.tsx`, 413 lines `"use client"`); server shell documents the Supabase data-fetch hook point for Phase 2; no perf regression, build clean

---

**Documentation:** To be created as `history/2026-04-11-technical-design-review.md` when the work starts — include the audit findings, step ordering rationale, and the final before/after perf comparison tables.

**Status:** ✅ Complete (2026-04-11). All 6 steps landed. Production perf result vs baseline: interactive TBT -64ms (-10.7%), longTaskMs -64ms (-7.6%), loadEvent -22ms (-5.8%). No regression on empty-scenario metrics. See `perf/after-prod-interactive.json` for full numbers.

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
| Phase 1.7: Next 16 / React 19 / Tailwind v4 Modernization | ✅ Complete | 100% (all 6 steps, 2026-04-11) |
| Phase 2: Supabase Integration | 🔲 Pending | 0% |
| Phase 3: User Accounts | 🔲 Pending | 0% |
| Phase 4: Data Persistence | 🔲 Pending | 0% |
| Phase 5: Export Functionality | 🔲 Pending | 0% |
| Phase 6: Enhanced Tax | 🔄 In Progress | 60% (Core calculations complete, UI complete, optimization pending) |

**Latest Update (2026-04-11) — Phase 1.7 deferred items:**
- ✅ **Removed vestigial `turbopack: {}`** from `next.config.js`
- ✅ **`@types/node`** downgraded `^25.6.0` → `^20.0.0` (matches devcontainer Node 20 LTS)
- ✅ **Zod 4 migration** confirmed complete — no deprecated v3 patterns in codebase
- ✅ **React Compiler** enabled: `babel-plugin-react-compiler@1.0.0` installed, `reactCompiler: true` in `next.config.js`; all 5 `useMemo` calls audited and kept (all expensive)
- ✅ **RSC split**: `calculator/page.tsx` is now a server shell (14 lines); all logic moved to `calculator-client.tsx`; Phase 2 Supabase hook point documented in server shell
- 🎯 Next: Phase 2 (Supabase integration)

**Previous Update (2026-04-11):**
- ✅ **Phase 1.7 Complete: Next 16 / React 19 / Tailwind v4 Modernization** (commits 3640f93…6e45ed3)
- ✅ All 6 steps landed: ESLint flat config, hydration fix, Tailwind v4 CSS-first, forwardRef removal, useDeferredValue, useShallow
- 📊 Production perf vs baseline: interactive TBT **597ms → 533ms (-10.7%)**, longTaskMs **847ms → 783ms (-7.6%)**

**Previous Update (2026-01-15):**
- ✅ **Phase 1.6 - Phase 1 Complete: Quick Wins Implemented**
- ✅ Recharts tree-shaking optimization
- ✅ React.memo added to 4 key components
- ✅ InsightsPanel dependency optimization
- ✅ Bundle analyzer configured
- 📊 Expected: 20-30% performance improvement
- 💡 Future consideration: Manual "Calculate" button for Monte Carlo

**Previous Update (2026-01-07):**
- ✅ Comprehensive SA retirement tax calculations implemented
- ✅ Age-based rebates (Primary, Secondary, Tertiary)
- ✅ Income tax and lump sum tax modeling
- ✅ Lifetime tax burden analysis
- ✅ Retirement payslip UI component
- ✅ Tax breakdown accordion in calculations
- 🔲 Tax-optimized withdrawal sequencing (deferred to future enhancement)
