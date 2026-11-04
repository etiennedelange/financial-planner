---
type: Implementation Plan
title: "Investment Types, Success Range and Historical Stress Test — Handoff Plan"
description: "Handoff for three Risk-page features: per-account investment types with verified volatilities and correlation, success shown as a cautious–central range, and a deterministic historical stress test; includes the blocking return-convention decision, research checklist, ordered steps and gates."
date: 2026-11-01
tags: [monte-carlo, risk, calculations, handoff]
---

# Investment Types, Success Range and Historical Stress Test — Handoff Plan

Status: **Decision 0, research, Features 1 and 2 done (2026-11-04); Feature 3 not started**. Feature 2: [../../history/2026-11-04-success-range.md](../../history/2026-11-04-success-range.md). Feature 1: [../../history/2026-11-04-investment-types-per-account.md](../../history/2026-11-04-investment-types-per-account.md). Research and the decisions on it: [../../history/2026-11-04-investment-type-risk-research.md](../../history/2026-11-04-investment-type-risk-research.md); constants in `lib/constants/investment-types.ts`. Planned 2026-11-01 at the end of the SA calculation audit session.

## Start here

1. **Branch state.** All prior work is **uncommitted** on `fix/sa-retirement-calc-audit`, about
   77 paths on top of `main` at `25618af`. Ask Etienne to commit or PR it first, then branch
   from it. Do not start these features on `main`, which lacks the Risk page and the shared
   drawdown engine.
2. **Read these, in order:**
   - [../../history/2026-10-31-sa-retirement-calc-audit.md](../../history/2026-10-31-sa-retirement-calc-audit.md):
     engine changes, sources, limitations.
   - [../../history/2026-10-31-risk-page.md](../../history/2026-10-31-risk-page.md): why Monte
     Carlo lives only on `/calculator/risk`.
   - [../../history/2026-11-01-audit-fixes.md](../../history/2026-11-01-audit-fixes.md): audit
     fixes, the withdrawal-order trade-off, and the main-vs-branch comparison on Etienne's own plan.
   - `CLAUDE.md`, especially:
     - calculation changes need tests
     - never copy calculation logic
     - required named arguments, not omitted optionals
     - Monte Carlo only on Risk
     - three-tier docs
3. Decision 0 (median return), the research and Features 1–2 are done; start at Feature 3.

## Why

Etienne invests partly through Satrix in **Nasdaq 100 and MSCI World**. Today every account
with a non-zero expected return gets the same "equity volatility" (default 16.5%), and all
accounts move in perfect lockstep:

- **Volatility is wrong in both directions.** It is too low for a concentrated tech index and
  probably too high in rand terms for a broad global index. It is far too high for balanced
  and cash accounts.
- **The success rate swings on this one setting.** For his plan, volatility of 10% gives 93%
  and 16.5% gives 70%.
- **Bond volatility is unused.**
- **The equity, bond and cash return fields are unused.** They are labelled "reference only".

Agreed direction (2026-10-31/11-01):

1. per-account investment types with verified volatilities and partial correlation between types
2. success shown as a range, not one number
3. a plain historical stress test

## Decision 0 (resolved 2026-11-04: typical / median return)

Implemented: [../../history/2026-11-04-mc-median-return-basis.md](../../history/2026-11-04-mc-median-return-basis.md).

| Option | Monte Carlo draws | Effect |
|---|---|---|
| **Average return (current)** | `logMean = ln(1 + r) − σ²/2` | The simulated *mean* equals the deterministic projection; the *median* lands below it (about 34% after 30 years at σ=16.5%) |
| **Typical return (recommended)** | `logMean = ln(1 + r)` | The deterministic projection is the *middle* of the Monte Carlo range; easier to explain; more optimistic |

The recommendation is the typical (median) return, because SA fund and index long-run
returns are usually quoted as compound (CAGR) figures. Etienne has not decided yet.

If the typical return is chosen:
- **Change:** `returnsFromShocks` in `lib/monte-carlo/random-returns.ts`. Keep it the single
  place this formula lives.
- **Update these tests:**
  - "the arithmetic mean of the simple returns approximates the expected return" in
    `random-returns.test.ts` (becomes a median check)
  - the "mean final balance equals the projection" test in
    `lib/calculations/__tests__/sa-audit-scenarios.test.ts` (becomes a median check)
  - "matches the deterministic projection on average, with the median below it" in
    `tests/integration/cross-tab-consistency.test.ts`
- **Regenerate** the golden MC file after review.
- **Fix the methodology copy** in `components/results/monte-carlo-methodology.tsx` and §7 of
  `docs/FINANCIAL_LOGIC_REFERENCE.md`.

Either way, also note: `calculateEffectiveAnnualReturn` (`lib/calculations/utils/projection.ts`)
already centres returns on the projection's effective growth under both compounding methods.
Keep that.

## Where things stand (code map)

| Concern | Location |
|---|---|
| Account type and fields | `types/accounts.ts` (`Account`; `tfsaContributionsToDate` is the precedent for an optional per-account field) |
| Account persistence | `lib/supabase/accounts.ts` (row ↔ Account mapping), `types/supabase.ts`, `supabase/migrations/` (precedent: `20260509000000_add_tfsa_contributions_to_date.sql`) |
| Account form | `components/accounts/account-form-dialog.tsx` (zod `accountSchema` ~line 42), list in `components/pages/accounts-page.tsx` |
| Plan import/export | `lib/utils/plan-io.ts`, `lib/store/calculator-store.ts` (persist `version: 2`, `migrate`) |
| Monte Carlo | `lib/monte-carlo/simulation-engine.ts`: per-account volatility at ~line 92 (`acc.expectedReturn === 0 ? 0 : volatility`); global volatility at ~line 370; one shared shock per year via `generateMarketShocks` |
| Return generation | `lib/monte-carlo/random-returns.ts` (`generateMarketShocks`, `returnsFromShocks`) |
| Worker | `lib/monte-carlo/use-monte-carlo-worker.ts`, `simulation.worker.ts`; started from `lib/context/calculator-context.tsx` only on `/calculator/risk` |
| Risk page | `components/pages/risk-page.tsx`, `components/inputs/volatility-form.tsx`, `components/charts/monte-carlo-chart.tsx`, `components/results/monte-carlo-methodology.tsx` |
| Verdict and labels | `lib/utils/plan-verdict.ts`, `lib/utils/success-rate.ts` (labels currently disagree: "Fair" vs "at risk", an open audit item) |
| Deterministic engine | `lib/calculations/projection-engine.ts` (`runAccumulationPhase`, `runDrawdownPhase`, `calculateProjection`); one drawdown year = `runDrawdownYear` in `lib/calculations/utils/drawdown-year.ts` |
| Reference returns (unused) | Plan → Market Assumptions in `components/inputs/assumptions-form.tsx`; `assumptions.equityReturn/bondReturn/cashReturn` |

## Research checklist (do before Feature 1 constants)

Record every figure with its URL and verification date, as `lib/constants/tax-relief-history.ts`
does. Flag anything unverifiable instead of guessing.

**Already verified (2026-10-31/11-01):**
- FTSE/JSE All Share calendar-year returns 1974–2017. Worst year 2008 at −23.2%; 1975 −18.9%;
  1998 −10.0%. Source: https://topforeignstocks.com/2014/01/08/south-africas-ftsejse-all-share-index-returns-by-year/
  (credits Allan Gray; probably total return, but only the author's comment says so).
  Compute SA equity volatility from this series as a cross-check.
- JSE fell about 40% peak to trough in the 2008 crisis:
  https://www.moneyweb.co.za/investing/volatile-jse-really/
- Allan Gray Balanced Fund (SA Multi-Asset High Equity), risk measures as at 30 Sep 2026:
  max drawdown −25.4%, lowest annual return −14.2%, highest 46.1%. The period is not stated.
  https://www.allangray.co.za/fund-pages/balanced-fund/
- Living annuity band 2.5%–17.5%: National Treasury, 2 June 2020,
  https://www.treasury.gov.za/comm_media/press/2020/20200602%20Media%20statement%20-%20Gazetting%20of%20Notices%20on%20Expanding%20Access%20to%20Living%20Annuity%20Funds.pdf

**Still needed:**

| Figure | Per type | Suggested sources |
|---|---|---|
| Annualised volatility (ZAR terms, ≥10 years) | all six types | Satrix fund factsheets (Satrix Nasdaq 100, Satrix MSCI World, Satrix 40/Top 40); ASISA category data; FTSE/JSE and MSCI factsheets (MSCI publishes USD figures, so ZAR needs USD/ZAR adjustment or a ZAR-denominated tracker) |
| Worst peak-to-trough drawdown, and 2008 and 2020 figures | all six types | fund factsheets ("max drawdown", "lowest annual return"); MSCI World 2008 in ZAR |
| Correlation: SA equity ↔ global equity (ZAR), SA equity ↔ SA bonds | type pairs | UCT thesis (Hudson 2025, PDF https://open.uct.ac.za/bitstreams/4ec40eca-f1c4-48fa-8aa0-d5f6b10c9f39/download); asset-manager research notes |

**Access notes:**
- Stats SA PDFs and SAFLII return HTTP 403 to automated fetches.
- The SARS Budget Tax Guide PDF is image-only.
- Allan Gray and Coronation factsheet PDFs came back as compressed binary. A
  zlib + ToUnicode extractor got almost no text; one exists at the scratchpad path
  `scripts/pdf2txt.py`, which may not survive. There is no `pdftotext` in the container.
- If a figure can only come from a secondary source, mark it `secondary` in the constants file.

## Feature 1 — Investment types per account

**Model.** `InvestmentType = "cash" | "conservative" | "balanced" | "sa_equity" |
"global_equity" | "concentrated_equity"`. Add constants in `lib/constants/investment-types.ts`,
one entry per type:
- `label`
- `example` (e.g. "Satrix MSCI World", "Satrix Nasdaq 100")
- `volatility` (decimal)
- `factorLoading` (0–1)
- `worstDrawdown` (for Feature 3)
- `suggestedReturn`
- `sources[]`
- `verifiedOn`
- `secondary?`

**Correlation: one-factor model**, which keeps splitting invariance (accounts of the same type
share a shock):

```
per run, per year: z_market ~ N(0,1); z_type[t] ~ N(0,1) for each type t
shock(account) = sqrt(ρ_t) · z_market + sqrt(1 − ρ_t) · z_type[type(account)]
corr(type i, type j) = sqrt(ρ_i · ρ_j)     (i ≠ j);  same type → 1
```

- Calibrate the loadings ρ_t from the researched pairwise correlations. With few data points,
  document the fit.
- Cash: `factorLoading` 0, volatility about 0.5–1%.
- Extend `random-returns.ts` (e.g. `generateFactorShocks(years, types, rng)`). Do not inline
  it in the engine.
- Shocks must stay reproducible from `randomSeed`.

**Backward compatibility.** "Do not silently change existing user inputs" applies here.
- `investmentType` is **optional** on `Account`. When it is missing, the account keeps
  today's behaviour: global `equityVolatility`, or 0 for a 0% return. It joins the market
  factor with loading 1.
- The account form defaults *new* accounts to Balanced. Existing accounts show a "choose a
  type" prompt on the Accounts and Risk pages. Do not migrate stored data to Balanced.
- Resolve the per-account volatility in **one** exported function, e.g.
  `resolveAccountRisk(account, assumptions)` in `lib/calculations/utils/`. Both
  `simulation-engine.ts` and the Feature 3 stress test call it.

**Persistence.**
- Supabase migration: `alter table accounts add column if not exists investment_type text
  null` with a check constraint on the six values, plus a column comment.
- Map it in `lib/supabase/accounts.ts`, and update `types/supabase.ts` (generated type; edit
  or regenerate).
- `plan-io.ts` import tolerates the field being absent.
- No store `migrate` is needed for an optional field.

**UI.**
- Account form: a select with the example fund names.
- Accounts list: show a type chip.
- Risk page, `VolatilityForm`: replace the equity and bond inputs with a read-only per-type
  table (volatility, worst drawdown, source). Keep `equityVolatility` editable as "Volatility
  for accounts without a type".
- Bond volatility has no remaining use. Either wire it into Conservative/Balanced via the
  type constants, or remove it with an explicit note in the history doc.
- Plan → Market Assumptions "reference only" returns: Etienne said keep as-is
  (2026-11-01). Only revisit if he asks. The types carry their own `suggestedReturn`, shown in
  the account form as a hint and never auto-applied.

**Tests (CLAUDE.md structure: Critical SA scenarios / compounding / edge cases):**
- Shocks: same type → identical shocks; cross-type empirical correlation ≈ sqrt(ρ_i ρ_j) over
  many draws; loading 0 → independent; seeded output reproducible.
- Splitting invariance still holds: extend the existing test in `sa-audit-scenarios.test.ts`
  to typed accounts.
- Type volatility is used. For example, a Nasdaq-type account gives a wider p10–p90 band than
  MSCI World at the same return, which is wider than Balanced.
- An account without a type gives exactly the pre-feature result. Pin this with a golden or
  direct comparison.
- At zero volatility, Monte Carlo still equals the deterministic projection: extend the
  existing cross-engine test.
- Persistence mapping round-trip and the plan import without the field.

## Feature 2 — Success as a range

**Definition.**
- **Central:** each type's volatility.
- **Cautious:** each type's volatility × a stress factor, computed from the research as the
  worst rolling 10-year realised volatility ÷ the long-run figure for that type. If the data
  is too thin, use one documented factor.
- Run both with the **same seed** (common random numbers), so the range reflects volatility,
  not sampling noise.

**Engine and worker.**
- `useMonteCarloWorker` takes one config. Either call it twice from `calculator-context.tsx`
  (Risk only) or extend the worker message to a list of volatility profiles.
- Add a `volatilityScale` (or per-type override) argument to `runMonteCarloSimulation` as a
  **required named** input. Do not use an omitted optional.
- Cost: 2 × 1,000 runs, on Risk only.
- Fix the open audit item at the same time. The Risk page's `compareScenarios` memo depends on
  the whole `assumptions` object, so it reruns on every volatility keystroke. Depend on
  `assumptions.compoundingMethod` only.

**UI.**
- Plan Success Rate card shows "likely X–Y%". Tone and verdict follow the **cautious** (lower)
  bound.
- Unify the labels in `success-rate.ts` and `plan-verdict.ts`, which is an open audit item.
- The fan chart shows the central run. Optionally overlay the cautious p10.
- Update `MonteCarloMethodology`.

**Tests.**
- cautious success ≤ central success for the same seed (monotonic in volatility)
- the range collapses to a point at zero volatility
- verdict tone uses the lower bound

## Feature 3 — Historical stress test (deterministic)

**Scenario.** "If your investments fall as they did in 2008 in your first year of retirement":
- Each account's year-0 drawdown return is replaced by its type's `worstDrawdown`. Untyped
  accounts use the SA equity figure, or scale by `equityVolatility` (document which).
- Later years return to expected returns.
- Optional second scenario: a 2020-style fall with a fast recovery.

**Engine.**
- Add a required, named per-year return override to the drawdown phase. For example,
  `runDrawdownPhase(…, returnOverrides: ReadonlyArray<ReadonlyArray<number | null>>)`, where
  `calculateProjection` passes an empty array.
- Or add a dedicated `calculateStressProjection(…, scenario)` that reuses
  `runAccumulationPhase` and `runDrawdownPhase`.
- Do **not** copy the drawdown loop.
- Outputs:
  - `incomeGoalShortfallAge` (existing selector)
  - money left at life expectancy
  - the lowest year of income as a % of the goal

**UI.** A Risk-page card in plain English:
- "In a 2008-style fall at 65, your goal income lasts to age X (vs Y with steady returns)."
- Show the drawdown figures used and their sources.

**Tests.**
- With a 0% shock, the stress projection equals `calculateProjection` exactly.
- A −40% year-0 shock gives the hand-computed year-0 ending balance (monthly-withdrawal factors
  as in `drawdown-year.test.ts`).
- The shortfall age is ≤ the steady-return shortfall age.
- Typed and untyped accounts use the documented drawdowns.

## Order of work

1. Etienne commits or PRs the current branch; branch from it.
2. Decision 0, and implement it if it changes anything (small, self-contained, own commit).
3. Research checklist; write `lib/constants/investment-types.ts` with sources.
4. Feature 1: engine and tests, then persistence and migration, then UI.
5. Feature 2.
6. Feature 3.

After each feature: run the gates, review and regenerate goldens only if the change is
intended, then update the docs.

## Gates (every feature)

- `npm run check`: 0 errors. Run `npx vp check --fix` first to format.
- `npm run typecheck`
- `npm run test`
- `npm run test:coverage`: over 90% lines on modified calculation files
- Production build: `NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=dummy npm run build`
  (the build fails without these in the container)
- `npm run shadscan:gate`: baseline 93/100
- `npm run docs:check`
- Browser check of Risk, Accounts and Overview with a typed plan.
  - Import a plan JSON via Settings.
  - The Playwright MCP browser is not installed; use `@playwright/test`'s chromium from a
    temporary `.mjs` in the repo root.
- Golden files (`lib/calculations/__tests__/__golden__/`): regenerate only after reviewing the
  diff (`UPDATE_GOLDEN=1 npx vp test run <golden test>`), and record the deltas in the history doc.

## Docs (CLAUDE.md three tiers)

- One history file per feature, or one for all three:
  `docs/history/YYYY-MM-DD-investment-types-range-stress-test.md`.
- Tick the checkboxes in `docs/project-phases/phase-9-site-improvement.md` §9.6 (pending list)
  and §9.7.
- Add a `docs/log.md` entry.
- Update `docs/FINANCIAL_LOGIC_REFERENCE.md` §7 (return generation, correlation, range) and add
  a stress-test section.

## Gotchas from the previous session

- `pkill -f "next dev"` matches the shell running it and kills it (exit 144). Kill by PID with
  a bracket pattern, e.g. `ps -eo pid,args | grep "[n]ext dev"`.
- `next dev` writes an untracked `AGENTS.md` and may touch `CLAUDE.md`. Delete the untracked
  file before finishing.
- Vitest `it.each` titles: `%%` renders oddly. Avoid `%` in parameterised titles.
- Test files import from `vite-plus/test`, not `vitest`.
- Throwaway probes go in `lib/calculations/__tests__/zz-*.test.ts`. Delete them afterwards and
  confirm with `git status --porcelain | grep zz-`.
- Comparing against `main`: `git worktree add <scratch>/main-wt main`, symlink `node_modules`,
  run the same probe, then `git worktree remove --force`.

## Out of scope (open audit items, separate work)

These are listed in `docs/project-phases/phase-9-site-improvement.md` §9.7:
- medical aid escalating at 9% for decades
- the "historical" tax-relief window and labels
- rebuilding the investment-scenario comparison on the user's accounts (and removing the
  "Recommended" badge, a FAIS concern)
- shortfall depth instead of all-or-nothing success
- optimal contribution at a 0% withdrawal rate
- edge cases (negative inflation, depletion age 0)
- doc wording (two-pot R240k, provident vested rights)
- tax figures duplicated outside `tax-year.config.ts`

Feature 1 makes the scenario comparison easier to rebuild, but don't fold it in unasked.
