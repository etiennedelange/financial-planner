# Phase 1.5: Testing & Validation Framework 🔄 REOPENED

> **Reopened 2026-07-26.** The original framework was delivered and remains in place, but
> the 2026-07-26 audit showed the suite cannot catch a regression when the same commit
> rewrites the test that guards it. See "Open Tasks" at the end of this document — P0.

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

**Open Tasks (added 2026-07-26 from multi-agent audit of `75f68f7`):**

- [ ] **P0: The suite cannot catch tautological-regression bugs** (Critical)
  - **The problem:** a calculation regression shipped with 100% line coverage and every
    test green, because the commit that introduced it also rewrote the test that would
    have caught it. `projection-engine.test.ts` previously asserted
    `expect(result.shortfallAmount).toBeGreaterThan(0)` on the R10,000-balance fixture
    and passed; it became `if (surplus > 0) expect(shortfall).toBe(0)` — a verbatim
    restatement of `projection-engine.ts:585` that cannot fail while that line exists.
  - **Why coverage did not help:** these tests execute the code (line coverage 100%)
    without constraining its output. Coverage measures reach, not falsifiability.
  - **Delete rather than repair** — each of these is unfalsifiable as written, and
    deleting them is more honest than making them pass. Roughly 19 invariants amount to
    about 4 real checks:
    - `INV-001` / `INV-003` — assert `projection-engine.ts:585` against itself
    - `INV-002` / `INV-006` — guarded bodies never execute on their fixture (0 assertions
      run); `expect(null).toBeDefined()` also passes on the no-depletion sentinel
    - `INV-005` / `INV-008` — masked by `Math.max(0, …)` at `projection-engine.ts:522`;
      negative arithmetic would be hidden by the clamp and still pass
    - `INV-009` — recomputes the implementation formula in the test body
    - `INV-017` — asserts on `yearlyProjections[].lumpSumTax`, which is identically 0
      for every year; both branches pass on the constant
    - `INV-004` — `totalWithdrawals <= portfolioAtRetirement * 2` is an invented
      constant, not an invariant; fails on a sound projection at `lifeExpectancy: 110`
    - `cross-tab-consistency.test.ts:440-447` — every assertion inside a conditional,
      plus `expect(shortfallAmount).toBeGreaterThanOrEqual(0)` (tautology)
  - **Replace with falsifiable checks:**
    - Assert **absolute magnitudes**, not relationships between two outputs of the same
      function (e.g. `expect(shortfallAmount).toBeGreaterThan(50_000_000)` for a fixture
      known to fail catastrophically)
    - Assert the **conservation identity**:
      `sum(withdrawals) + finalBalance + sum(fees) + sum(tax) === portfolioAtRetirement + sum(growth)`
      — this is a real invariant and cannot be satisfied by a wrong formula
    - Assert **preconditions inside the test** so a fixture that stops exercising the
      scenario fails loudly instead of silently passing (see the `Depletion detection`
      block added 2026-07-26 for the pattern)
    - Never write `if (x) expect(...)` — a guard that does not hold means 0 assertions
  - **Add a lint rule or review check** for assertions nested inside conditionals in
    test files; that single pattern accounts for most of the above.
  - **Status:** Open — highest-value testing work outstanding

- [ ] **P1: Zero tests on Zustand stores** (High Priority)
  - `calculator-store.ts` and `expenses-store.ts` — long-standing gap, also noted in CLAUDE.md
  - `lib/store/calculator-store.test.ts` currently has ~10 pre-existing type errors
  - **Status:** Open

- [ ] **P2: Pre-existing type errors in test files** (Medium Priority)
  - `npx tsc --noEmit` reports 44 errors, all in `.test.ts` files
    (`calculator-store.test.ts`, `expenses-store.test.ts`, `expenses.test.ts`,
    `scenarios.test.ts`, `cross-tab-consistency.test.ts`)
  - Production build is clean, so these are invisible to CI — fixtures have drifted from
    the `Account` / `DrawdownConfig` types (e.g. `balance` vs `currentBalance`, missing
    `lumpSumPercentage`)
  - **Status:** Open

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

**Documentation:** See `docs/history/testing-and-validation-plan.md`
