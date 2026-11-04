---
type: History Entry
title: "2026-10-31 — SA retirement calculation audit: tax relief setting, living annuity band, monthly drawdown, MC correlation"
description: "Full audit of the projection and Monte Carlo engines against SA rules (SARS 2026/27, living annuity 2.5–17.5%); 7 confirmed defects fixed with tests; future tax relief set from 2016/17–2026/27 history with a no-relief stress test; sources and open limitations."
date: 2026-10-31
tags: [calculations, tax, monte-carlo, audit]
---

# 2026-10-31 — SA retirement calculation audit

Scope: every calculation under `lib/calculations/`, `lib/monte-carlo/` and `lib/constants/`,
traced input → output, plus the SA statutory figures they depend on. UI copy was changed
only where it described the old mechanics. Branch: `fix/sa-retirement-calc-audit`.

## Summary

The statutory figures were correct. Every 2026/27 value in `tax-year.config.ts` matched SARS
on 2026-10-31. The accumulation maths was also correct: `projectFinalSavings` and the engine's
accumulation phase reproduce Excel FV and closed-form annuity values to the cent.

The defects were in **how the engines applied those figures over time** and in the
**drawdown phase**. Each was reproduced with a probe before it was fixed:

| # | Defect | Measured effect | Severity |
|---|--------|-----------------|----------|
| 1 | 2026/27 tax tables applied unindexed to nominal income 30–55 years out | R288k/yr (today's money) at age 89 taxed at **41.0%** instead of **8.5%** with full relief. Mid-career fixed-amount golden lifetime tax: R20.7M frozen → R13.2M historical (default) → R4.9M full | High |
| 2 | s11F R430k cap frozen in nominal terms while income was escalated | An R120k/yr RA contribution "exceeded" the cap within 30 years, creating a fake excess credit that made early annuity income tax-free | High |
| 3 | Living annuity 2.5%–17.5% drawdown band not enforced | Pension money could be left untouched for years (no compulsory income) or drawn faster than the law allows | High (compliance) |
| 4 | Monte Carlo accounts drew independent (uncorrelated) returns | Same money in 1 vs 3 identical accounts: success rate **90.3% vs 99.3%** | High |
| 5 | Drawdown ignored `compoundingMethod` and withdrew the year's income in one lump at year-end | `nominal` 12%: 12.68% effective before retirement, 12.00% after; income spent in February still earned a full year's return | Medium |
| 6 | TFSA limits tracked per account (deterministic) and not at all (Monte Carlo) | Two TFSAs at R4k/month admitted R92k/yr against a R46k per-person limit; MC TFSA balance R2.05M vs deterministic R809k after 10 years | Medium |
| 7 | `calculateOptimalContribution` had a fixed R100k/month search ceiling | Any goal needing more, or with no years left, returned **R0**, and the insights panel said "You're on track!" | Medium (user-facing) |

Two smaller inconsistencies were fixed along the way:

- Monte Carlo recorded depletion one year later than the projection: it only noticed at the
  start of the next year.
- Percentage strategies measured year 0 on the start-of-year balance but later years on the
  post-growth balance.

## What changed

### 1–2. Tax thresholds indexed from history, with a setting (`utils/tax-relief.ts`)

**Assumption, not statute.** SARS publishes one year's tables; how they move afterwards
is unknowable. Every rand threshold is scaled by `s = (1 + g)^yearsFromNow`. Because each
table is piecewise-linear and every threshold in it scales by the same factor, tax under the
scaled table is exactly:

    tax_t(x) = s × tax_2026/27(x / s)

`calculateIndexedIncomeTax`, `calculateLumpSumCommutation(…, thresholdScale)` and
`calculateExcessContributionCredit(…, thresholdScale)` implement this; the scale is a
**required** argument (CLAUDE.md: no behavioural difference hidden behind an optional
parameter).

The growth rate `g` per threshold group comes from the new **Future Tax Relief** assumption
(`MarketAssumptions.taxThresholdRelief`, on the Plan page and in Settings):

| Setting | Brackets, rebates, s6A credits | Lump-sum table | s11F cap | CGT exclusion |
|---|---|---|---|---|
| `historical` (default) | 0.57 × inflation (3.1% at 5.5%) | 0.20 × inflation (1.1%) | 0.43 × inflation (2.3%) | 0.46 × inflation (2.5%) |
| `full` | inflation | inflation | inflation | inflation |
| `none` (stress test) | 0 | 0 | 0 | 0 |

**How the historical shares were decided.** I compared each threshold's annual growth with
CPI over the same decade, 2016/17 → 2026/27:

| Threshold | 2016/17 | 2026/27 | Growth p.a. | Share of CPI (4.87% p.a.) |
|---|---|---|---|---|
| Primary rebate | R13,500 | R17,820 | 2.82% | 0.58 |
| 18% bracket ceiling | R188,000 | R245,100 | 2.69% | 0.55 |
| s6A main-member credit | R286 | R376 | 2.77% | 0.57 |
| Lump-sum 0% band | R500,000 | R550,000 | 0.96% | 0.20 |
| s11F cap | R350,000 | R430,000 | 2.08% | 0.43 |
| CGT annual exclusion | R40,000 | R50,000 | 2.26% | 0.46 |

The income-tax share is the mean of the first three, which moved together. The window is the
last decade because the s11F cap only exists in its current form from 2016/17, and recent
fiscal policy (no bracket relief in 2019/20, 2024/25 or 2025/26) is the better guide.
Shares are applied to the **plan's** inflation, not to historical CPI, because relief responds
to inflation. The raw figures live in `lib/constants/tax-relief-history.ts` and the shares are
computed from them in code, so a yearly refresh is a data edit.

A plan saved before this change has no setting stored; `resolveTaxThresholdIndexation`
treats that as `historical`.

**Shown to the user.** `describeTaxReliefAssumption` produces one caveat, built from the
computed numbers. It appears under the setting, in the breakdown's Lifetime Tax Summary, and
in the printable report (which also lists the setting). Every variant ends: "Treasury sets
relief in each Budget, so future tax cannot be known and will differ."

TFSA limits are **not** indexed under any setting. The lifetime limit has been R500,000
since 2015, so holding both limits nominal is the conservative choice.

### 3, 5. Shared drawdown year (`utils/drawdown-year.ts: runDrawdownYear`)

Previously the sequencing loop was copied into both engines. It now lives in one module,
the CLAUDE.md "never copy calculation logic" rule. Per year:

1. Each pot's monthly rate `i` comes from `calculateMonthlyReturn`, so it respects
   `compoundingMethod`.
2. Income is paid in 12 equal month-end instalments: `end = B·(1+i)^12 − W·a`, where
   `a = ((1+i)^12 − 1)/(12i)` (year-end value of R1/12 a month; `a = 1` at `i = 0`).
   The most a pot can pay in a year is `B·(1+i)^12 / a`.
3. Order: **2.5% minimum from each living annuity → TFSA → discretionary → more annuity
   income up to 17.5%** of each annuity's start-of-year value. The band applies per annuity.
   If the 2.5% minimum alone exceeds the target, the excess is income received, not reinvested.
4. CGT gain share is measured on the start-of-year value; a fully drained discretionary pot
   uses its whole remaining cost base.
5. `shortfall` = the pots could not pay the full target: they are empty, or the remaining
   money is in an annuity at its 17.5% ceiling.

Consequences:

- `portfolioDepletionAge` (deterministic) and `depletionAge` (MC) are both "the first year
  the income could not be paid in full". This fixes MC's one-year lag.
- MC `success` = `depletionAge === null`. A capped annuity keeps a residual balance, so
  "balance > 0" no longer means success.
- `selectShortfallAmount(rawGap, portfolioDepletionAge)` now keys off depletion age rather
  than surplus, for the same reason. The settled "shortfall = ran out before death" rule is
  unchanged.
- `calculateNextWithdrawal` takes the **start-of-year** balance in both engines: the
  anniversary value a living annuity's rate is set on, and the basis year 0 already used.
- The summary card says "Income falls short (17.5% annuity limit)" when depletion occurs with
  a positive balance.

### 4. Correlated Monte Carlo (`random-returns.ts`)

`generateMarketShocks` draws one standard normal per year per run, and every account derives
its returns from it via `returnsFromShocks`. That is perfect correlation, which matches the
existing assumption that every account carries the same equity volatility. Splitting money
across identical accounts now gives an identical success rate. A test pins this.
`generateReturnSequence` keeps its seeded output exactly.

### 6. TFSA allowance per person (`utils/tfsa-allowance.ts`)

A single allowance is shared by all TFSA accounts in both engines. Its lifetime usage is
seeded from the sum of `tfsaContributionsToDate`. At zero volatility Monte Carlo now
reproduces the projection's yearly balances exactly (cross-engine test, both compounding
methods).

### 7. Optimal contribution (`optimal-contribution.ts`)

The search ceiling now doubles until a contribution reaches the target, up to
`MAX_MONETARY_AMOUNT`. The result gains `isAchievable`. The insights panel shows "Not
reachable" with a warning instead of R0 / "on track".

### Smaller changes

- Medical aid escalation uses `escalate` (money-time rule) instead of a hand-rolled `Math.pow`.
- `LIVING_ANNUITY_DRAWDOWN_BAND_CONFIG` added to `tax-year.config.ts`; exposed as
  `SA_TAX_LIMITS.livingAnnuityMin/MaxDrawdownRate`.
- `PENSION_TYPES` now has a single definition (`drawdown-year.ts`, `isPensionType`).
- Copy: desired income tooltip states it is **before tax**; the breakdown explains the
  withdrawal order, monthly payment and indexed brackets.

### Debug window year-1 tax (found while comparing with production)

The debug window computed its "Year 1" tax itself via `calculateRetirementTax` on the whole
gross withdrawal. It used the unindexed table, no account mix, no s11F credit and
`monthlyMedicalAid: 0`. Its year-1 tax and net income therefore never matched the engine,
and the mismatch became obvious once tables were indexed (the same figure showed in both
versions). It now reads withdrawals, taxable income, tax, net income and the s11F credit from
the engine's first drawdown row. Rebate and threshold are shown indexed to the retirement
year. On the plan below the old window reported R561,311 tax and R94,034/month net; the
engine's figures are R0 (fully covered by a R1.54M s11F credit) and R107,912/month.

## Effect on a real plan: why Monte Carlo moved 91.9% → 70.5%

Plan: age 39 → 65 → 90, R1.1M income, R35k/month desired, fixed-amount strategy, compound
method. Accounts: RA R165k (+R5k/month, 10% escalation), pension fund R1.75M (+R15k, 5%),
TFSA R80k (+R3k, 6%). Each new behaviour was switched off cumulatively in a probe (5 seeds ×
1,000 runs):

| Step | Success | Attributed to |
|---|---|---|
| New code | 70.5% | |
| + living annuity band off | 77.7% | 17.5% ceiling: −7.2 |
| + TFSA limits off in MC | 80.2% | per-person TFSA cap (old MC ignored it): −2.5 |
| + independent accounts | 91.3% | correlation: −11.1 |
| Old code (`main`) | 91.9% | monthly timing and other changes: −0.6 |

All 1,474 failed runs (of 5,000) still held money at 90. Every one failed because the needed
income exceeded 17.5% of the annuity, not because the money ran out; 21% first fell short at
85 or later. Deterministic surplus fell R333M → R301M from monthly timing and from the 2.5%
minimum: late in retirement it forces out more income than the plan needs (R6.65M against a
smaller target at 89), and the model spends that excess rather than reinvesting it (see
Limitations).

## Verified clean (no change needed)

- `projectFinalSavings` / accumulation phase: matches Excel FV(1%, 360, −1000) =
  R3,494,964.13; lump-sum FV, annuity FV under both methods, the closed-form escalating
  annuity, and 0% / −5% returns.
- Bracket base-tax cumulative amounts, thresholds (= rebate / 18%), lump-sum table
  cumulative amounts: all internally consistent and matching SARS.
- Fees: net return = expected − TER (arithmetic). Exact would be `(1+r)(1−f) − 1`, a
  difference of r·f ≈ 0.1% p.a. at 10%/1%. Kept: it is the SA EAC disclosure convention.
- Smooth contribution escalation `(1+g)^(year + month/12)`: a documented design choice (§5 of
  the logic reference). Versus a once-a-year step increase it pays about `(1+g)^(5.5/12)`
  ≈ 2.7% more in contributions at g = 6%. Flagged, not changed.

## Verification

- `npm run test`: all pass (see final count in the phase doc). New: `drawdown-year.test.ts`,
  `tfsa-allowance.test.ts`, `tax-relief.test.ts`, `sa-audit-scenarios.test.ts`, indexation
  block in `retirement-tax.test.ts`, shock tests in `random-returns.test.ts`.
- The tax-relief setting changes only tax and net-income fields in the golden projection
  (233 rows); balances, depletion ages and all Monte Carlo outputs are unchanged.
- Every rewritten expectation in existing tests was recomputed by hand or by an independent
  month-by-month loop, with the derivation in a comment. Examples:
  - s11F credit = 7 × R600k − R430k × (1.055⁷ − 1)/0.055 = R645,276.
  - Indexed first-year tax = (18% × R181,033 − R27,585) × 1.055³⁰ ≈ R24,915; the engine gives R24,924.
- Golden files regenerated after reviewing the diff. `portfolioAtRetirement` is unchanged in
  all 96 projection scenarios, so accumulation is untouched. Drawdown deltas are explained by
  fixes 1–5, e.g.:
  - near-retirement fixed-amount depletion 69 → 67, because the 17.5% ceiling binds.
  - zero-inflation lifetime tax R0 → R1.26M, from the compulsory 2.5% annuity income.
  - MC mid-career success 61.5% → 49.5%, from correlation, the ceiling and monthly timing.
- `npm run typecheck`, `npm run check` (0 errors; warnings are pre-existing),
  production build (with placeholder Supabase env), `shadscan:gate` 93/100.
- Coverage: every modified calculation file is at 100% lines. The global function/branch
  thresholds fail on `main` too (89.15% / 81.83%); this branch is 89.70% / 81.84%.
- Not done: no visual check of the changed UI copy in a browser.

## Sources (verified 2026-10-31)

| Rule | Source |
|------|--------|
| 2026/27 brackets, rebates, thresholds | [SARS — Rates of tax for individuals](https://www.sars.gov.za/tax-rates/income-tax/rates-of-tax-for-individuals/) (updated 28/10/2026) |
| Retirement & withdrawal lump-sum tables ("No changes") | [SARS — Retirement lump sum benefits](https://www.sars.gov.za/tax-rates/income-tax/retirement-lump-sum-benefits/) (updated 26/02/2026) |
| s6A credits R376 / R376 / R254 | [SARS — Medical tax credit rates](https://www.sars.gov.za/tax-rates/medical-tax-credit-rates/) (updated 25/02/2026) |
| s11F 27.5% / R430k; TFSA R46k / R500k (aggregate across TFSAs); CGT exclusion R50k, death R440k; interest exemption R23,800 / R34,500; two-pot savings withdrawals at marginal rates; de minimis R360k; living annuity commutation R150k; 3.4% bracket relief | [SARS — Budget 2026 FAQ](https://www.sars.gov.za/about/sars-tax-and-customs-system/budget/budget-2026-frequently-asked-questions/) (updated 12/08/2026) |
| CGT inclusion rate 40% (natural persons) | [SARS — Inclusion rate](https://www.sars.gov.za/types-of-tax/capital-gains-tax/proceeds/calculation-of-taxable-capital-gains-and-assessed-capital-losses/inclusion-rate/) |
| Living annuity 2.5%–17.5%, set annually; 2020 relief expired | [ASISA media release](https://www.asisa.org.za/media-releases/archived-media-releases/use-temporary-living-annuity-drawdown-flexibility-wisely-cautions-asisa/); [Moonstone](https://www.moonstone.co.za/temporary-living-annuity-drawdown-flexibility-industrys-responses/) |
| Threshold history 2016/17–2024/25 | [SARS — Archive tax rates](https://www.sars.gov.za/tax-rates/archive-tax-rates/) |
| CPI 2016–2025 | Stats SA annual averages 2023–2025 (via search results); 2016–2022 from [inflation-rates.com](https://inflation-rates.com/za/). Stats SA's CPI history PDF returns HTTP 403 to automated fetches, so this series is **secondary**; a second aggregator ([inflationtool.com](https://www.inflationtool.com/rates/south-africa)) moves the decade average by 0.04 points |
| De minimis implementation (17 April 2026) | [Moonstone — retirement threshold changes in effect](https://www.moonstone.co.za/budgets-retirement-threshold-changes-in-effect-despite-legislative-omission/) |

The [Budget Tax Guide PDF](https://www.sars.gov.za/wp-content/uploads/Docs/Budget/Budget2026/Budget-tax-guide-2026-web-version.pdf)
cited in `tax-year.config.ts` is image-only (JPEG pages), so its text could not be read here.
The SARS rates pages above carry the same figures. The primary text of the living annuity
regulation was not retrieved; the band is sourced from ASISA (the industry body) and is
**flagged as not verified against the regulation itself**.

## Limitations still open (statute vs modelling)

Statutory rules the engines do **not** model:

- **De minimis commutation.** A retirement interest ≤ R360,000 (raised from R247,500, Budget
  2026) may be taken fully in cash, and a living annuity below R150,000 may be commuted. The
  engines always cap commutation at one-third, which is conservative.
- **Two-pot system** (from 1 Sept 2024). Savings-pot withdrawals before retirement (taxed at
  marginal rates, minimum R2,000, once per tax year) are not modelled. The one-third cap
  approximates the savings-pot cash-out at retirement. Vested-pot rules are not distinguished.
- **Minimum access age.** RA/preservation money is generally not accessible before 55. A
  retirement age below 55 is accepted and draws from retirement funds immediately.
- **Lump-sum aggregation.** The retirement lump-sum table is cumulative across a lifetime
  (prior withdrawal/severance benefits reduce the R550k). Prior lump sums are not captured.
- **Provident funds.** There is no separate account type. Since 1 March 2021 they are taxed
  like pension funds (model them as `pension_fund`), except vested rights for members 55+
  on that date.
- **Annual tax on discretionary interest and dividends.** Not modelled, including the R23,800 /
  R34,500 interest exemption and 20% DWT (documented earlier). Only CGT on withdrawal is taxed.
- **s6B additional medical expenses credit for 65+.** Not modelled (conservative).
- **Guaranteed (life) annuities.** All annuitised money is modelled as a living annuity.
- **Surplus annuity income is not reinvested.** When the compulsory 2.5% exceeds the income
  target, the after-tax excess leaves the portfolio. A retiree would normally invest it, so
  the surplus at life expectancy is understated for well-funded plans.

Modelling assumptions that need professional judgement:

- Future tax relief (default: last decade's share of inflation per threshold). Treasury
  decides relief each Budget, so this cannot be known. The "No relief" setting is the
  stress test.
- Perfect correlation between accounts in Monte Carlo (conservative where accounts hold
  genuinely different asset classes); one volatility for every account.
- Annual log-normal returns: no fat tails, no sequence clustering, no inflation volatility.
- Spending multipliers 100/80/70% (US research, applied to every strategy).
- Desired income is gross (before tax); medical aid is deducted from net income on top.
- The current tax year is "today": once 1 March 2027 passes, `tax-year.config.ts` must be
  updated (checklist in `FINANCIAL_LOGIC_REFERENCE.md` §17) or every offset is a year out.
