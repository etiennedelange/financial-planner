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
npm run build            # production build + type check
npm run lint
npm run test             # Vitest
npm run test:coverage    # must stay >90% on calculation files
npm run test:watch
```

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
- Check Debug Window (`components/debug/debug-window.tsx`) — correct compounding method + consistent values across tabs

**Test structure** (see `projection.test.ts` as reference):
```typescript
describe('functionName', () => {
  describe('Critical SA scenarios', () => { /* TFSA at limit, old pension fund */ })
  describe('Compounding methods', () => { /* nominal vs compound */ })
  describe('Edge cases', () => { /* zero years, zero balance, zero contributions */ })
})
```

## Key Calculation Files

- `lib/calculations/utils/projection.ts` — **single source of truth** for `projectFinalSavings`
- `lib/calculations/projection-engine.ts` — deterministic projection
- `lib/monte-carlo/simulation-engine.ts` — Monte Carlo
- All calculations must respect `assumptions.compoundingMethod`

## Common Pitfalls

- ❌ Don't duplicate `projectFinalSavings` — import from shared utility
- ❌ Don't hardcode `monthlyReturn = annualReturn / 12` — use compounding method
- ❌ Don't omit `assumptions` from useMemo deps
- ❌ Don't use local formatCurrency — import from `lib/utils/currency`
- ❌ Don't hardcode colors (`bg-blue-500`) — use semantic tokens (`bg-primary`, `text-foreground`)

## Theming

Dual-theming (color themes + dark mode). Full details: `docs/THEMING.md`.

## Phase Docs (update after every meaningful change)

1. `docs/project-phases/` — mark tasks complete, update pending list
2. `docs/project-phases.md` — add dated entry to "Current Status Summary", update status emoji
3. `history/` — date-prefixed markdown for significant calculation/architecture changes
