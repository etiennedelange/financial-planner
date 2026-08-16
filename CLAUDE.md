# CLAUDE.md

## ⚠️ Critical Rules

1. **ALL calculation code changes MUST include unit tests. No exceptions.**
2. **After every meaningful change, update phase docs without being asked.**

---

## Project

SA retirement planning calculator — Monte Carlo simulations, multi-account portfolio, SA tax treatment. Stack: Next.js, TypeScript, shadcn/ui, Supabase.

## Dev Commands

```bash
npm run dev              # port 3000
npm run build            # production build
npm run typecheck        # tsc --noEmit — REQUIRED: next build does NOT typecheck test files
npm run lint
npm run test             # Vitest
npm run test:coverage    # must stay >90% on calculation files
npm run test:watch
npm run shadscan         # shadcn UI-fundamentals audit (human output)
npm run shadscan:json    # same audit, machine-readable JSON
npm run shadscan:gate    # audit with --fail-under 90 (exits non-zero on regression)
```

## shadscan audit (run regularly)

`@shadscan/cli@0.16.0` is a pinned devDependency — `pnpm install` restores it on
container reload, so the audit works offline and can never drift versions.

**Run `npm run shadscan` before committing** (or `shadscan:gate` for a
hard-fail at <90/100). Baseline: 98/100 (A). Known non-passing finding, all
deliberate and documented in
[docs/history/2026-08-16-shadscan-accessibility-audit.md](docs/history/2026-08-16-shadscan-accessibility-audit.md):
- `mobile-nav-present` — waived (mobile bottom tab bar is the pattern).

When a new finding appears, fix it or record an explicit implement/waive
decision; never churn code just to move score-neutral advisories.

## SA Financial Defaults

- Inflation: 5.5% p.a. | Equity: 10-12% | Bonds: 7-9% | Equity vol: 15-18%
- Safe withdrawal: 3-5% | Life expectancy: 90 years
- Tax limits: `lib/constants/tax-year.config.ts` (single source of truth)

## Account Types

Pension Funds, Retirement Annuities (RAs), Preservation Funds, TFSA, Discretionary

## Testing Requirements

**When adding/modifying calculation code:**
1. Write tests first (or alongside)
2. Add to corresponding `.test.ts` (create if missing) — e.g. `projection.ts` → `projection.test.ts`
3. Cover edge cases: R0 contributions, 0% escalation, zero balance, negative years
4. Test both compounding methods: nominal and compound
5. Verify against Excel FV or manual calculations

**Before committing:**
- `npm run test` — all pass
- `npm run test:coverage` — >90% on modified files
- `npm run build` — no TS errors
- `npm run typecheck` — no TS errors. `next build` skips test files, so 44 errors once
  accumulated there unnoticed; test fixtures had drifted from the real types and were
  exercising shapes that could not occur in production
- `npm run shadscan` — audit stays ≥90/100 (or `shadscan:gate` for the hard fail)
- Check Debug Window (`components/debug/debug-window.tsx`) — correct compounding method + consistent values across tabs

**Test structure** (see `projection.test.ts` as reference):
```typescript
describe('functionName', () => {
  describe('Critical SA scenarios', () => { /* TFSA at limit, old pension fund */ })
  describe('Compounding methods', () => { /* nominal vs compound */ })
  describe('Edge cases', () => { /* zero years, zero balance, zero contributions */ })
})
```

## App Structure (post-redesign)

- Layout: fixed left sidebar (220px) + sticky top bar + scrollable page content area
- Routes: `app/calculator/{overview,plan,projections,settings,accounts,expenses}/page.tsx`
- `lib/store/calculator-store.ts` — scenario state (per-scenario)
- `lib/store/expenses-store.ts` — **global** (not scenario-tied); reflects real current spending

## Key Calculation Files

- `lib/calculations/utils/projection.ts` — **single source of truth** for `projectFinalSavings`
- `lib/calculations/projection-engine.ts` — deterministic projection
- `lib/monte-carlo/simulation-engine.ts` — Monte Carlo
- All calculations must respect `assumptions.compoundingMethod`

## UI Components

### Section labels & cards — canonical pattern

Every new card section must use these two components (never write the raw Tailwind string inline):

- **`components/ui/page-card.tsx`** — `<PageCard>` wraps a `Card` + `CardContent` with a built-in `SectionLabel` header. Use for all standard section cards.
- **`components/ui/section-label.tsx`** — `<SectionLabel>` for standalone labels (e.g. inside chart cards that need a custom CardContent structure).

```tsx
// Standard section card
<PageCard label="Personal Information" contentClassName="space-y-4">
  ...
</PageCard>

// With icon + tooltip
<PageCard label="Optimal Contribution" leading={<Target className="h-4 w-4 text-primary" />} trailing={<InfoTooltip ... />} contentClassName="space-y-3">
  ...
</PageCard>

// Danger zone (red accent)
<PageCard label="Danger Zone" labelVariant="destructive" className="border-destructive/40" contentClassName="space-y-3">
  ...
</PageCard>

// Chart cards (keep dual CardContent structure — use SectionLabel directly)
<Card className="dashboard-card shadow-none">
  <div className="px-6 pt-6 pb-3 space-y-1">
    <SectionLabel>Portfolio Growth Over Time</SectionLabel>
    <p className="text-sm text-muted-foreground pl-3">Description</p>
  </div>
  <CardContent className="...custom chart padding...">
    {chart}
  </CardContent>
</Card>
```

Design rules:
- `shadow-none` on all cards (PageCard applies it automatically; add it manually to chart Cards)
- Default label variant is a plain muted mono label (`text-muted-foreground`, no border) — teal is reserved for primary actions, not section headers
- Danger zone: `border-l-2 border-destructive` via `labelVariant="destructive"` (the only variant that renders a border)
- `dashboard-card` utility class has `shadow-sm` baked in — always pair with `shadow-none`

## Common Pitfalls

- ❌ **Never copy calculation logic — export it.** Any engine internal needed by a second
  caller must be exported from `lib/calculations/utils/`, never duplicated. This has now
  bitten twice: `projectFinalSavings` (3 copies, Phase 1.5) and `calculateInitialWithdrawal`
  (3 copies, Phase 10 — the deterministic engine and Monte Carlo silently modelled
  different plans). If a private function is tempting to copy, that is the signal to export it.
- ❌ Don't let debug/UI components own calculation logic — they must call the same shared
  function the engine calls, so they cannot drift out of step with it
- ❌ Don't express a genuine behavioural difference between callers as an *omitted optional
  parameter* — make it a required, named argument (see `WithdrawalBaseline`), so the
  difference is visible at every call site
- ❌ Don't hardcode `monthlyReturn = annualReturn / 12` — use compounding method
- ❌ Don't omit `assumptions` from useMemo deps
- ❌ Don't use local formatCurrency — import from `lib/utils/currency`
- ❌ Don't hardcode colors (`bg-blue-500`) — use semantic tokens (`bg-primary`, `text-foreground`)
- ❌ Don't tie expenses to a scenario — `expenses-store.ts` is intentionally global
- ❌ Don't write raw `<p className="text-[10px] font-mono uppercase...">` — use `<SectionLabel>` or `<PageCard>`
- ❌ Don't use `Card + CardHeader + CardTitle` for section cards — `CardTitle` renders `text-2xl font-semibold` which violates the design system
- ⚠️ `calculator-store.ts` / `expenses-store.ts` branch coverage is ~72-76%, below the 85%
  threshold (they DO have tests — 52 of them; the old "zero tests" note here was stale)

## Theming

Locked teal accent + light/dark mode (no color-theme switching). Full details: `docs/THEMING.md`.

## Documentation Rules

**Meaningful change** = calculation/architecture/security change, completed phase task, or bug fix touching >2 files. Typos, copy, and comment-only changes are exempt.

After a meaningful change, update all three tiers — detail lives in exactly ONE place:

1. `docs/history/YYYY-MM-DD-<slug>.md` — the ONLY full write-up: what changed, why, verification
2. `docs/project-phases/<phase>.md` — flip checkboxes, update pending list, link to the history file; don't repeat its content
3. `docs/project-phases.md` — one-line Recent Activity entry (date + title + history link); keep the latest 10, drop the oldest. Status emoji only when a phase's status actually changes

Full conventions: `docs/README.md`

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
