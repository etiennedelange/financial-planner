# Phase 9.1 — NaN/Infinity guards (calculation engines)

## What changed

Two open Phase 9.1 Medium items. The **NaN/Infinity guards** item was real work; the
**Supabase error context** item was audited and found already resolved.

## NaN/Infinity guards

### The bugs (reproduced before fixing)

The engines can be called directly (tests, debug tools, malformed saved plans), and non-finite
inputs used to poison every downstream division:

- NaN account balance → `portfolioAtRetirement: NaN`
- `expectedReturn: Infinity` → `portfolioAtRetirement: Infinity`
- NaN `currentAge` → **slipped past the `yearsToRetirement < 0` guard** (`NaN < 0` is `false`),
  then projected from age 0 for 65 years — a silent wrong answer, not just a NaN
- `initialWithdrawalRate: 0` in `calculateOptimalContribution` → `targetNestEgg: Infinity`
- `gainFraction = (balance - costBasis) / balance` divided unconditionally, so a zero/NaN
  balance leaked NaN into the CGT/tax arithmetic for the whole drawdown year

### The guards (`lib/calculations/utils/invariant-guards.ts`)

Three new shared helpers (single source of truth, exported — not duplicated):

- `finiteOrZero(value)` — non-finite → 0 (matches the money-time convention that broken
  input degrades to a safe zero rather than throwing or propagating).
- `safePositiveDivide(numerator, denominator, fallback=0)` — returns the fallback when either
  operand is non-finite or the denominator is not positive, so a division cannot yield
  NaN/±Infinity.
- `sanitizeAccounts(accounts)` — returns a copy with every non-finite numeric account field
  coerced to 0 (never mutates the input; finite values pass through unchanged, so valid-input
  output is bit-identical).

### Application points

- `calculateProjection` — non-finite ages are detected **explicitly** (`NaN < 0` is false, so
  the old guard missed them) and routed through `buildEmptyProjectionResult`, the same
  degenerate path as inverted ages. Finite ages/incomes are coerced with `finiteOrZero` so
  row ages stay finite.
- `runAccumulationPhase` — sanitizes accounts at entry.
- `runDrawdownPhase` — sanitizes per-account balances/rates at entry and uses
  `safePositiveDivide` for `gainFraction`.
- `runMonteCarloSimulation` — same non-finite-age → empty-result routing and sanitized
  volatility; `simulateSingleRun` sanitizes accounts and uses `safePositiveDivide` for
  `gainFraction`.
- `calculateOptimalContribution` — 0% (or non-finite) withdrawal rate now yields
  `targetNestEgg: 0` instead of `Infinity`; sanitizes `currentSavings`, escalation, net return.

### Tests

- `lib/calculations/utils/invariant-guards.test.ts` — 17 tests for the three helpers
  (finiteness, zero/negative/NaN denominators, fallback, input immutability, TFSA-optional).
- `lib/calculations/__tests__/nan-infinity-guards.test.ts` (new) — 20 engine-level tests:
  NaN/Infinity in balance, return, fees, age, life expectancy, income, inflation,
  desired income → finite results; non-finite ages → empty result; `gainFraction` with a NaN
  discretionary balance stays finite; MC percentiles finite; optimal-contribution never
  returns an infinite target.

**Coverage bonus:** branches went 84.61% → **85.1%**, closing the long-standing global
`npm run test:coverage` failure (the previous 84.61% was the red build noted in the project
phases overview).

## Supabase error context — audited, already resolved

The phase doc claimed `accounts.ts:50-59` "returns empty array on error without logging". That
premise is stale — `fetchAccounts` has thrown on error since Phase 4 (`c8d5745`). Full audit:

- `accounts.ts`, `expenses.ts`, `scenarios.ts` all `throw error` on query failure.
- "No data" is distinct from "error": `fetchAccounts`/`fetchExpenses`/`listScenarios` return
  `[]`, `fetchScenario` returns `null` only for `PGRST116` (no rows) and throws otherwise.
- Stores log failures via `.catch(console.error)` / try-catch.
- Existing tests already cover the error paths (`accounts.test.ts`, `expenses.test.ts`,
  `scenarios.test.ts`).

No code change was warranted; the item is resolved by audit, ticked in the phase doc.

## Verification

- `npm run test` — 898/898 pass (50 files; golden harness confirms no valid-input drift)
- `npm run test:coverage` — branches 85.1% (threshold 85%), statements 93.84%
- `npm run typecheck` — clean
- `npm run lint` — 0 errors, 9 pre-existing React Compiler/RHF warnings (unchanged)
- `npm run build` — clean
- Empirical re-check of all four original bugs → all finite/degenerate now

## Files touched

- `lib/calculations/utils/invariant-guards.ts` — 3 new guards (+ JSDoc)
- `lib/calculations/utils/invariant-guards.test.ts` — 17 helper tests
- `lib/calculations/__tests__/nan-infinity-guards.test.ts` — new, 20 engine tests
- `lib/calculations/projection-engine.ts` — entry + phase + gainFraction guards
- `lib/monte-carlo/simulation-engine.ts` — entry + gainFraction guards
- `lib/calculations/optimal-contribution.ts` — withdrawal-rate and input guards
- `docs/project-phases/phase-9-site-improvement.md` — 9.1 Medium items flipped
