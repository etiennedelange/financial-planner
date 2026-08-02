# Expense Tracker — Design Spec
Date: 2026-06-07

## Purpose

Replace the Uitgawes.xlsx spreadsheet with a built-in monthly expense tracker. Primary uses:
1. Track real current spending
2. Mark which expenses continue into retirement
3. Auto-drive the "Desired Monthly Income" retirement goal from real data

Expenses are **global** (not scenario-tied) since they reflect actual current spending, not hypothetical scenarios.

---

## Data Model

### Supabase Tables

```sql
expense_groups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name        text NOT NULL,
  color       text NOT NULL,  -- hex colour, e.g. "#7c3aed"
  sort_order  int  NOT NULL DEFAULT 0
)

expenses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  group_id       uuid NOT NULL REFERENCES expense_groups(id) ON DELETE CASCADE,
  name           text NOT NULL,
  amount         numeric(12,2) NOT NULL DEFAULT 0,
  in_retirement  boolean NOT NULL DEFAULT true,
  sort_order     int NOT NULL DEFAULT 0
)
```

### TypeScript Types (`types/expenses.ts`)

```ts
interface ExpenseGroup {
  id: string
  name: string
  color: string
  sortOrder: number
}

interface Expense {
  id: string
  groupId: string
  name: string
  amount: number
  inRetirement: boolean
  sortOrder: number
}
```

Replaces the existing `ExpenseCategory` enum and `excluded` boolean entirely.

---

## Seed Data

On first load (empty DB for session), seed the following groups and items from Uitgawes.xlsx:

| Group         | Color     | Items |
|---------------|-----------|-------|
| Housing       | #ef4444   | Verband R12 800 (not in ret), Munisipaliteit R1 550, Elektrisiteit R600 |
| Food          | #f97316   | Groceries R7 500 |
| Savings       | #10b981   | Allan Gray RA R5 000 (not in ret), TFSA R2 000 (not in ret), Discretionary savings R1 000 (not in ret) |
| Insurance     | #3b82f6   | Versekering R1 705, PPS R425, Alarm R445, Gap cover R330 |
| Subscriptions | #8b5cf6   | Netflix R229, Apple One R180, Disney+ R170, YouTube Subscriptions R160, YouTube Premium R100, PSN R249, Xbox Game Pass R0, DStv R0 |
| Utilities     | #06b6d4   | Bellbuoy R1 200, Internet R847, Selfoon R199 |
| Transport     | #f59e0b   | Petrol R800 |
| Family        | #ec4899   | Ma bydrae R1 500, Ma foon R260 |
| Software      | #6366f1   | Claude Code R400, 1Password R84, Gemini R53 |
| Health        | #14b8a6   | Pille R80, Gym R0 |
| Banking       | #94a3b8   | FNB R250 |
| Other         | #71717a   | Spending R2 000 |

Default `in_retirement` is `true` except where noted (bond, savings contributions).

---

## Store (`lib/store/expenses-store.ts`)

```ts
interface ExpensesState {
  groups: ExpenseGroup[]
  expenses: Expense[]
  // CRUD
  addGroup(name: string, color: string): void
  updateGroup(id: string, patch: Partial<ExpenseGroup>): void
  removeGroup(id: string): void
  addExpense(groupId: string, expense: Omit<Expense, 'id'>): void
  updateExpense(id: string, patch: Partial<Expense>): void
  removeExpense(id: string): void
  toggleRetirement(id: string): void
  // Sync
  syncFromDb(sessionId: string): Promise<void>
}
```

- Uses Zustand with `persist` for local state (key: `expenses-store-v2` — new key to avoid collision with existing store)
- Debounced Supabase sync on every mutation (800 ms, same pattern as `calculator-store`)
- `syncFromDb` called on session load; if DB is empty for session, writes seed data

---

## Supabase Helpers (`lib/supabase/expenses.ts`)

```ts
fetchExpenses(sessionId): Promise<{ groups, expenses }>
upsertGroup(sessionId, group): Promise<void>
deleteGroup(id): Promise<void>
upsertExpense(sessionId, expense): Promise<void>
deleteExpense(id): Promise<void>
seedExpenses(sessionId): Promise<void>   // inserts default groups + items
```

---

## Components

### `components/pages/expenses-page.tsx` (modify existing)

Layout: two-column `lg:grid-cols-[1fr_300px]`

**Left column — expense list:**
- Groups rendered as collapsible sections (group name, colour dot, group total)
- Each item row: name | `in retirement` badge (click to toggle) | amount | edit/delete (hover)
- Inline edit row (name + amount fields, Enter to save, Escape to cancel)
- "+ add expense" row at bottom of each group
- "+ New Group" button in page header opens a small inline form (name + colour picker)

**Right column — summary panel (3 cards):**
1. **Monthly Summary** — income (editable inline), total expenses, surplus, spend-as-%-of-income bar, savings rate
2. **By Group** — horizontal bar per group, sorted by amount
3. **4% Rule Target** — `lifestyleSpend × 300` where `lifestyleSpend = total − savingsGroupTotal`

### `components/layout/sidebar.tsx` (modify)

Add to `NAV_ITEMS`:
```ts
{ id: "expenses", label: "Expenses", icon: Receipt }
```

`NavPage` type updated to include `"expenses"`.

### `app/calculator/calculator-client.tsx` (modify)

Add `expenses` case to the page-switch render block, rendering `<ExpensesPage />`.

---

## Data Flow

```
User edits expense / toggles inRetirement
  → expenses-store updates (optimistic)
  → debounced upsert to Supabase (800ms)
  → retirementTotal = Σ expenses where inRetirement = true

useEffect in ExpensesPage:
  watch retirementTotal
  → call setRetirementGoals({ desiredMonthlyIncome: retirementTotal })
     from calculator-store
```

This means the "Desired Monthly Income" field in Plan → Retirement Goals is automatically driven by the expense tracker. It remains manually editable as a fallback (user can still type a number there).

---

## Migration

The existing untracked files (`types/expenses.ts`, `lib/store/expenses-store.ts`, `components/pages/expenses-page.tsx`) are the starting point. They are modified in-place rather than replaced:
- `types/expenses.ts` — rewrite (remove category enum, add new interfaces)
- `lib/store/expenses-store.ts` — rewrite (new state shape, add Supabase sync)
- `components/pages/expenses-page.tsx` — adapt (swap category grouping for group-based, swap `excluded` for `inRetirement` badge)

---

## Out of Scope

- Expense history / monthly snapshots (this is a current-state tracker, not a ledger)
- Import from Excel directly in the UI (seed data covers the initial migration)
- Expense forecasting or inflation-adjusted projections
- Per-scenario expense variations
