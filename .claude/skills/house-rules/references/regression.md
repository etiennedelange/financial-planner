# Regression Checklist

Read when the diff touches `lib/calculations/`, `lib/monte-carlo/`, `lib/constants/`,
`lib/store/`, or any `*.test.ts`.

Every entry below is a bug that actually shipped in this project. They are ordered by how
much damage they did.

---

## R1 — The test that was rewritten alongside the code it guards

**The incident:** commit `75f68f7` introduced a calculation regression and shipped with 100%
line coverage and a fully green suite, because the same commit weakened the test that would
have caught it — `expect(shortfallAmount).toBeGreaterThan(0)` became a tautology. Coverage
measures reach, not falsifiability.
**Source:** `docs/project-phases/phase-1-5-testing-validation.md` (P0, resolved 2026-07-26),
`docs/history/2026-07-26-audit-batch-1-fixes.md`

**Check:** does this diff modify a calculation file *and* a test file guarding it?

If yes, that pairing is the single highest-value thing to inspect in the whole review. For
each changed assertion ask: **is the new assertion weaker than the old one?**

Weakening looks like:

| Before | After | Why it is weaker |
|---|---|---|
| `expect(x).toBeGreaterThan(0)` | `expect(x).toBeGreaterThanOrEqual(0)` | passes on the `0` the bug produces |
| `expect(x).toBe(1234.56)` | `expect(x).toBeCloseTo(1234, -2)` | tolerance now swallows the defect |
| an unconditional assert | `if (cond) expect(...)` | asserts nothing when `cond` is false |
| `expect(result.total).toBe(...)` | `expect(result).toBeDefined()` | tests presence, not value |

A weakened assertion in the same commit as the logic it covers is **Critical** unless the
diff explains why the old assertion was wrong. "The test was failing" is not that
explanation — that is the test working.

**Check:** any new `if (condition) expect(...)`. This is banned outright. The rule is written
at the top of `invariants.test.ts`: a false condition asserts nothing, so the test passes
without testing. The anti-pattern is easy to reproduce — one instance was introduced in the
very session that fixed the others.

**Check:** does a new test assert a *relationship between two outputs of the same function*
rather than an absolute magnitude? `if (surplus > 0) expect(shortfall).toBe(0)` restates the
engine's own guard against itself and cannot fail. Prefer
`expect(shortfallAmount).toBeGreaterThan(50_000_000)`.

**Check:** does a fixture assert its own precondition? The old depletion tests were vacuous
because their fixture never depleted — `fixed_percentage` decays geometrically and cannot
reach zero. A depletion test must first prove its fixture actually depletes.

---

## R2 — Copied calculation logic

**The incident:** twice. `projectFinalSavings` existed in three files (Phase 1.5).
`calculateInitialWithdrawal` existed in three copies (Phase 10) — the deterministic engine
and Monte Carlo silently modelled *different plans*.
**Source:** CLAUDE.md "Common Pitfalls", `docs/history/2026-07-26-phase-10-calculation-simplification.md`,
`docs/history/2026-06-20-phase9-calculation-dedup-and-guards.md`

**Check:** does the diff add a function that computes something an engine already computes?
Search `lib/calculations/utils/` before accepting any new local helper. If a private engine
function was tempting to copy, the rule is to **export it**, never duplicate it.

**Check:** does a UI, chart, or debug component compute a projection itself? Debug and UI
components must call the same shared function the engine calls, so they cannot drift.
`SimulationRunStatus`, the sensitivity tornado, and income-sustainability charts all reuse
the shared engine specifically for this reason.

**Check:** is a genuine behavioural difference between two callers expressed as an *omitted
optional parameter*? Make it required and named — see `WithdrawalBaseline` — so the
difference is visible at every call site instead of hiding in a default.

---

## R3 — Compounding method ignored

**The incident:** the Insights tab did not update when toggling compounding method, because
calculation functions were hardcoded to nominal.
**Source:** CLAUDE.md, `docs/history/2026-01-05-insights-tab-fix-and-testing-framework.md`

**Check:** any `annualReturn / 12`, `rate / 12`, or equivalent. Monthly return must derive
from `assumptions.compoundingMethod` via the shared `calculateMonthlyReturn()`.

**Check:** new calculation code that does not thread `assumptions` through.

**Check:** `useMemo` / `useCallback` deps that omit `assumptions`. This is how the original
bug survived — the value was correct on first render and stale forever after.

---

## R4 — Silent bypass of a guard or legal limit

**The incident:** several. Projections over-contributed past the R500k TFSA lifetime and R36k
annual caps, overstating balances. Lump-sum logic silently bypassed the legal commutation
limit. Non-finite inputs poisoned every downstream division into `NaN`/`±Infinity`.
**Source:** `docs/history/2026-05-09-tfsa-limits-and-medical-aid-credits.md`,
`docs/history/2026-06-20-validator-audit-lump-sum-and-cgt-fixes.md`,
`docs/history/2026-08-14-phase-9-1-nan-infinity-guards.md`

**Check:** new arithmetic on user input that skips the guards in
`lib/calculations/utils/invariant-guards.ts` — `finiteOrZero`, `safePositiveDivide`,
`sanitizeAccounts`. New engine entry points must guard at the boundary like
`calculateProjection`, `runAccumulationPhase`, `runDrawdownPhase`,
`runMonteCarloSimulation`, and `calculateOptimalContribution` do.

**Check:** any new division where the denominator could be 0 or non-finite. A 0% withdrawal
rate previously yielded `targetNestEgg: Infinity`.

**Check:** contribution or withdrawal logic that does not clamp to the statutory cap. Limits
live in `lib/constants/tax-year.config.ts` — the single source of truth. A literal rand
threshold inline in a calculation is a finding regardless of whether the number is currently
correct.

---

## R5 — Conservation of money

**Source:** `invariants.test.ts` (rewritten 2026-07-26, verified by mutation testing —
12 injected bugs, 12 killed)

The invariant, exact to the rand in every year:

```
startingBalance + contributions + growth - withdrawals === endingBalance
```

`fees` is deliberately **not** a term. `growth` is already net of fees
(`netReturn = (expectedReturn - annualFees)/100`); the `fees` field is reporting-only.

**Check:** does the diff subtract fees anywhere in the balance walk? That double-counts, and
it is exactly the mutation the invariant suite was built to kill. If the diff changes how
fees are applied, the invariant test must have been updated deliberately and the reasoning
stated — see R1.

---

## R6 — Store hydration and persistence races

**The incident:** the persisted plan was wiped on reload. Both stores use `skipHydration`
with the layout calling `rehydrate()` in an effect, and zustand persist writes to storage on
every `set()`. `SupabaseProvider`'s `setSessionId` fired before rehydrate's read settled,
persisting the pre-hydration DEFAULT state over the saved plan. Signed-in reloads masked it
via `syncFromDb`; signed-out reloads lost the plan permanently.
**Source:** `docs/history/2026-08-15-persist-write-gate.md`,
`docs/history/2026-08-15-bootstrap-data-ownership-hardening.md`

**Check:** any new `set()` on a persisted store that can fire during bootstrap, before the
first rehydrate settles. Writes must go through `createGatedPersistStorage`
(`lib/store/persist-gate.ts`).

**Check:** new bootstrap, auth-listener, or hydration ordering. One serialized XState
coordinator owns hydration (once per guest/user scope, never concurrent), verified auth, MFA
gating, claim, and sync. The auth listener is a **pure event forwarder** — logic added there
is a finding.

**Check:** scenario state added to `expenses-store.ts`. It is global by design and must not
become scenario-tied.

---

## R7 — Test fixtures drifted from real types

**The incident:** 44 type errors accumulated in `.test.ts` / `.bench.ts` files unnoticed,
because `next build` does not typecheck them and CI never saw them. Not cosmetic: fixtures
had drifted so far that tests exercised shapes that cannot occur in production —
`calculator-store.test.ts` built `Account` objects with `balance` (the field is
`currentBalance`) and `type: "TFSA"` (the union is lowercase `'tfsa'`), so any code
branching on `acc.type === 'tfsa'` took the wrong path in all 27 of those tests.
**Source:** `docs/project-phases/phase-1-5-testing-validation.md` (P2, resolved 2026-07-26)

**Check:** run `npm run typecheck`. `npm run build` passing proves nothing about test files.

**Check:** new fixtures built as object literals rather than from a shared factory or the
real exported type. A fixture that compiles is not necessarily a fixture that is *possible*.

---

## R8 — Coverage bar

**Source:** CLAUDE.md — >90% on calculation files; 85% branch threshold.

**Check:** calculation code changed without a corresponding `.test.ts` change. CLAUDE.md
rule 1 is absolute: *all calculation code changes MUST include unit tests, no exceptions*.

**Check:** the required edge cases are covered — R0 contributions, 0% escalation, zero
balance, negative years — and **both** compounding methods, nominal and compound.

**Known gaps — do not report these as new findings.** They are pinned deliberately:

- `calculator-store.ts` branch coverage ~72.5%, `expenses-store.ts` ~76.3%, against the 85%
  threshold. Open P1, tracked in `phase-1-5-testing-validation.md`.
- `yearlyProjections[].lumpSumTax` is `0` for every year including the retirement year while
  `totalLumpSumTax` is populated. INV-018 asserts this actual state, so implementing
  per-year attribution will deliberately fail it. That failure is the signal, not a bug.
