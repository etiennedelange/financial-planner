# Phase 1.5: Testing & Validation Framework ✅ P0 RESOLVED

> **Reopened and resolved 2026-07-26.** The audit showed the suite could not catch a
> regression when the same commit rewrote the test guarding it. The invariant suite has
> been rewritten and is now verified falsifiable by mutation testing — see "Open Tasks".
> P1/P2 items below remain open.

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

- [x] **P0: The suite cannot catch tautological-regression bugs** (Critical) ✅ **DONE 2026-07-26**
  - **Was:** a calculation regression shipped with 100% line coverage and every test
    green, because the commit that introduced it also rewrote the test that would have
    caught it. Coverage measures reach, not falsifiability.
  - **`invariants.test.ts` rewritten** from 19 unfalsifiable invariants to 21 that can
    actually fail. The file now opens with five explicit rules, the first being: never
    write `if (condition) expect(...)`, because a false condition asserts nothing.
  - **Key additions:**
    - **Conservation of money** — `startingBalance + contributions + growth - withdrawals
      === endingBalance`, exact to the rand in every year. Verified against the engine
      before being asserted. Note `fees` is deliberately NOT a term: `growth` is already
      net of fees (`netReturn = (expectedReturn - annualFees)/100`) and the `fees` field is
      reporting-only. A refactor that starts subtracting fees twice fails here.
    - **Explicit fixture preconditions** — a `surviving` and a `depleting` fixture, each
      asserting up front that it really does survive / deplete. The old suite's depletion
      tests were vacuous because their fixture never depleted (`fixed_percentage` decays
      geometrically and cannot reach zero); the depleting fixture now uses
      `fixed_amount_inflation_adjusted`, which genuinely runs out at age 67.
    - **Absolute magnitudes** instead of relationships between two outputs of the same
      function (`expect(shortfallAmount).toBeGreaterThan(50_000_000)`, not
      `if (surplus > 0) expect(shortfall).toBe(0)`).
  - **Deleted or replaced:** old INV-001/003 (restated `projection-engine.ts:585` against
    itself), INV-002/006 (guarded bodies never executed; `expect(null).toBeDefined()`
    passes on the no-depletion sentinel), INV-004 (`totalWithdrawals <= portfolio * 2`, an
    invented constant with 9% headroom that fails on a sound projection at
    `lifeExpectancy: 110`), INV-005/008 (guaranteed by the `Math.max(0, …)` clamp),
    INV-009 (recomputed the implementation formula in the test body), INV-011/012 (titles
    asserted properties the bodies never tested).
  - **`projection-engine.test.ts`** — three conditional-assertion blocks de-conditionalised,
    including the one `75f68f7` weakened from `expect(shortfallAmount).toBeGreaterThan(0)`
    into a tautology. **One of them was a test added earlier in the same session as this
    fix** — the anti-pattern is easy to reproduce, which is why the rule is now written at
    the top of the invariants file.
  - **`cross-tab-consistency.test.ts`** — the high-desired-income block branched on
    `surplusAmount`, so one arm restated the engine's guard and the other asserted
    `shortfall >= 0` (true by construction). It now documents the real interplay: the plan
    pays 7.7% of the goal, reports zero shortfall (settled semantics — it never depletes),
    and the Monte Carlo success rate of 0% is the metric that registers the failure.
  - **KNOWN GAP PINNED, NOT HIDDEN:** `yearlyProjections[].lumpSumTax` is 0 for every year
    including the retirement year, while `totalLumpSumTax` is populated. The old INV-017
    claimed to verify "lump sum tax is only non-zero at retirement year" while both of its
    branches passed on the constant 0. INV-018 now asserts the actual state, so implementing
    per-year attribution will fail it — deliberately marking the gap.
  - **VERIFIED BY MUTATION TESTING**, not by the suite passing (the old suite passed too).
    12 deliberate bugs injected into the engine; **12 of 12 killed**:
    conservation broken (fees subtracted twice), shortfall forced to 0 (the exact `75f68f7`
    regression), depletion fix reverted, income tax zeroed, surplus forced to 0,
    replacement ratio ×100 dropped, replacement ratio inverted, projection length
    off-by-one, withdrawals leaking into accumulation, and others.
  - **Status:** Complete — Phase 10 steps 3-5 are unblocked

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
