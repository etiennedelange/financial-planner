# Phase 5: Export Functionality ✅ COMPLETE

**Goal:** Generate downloadable reports and data exports.

**Tasks:**
- [x] PDF report generation (projection summary) — `/print` route, browser "Save as PDF"
- [x] CSV data export (year-by-year projections) — `lib/utils/export-csv.ts`
- [x] Print-friendly view — `app/print/print-client.tsx` with `@media print` CSS
- [x] Shareable scenario links — base64 URL token, `?share=<token>` loads plan on arrival

## Implementation

### CSV Export (`lib/utils/export-csv.ts`)
- `exportProjectionCsv(yearlyProjections)` → downloads CSV
- Columns: Year, Age, Starting/Ending Balance, Contributions, Growth, Fees, Withdrawals, Income Tax, Lump Sum Tax, Medical Aid, Net Income, Inflation-Adj Withdrawal
- Triggered from Plan dropdown → "Export CSV" and Quick Actions card

### Print / PDF (`app/print/`)
- Dedicated `/print` route — opens in new tab
- `PrintClient` reads plan from Zustand (localStorage hydration — same browser session)
- If a `?share=` token is present, decodes it instead of reading localStorage
- Recalculates projection client-side using `calculateProjection`
- Auto-triggers `window.print()` after 600ms (user can "Save as PDF" in browser dialog)
- Layout: header + key metrics grid + accounts table + assumptions table + accumulation summary (every 5 years) + full drawdown table
- `@media print` CSS: A4 page size, print-color-adjust, no browser chrome, hidden print button

### Share Link (`lib/utils/share-link.ts`)
- `buildShareUrl(plan)` → base64-encodes `{ personalInfo, retirementGoals, assumptions, drawdownConfig, displayMode, accounts }` into `?share=<token>`
- `copyShareUrl(plan)` → copies to clipboard
- `decodeShareToken(token)` → parses back to plan shape
- On `/calculator` load, `?share=` is decoded, `loadPlan()` called, then param stripped from URL via `history.replaceState`
- Works without auth — pure client-side state serialisation

### UI Changes
- **Plan dropdown** (header Settings button): added "Print / Save PDF", "Export CSV", "Copy Share Link" above existing Export/Import Plan
- **Quick Actions card**: replaced single "Export Report" with "Print / Save PDF", "Export CSV", "Copy Share Link" buttons
- **Share button**: shows "Link Copied!" for 2s after copying
- `app/calculator/page.tsx` wrapped in `<Suspense>` (required by `useSearchParams` in CalculatorClient)

## Post-Completion Fixes (2026-05-10)

- **Print page — percentage fields**: all rate fields (expectedReturn, annualFees, etc.) were being multiplied by ×100 again. All are stored as raw percentages (e.g. 10 for 10%) — fixed to display directly.
- **Print page — averageEffectiveTaxRate**: stored as percentage (e.g. 36.2), was showing 3620%. Fixed `pct()` helper.
- **Print page — inflationRate for deflation**: was passed as 5.5 instead of 0.055 to `formatCurrency`, causing over-deflation. Fixed: `assumptions.inflationRate / 100`.
- **Medical aid escalation**: `monthlyMedicalAid` was a fixed nominal amount each year. Now escalated with inflation from today's value. Label updated to "R/month, today's value".
- **Lump Sum slider**: added actual Rand value display alongside percentage, respecting `displayMode`. `AssumptionsForm` now accepts `portfolioAtRetirement`, `yearsToRetirement`, `displayMode`, `inflationRate` props.
- **Tests**: 27 new tests (export-csv: 9, share-link: 14, medical aid escalation: 4). Total: 443.
