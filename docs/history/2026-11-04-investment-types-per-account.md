---
type: History Entry
title: "2026-11-04 — Investment types per account: per-type volatility and one-factor correlation in Monte Carlo"
description: "Feature 1 of the investment-types plan: an optional investmentType on Account drives Monte Carlo volatility and correlation through resolveAccountRisk and generateFactorShocks; untyped accounts reproduce the pre-feature result exactly; Supabase column, import, account form, accounts list, Risk page and debug window updated."
date: 2026-11-04
tags: [monte-carlo, accounts, supabase, risk]
---

# 2026-11-04 — Investment types per account

Feature 1 of the [investment types plan](../superpowers/plans/2026-11-01-investment-types-range-stress-test.md).
Figures and their sources: [research record](2026-11-04-investment-type-risk-research.md).

## What changed

**Model.** `Account.investmentType?: InvestmentType` (six values, `types/accounts.ts`),
separate from the tax wrapper `type`. Only Monte Carlo reads it. The deterministic
projection, Overview and Projections are unchanged.

**Engine.**
- `resolveAccountRisk(account, untypedVolatility)` (`lib/calculations/utils/account-risk.ts`)
  is the one place an account's volatility and market loading are decided. A typed account
  takes its type's figures. An untyped account keeps the old rule: global equity volatility,
  0 for a 0% return, loading 1. The engine and the debug window both call it.
- `generateFactorShocks(years, loadings, rng)` (`random-returns.ts`) draws the market shocks
  first, exactly as before, then one idiosyncratic sequence per type present with ρ < 1, in
  `INVESTMENT_TYPES` order. Shock = √ρ·z_market + √(1−ρ)·z_type.
- `simulation-engine.ts` resolves risks once per simulation, from the same sanitised
  accounts each run uses. Untyped accounts take the market shock itself.

**Backward compatibility.** A plan with no typed accounts consumes the generator identically,
so it reproduces the pre-feature result bit for bit. The golden Monte Carlo file passed
unchanged and was not regenerated. Existing accounts are not migrated to a type.

**Persistence.**
- Migration `20261104000000_add_investment_type_to_accounts.sql` adds a nullable
  `investment_type` text column, with a check constraint on the six values and a comment.
- `lib/supabase/accounts.ts` maps it both ways. An unrecognised stored value reads back as untyped.
- `types/supabase.ts` is edited by hand to match; regenerate it after applying the migration.
- `plan-io.ts` imports files without the field (older exports) and drops unrecognised values.
- No store `migrate` is needed for an optional field.

**UI.**
- **Account form:** an "Invested In" select with example funds. New accounts default to
  Balanced; an untyped account being edited shows "Choose an investment type". The
  expected-return hint now asks for a long-run compound (CAGR) return and shows the type's
  suggested figure, which is never applied.
- **Accounts list:** the provider line shows the type, or "Choose what it's invested in" in
  the warning colour.
- **Risk page, Market Volatility:** a read-only table of the six types (volatility, worst 12
  months, source), with types in use in bold. The editable figure is now "Volatility for
  accounts without a type", with a count of untyped accounts.
- **Methodology card:** copy updated for per-type correlation.
- **Debug window:** each account's resolved type, volatility and loading.

**Bond volatility** is removed from the Risk form. No calculation used it, and Conservative
and Balanced carry their own figures. The field stays on `MarketAssumptions` so stored plans
and the scenario comparison keep their shape. The debug window labels it "(unused)".

## Tests

- `random-returns.test.ts`, `generateFactorShocks`:
  - identical to `generateMarketShocks` with no groups;
  - ρ = 1 consumes no extra draws;
  - SA ↔ global correlation ≈ √(0.32·0.99), and each group's shock has unit variance;
  - ρ = 0 is independent of the market;
  - seeded output is reproducible;
  - zero years, clamping, and NaN loadings.
- `account-risk.test.ts`:
  - typed accounts take their type's figures;
  - untyped accounts keep the old rule, including the 0% marker;
  - an unknown value falls back to untyped.
- `sa-audit-scenarios.test.ts`:
  - the p10–p90 band is wider for Nasdaq than MSCI World, and wider for MSCI World than Balanced;
  - the global setting no longer moves a typed account;
  - splitting one type across accounts changes nothing;
  - SA + global diversifies where global + global does not;
  - a cash-type median tracks the projection under both compounding methods;
  - untyped accounts in a mixed plan still use the global setting.
- `accounts.test.ts`: read, write, null, unknown and clone mapping.
- `plan-io.test.ts`: valid type preserved, older files import as untyped, unknown value dropped.

## Verification

- `check`, `typecheck`: 0 errors. Tests: 1,207 pass.
- Line coverage is 100% on `random-returns.ts`, `simulation-engine.ts`, `account-risk.ts`,
  `accounts.ts` and `plan-io.ts`.
- Production build OK; shadscan 93/100.
- Browser check, a typed plan imported via Settings in a throwaway Playwright profile:
  - Accounts shows the type labels and the untyped prompt;
  - editing the untyped account shows "Choose an investment type";
  - a new account saves as Balanced;
  - Risk renders the table and the untyped-account warning.
