# 2026-05-10 — Phase 5 Export Functionality + Bug Fixes

## Phase 5: Export Functionality

### Print / PDF (`app/print/`)
- New `/print` route; opens in a new tab
- `PrintClient` reads plan from Zustand (localStorage hydration — same browser session)
- If a `?share=` token is present in the URL, decodes it instead
- Recalculates projection client-side via `calculateProjection`
- Auto-triggers `window.print()` after 600ms; user saves as PDF via browser dialog
- Layout: header + 6-metric grid + accounts table + assumptions table + accumulation summary (every 5 years) + full drawdown table
- `@media print` CSS: A4 page size, print-color-adjust, hidden print button

### CSV Export (`lib/utils/export-csv.ts`)
- `exportProjectionCsv(yearlyProjections)` → downloads CSV
- 13 columns: Year, Age, Starting/Ending Balance, Contributions, Growth, Fees, Withdrawals, Income Tax, Lump Sum Tax, Medical Aid, Net Income, Inflation-Adj Withdrawal

### Share Link (`lib/utils/share-link.ts`)
- `buildShareUrl(plan)` encodes full plan as base64 `?share=<token>`
- `decodeShareToken(token)` parses back to plan shape
- On `/calculator` arrival, `?share=` is decoded, `loadPlan()` called, param stripped via `history.replaceState`
- Works without auth — pure client-side state serialisation

### UI changes
- Plan dropdown (header): Print / Save PDF, Export CSV, Copy Share Link
- Quick Actions card: same three actions
- Share button shows "Link Copied!" for 2s
- `app/calculator/page.tsx` wrapped in `<Suspense>` for `useSearchParams`

---

## Bug Fixes

### Print page — percentage fields multiplied by 100 again
All rate fields in the app are stored as raw percentages (e.g. 10 for 10%). The print page was applying `× 100` again, producing values like 1000%, 3620%. Fixed by using `value.toFixed(1)%` directly.

Affected fields: `Account.expectedReturn`, `annualFees`, `contributionEscalation`, `MarketAssumptions.equityReturn`, `bondReturn`, `cashReturn`, `inflationRate`, `ProjectionResult.averageEffectiveTaxRate`.

### Print page — inflationRate passed as % to formatCurrency
`formatCurrency` expects `inflationRate` as a decimal (e.g. 0.055). The print page was passing the raw percentage (5.5), causing over-deflation of all real-value figures. Fixed: `assumptions.inflationRate / 100`.

### Medical aid — not inflation-escalated
`DrawdownConfig.monthlyMedicalAid` was applied as a fixed nominal amount each retirement year. It should be entered in today's Rands and escalated. Fixed in `projection-engine.ts`:

```ts
// before
const medicalAidContribution = (drawdownConfig.monthlyMedicalAid ?? 0) * 12

// after
const medicalAidContribution =
  (drawdownConfig.monthlyMedicalAid ?? 0) *
  Math.pow(1 + inflationRate, yearsToRetirement + year) *
  12
```

Label updated to "Medical Aid (R/month, today's value)" with tooltip explaining escalation.

### Lump Sum slider — no actual value shown
The slider only showed the percentage (e.g. "33%"). Now also shows the computed Rand amount respecting `displayMode` (e.g. "33% ≈ R2.4M" or the real-value equivalent). `AssumptionsForm` now accepts `portfolioAtRetirement`, `yearsToRetirement`, `displayMode`, `inflationRate` props from the parent.

---

## Tests Added
- `lib/utils/export-csv.test.ts` — 9 tests: download trigger, filename, blob type, header columns, values, row count
- `lib/utils/share-link.test.ts` — 14 tests: encode, round-trip, null/invalid cases, unit convention guards
- `lib/calculations/__tests__/projection-engine.test.ts` — 4 new medical aid tests: yearly escalation, first-year formula, zero case, net income impact
