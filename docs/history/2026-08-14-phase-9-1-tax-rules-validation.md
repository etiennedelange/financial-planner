# Phase 9 §9.1 (High): Tax-rule validation against SARS Budget Tax Guide 2026/2027

## What changed

The four remaining open items under Phase 9.1 (Calculation Correctness) were validated
against the SARS Budget Tax Guide 2026/2027 (the same source `tax-year.config.ts` cites) and
resolved. All four turned out to be **documentation resolutions, not code fixes** — no
calculation behaviour changed.

| Item | Verdict | Resolution |
|---|---|---|
| TFSA re-contribution room in drawdown | Rule real, **moot in this model** | Documented as not-applicable |
| Medical aid credit minimum threshold | **Premise incorrect** | Documented; no validation added |
| Dividend withholding tax | 20% rate confirmed | Documented as known simplification |
| Spending-phase multiplier sources | No SA-specific source | Documented source caveat |

## Why

### 1. TFSA re-contribution room in drawdown

The Phase 9.1 note claimed `projection-engine.ts:391-398` "withdrawals restore annual room next
tax year (SA rule) but `tfsaContributionsToDate` is never updated post-retirement".

- The line ref was stale (pre-Phase-10 split).
- The actual s12T rule restores the **lifetime** limit (R500,000), not "annual room".
- Crucially, neither engine makes any contribution after retirement — `runAccumulationPhase`
  handles the only contributions that exist, and `runDrawdownPhase` always records
  `contributions: 0`. There is therefore no contribution limit to constrain or restore in
  drawdown, and `tfsaContributionsToDate` is correctly read-only there.

Documented in `docs/FINANCIAL_LOGIC_REFERENCE.md` §1.6, with a note that a future feature
adding post-retirement contributions must restore lifetime room on a one-tax-year lag.

### 2. Medical aid credit minimum threshold

The Phase 9.1 note claimed "SA requires minimum contribution level to claim s6A credit; no
validation present". The Budget Tax Guide 2026/2027 states the credit "can be used only by the
individual who paid the contributions" — a flat amount per covered person with **no floor**.
The 3×/4×-of-credit and 7.5%-of-taxable-income thresholds in the guide apply to the separate
*additional* medical expenses credit (s6B), which this app does not model.

Adding a minimum-contribution validation would have been **wrong**. Documented in
`docs/FINANCIAL_LOGIC_REFERENCE.md` §1.7 and in a JSDoc note on `calculateMedicalAidTaxCredit`
so the premise is not re-raised.

### 3. Dividend withholding tax

Budget Tax Guide 2026/2027 confirms a final **20% dividends tax** withheld at source on
dividends paid by resident companies to individuals. The engines treat every account's
`expectedReturn` as 100% capital appreciation, so no dividend stream exists to tax.

**Decision (user-approved): document as a known simplification, do not model.** Modelling it
would require a dividend-yield assumption splitting each account's total return into dividend +
capital-appreciation components — changing every projection — and would only strictly apply to
`discretionary` accounts (retirement funds and TFSAs are DWT-exempt wrappers). Documented in
`docs/FINANCIAL_LOGIC_REFERENCE.md` §3b and `lib/constants/tax-year.config.ts`.

### 4. Spending-phase multiplier sources

The 100%/80%/70% Go-Go/Slow-Go/No-Go thresholds cite Kitces' "Retirement Spending Smile"
(US research). No directly equivalent SA-specific retirement-spending panel study is publicly
cited. Documented this caveat and the medical-premium rationale (SA medical inflation 9% vs
CPI 5.5% — `SA_DEFAULTS.medicalInflation`) in `docs/FINANCIAL_LOGIC_REFERENCE.md` §12 and
`spending-phase.ts`. Multipliers kept unchanged.

## Verification

- `npm run test` — 867/867 pass (49 files)
- `npm run typecheck` — clean
- `npx eslint` on the three touched `.ts` files — clean
- `npm run test:coverage` — branch coverage 84.61% vs the 85% global threshold; **pre-existing**
  on `main` (verified by stashing this branch's changes and re-running — identical 84.61%),
  not introduced here. This branch's `.ts` diffs are comment-only.
- Config values (income tax brackets, rebates, thresholds, TFSA limits, lump-sum table, CGT
  exclusion, medical credits) all verified byte-for-byte against the Budget Tax Guide 2026/2027
  PDF; the annual checklist's stale "R36,000" TFSA reference was corrected to R46,000.

## Files touched

- `docs/FINANCIAL_LOGIC_REFERENCE.md` — §1.6 TFSA, §1.7 medical aid, §3b DWT, §12 spending
  phase, §16 rules 19–22, §17 checklist fix
- `lib/constants/tax-year.config.ts` — comment-only (DWT note)
- `lib/calculations/retirement-tax.ts` — comment-only (s6A no-minimum note)
- `lib/calculations/utils/spending-phase.ts` — comment-only (source caveat)
- `docs/project-phases/phase-9-site-improvement.md` — four checkboxes flipped
