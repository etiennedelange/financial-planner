# Phase 8: Expense Tracker ✅ Complete

_Implemented 2026-06-07 on `feature/redesign` branch. Replaces the Uitgawes.xlsx spreadsheet._

## Goal

Built-in monthly expense tracker: record real current spending, mark which expenses continue into retirement, and auto-drive the "Desired Monthly Income" retirement goal from actual data.

## Tasks

- [x] New types — `types/expenses.ts`: `ExpenseGroup`, `Expense` (replaces `ExpenseCategory` enum + `excluded` boolean)
- [x] Supabase migration — `supabase/migrations/20260607000000_create_expense_tables.sql`
- [x] Supabase helpers — `lib/supabase/expenses.ts`: `fetchExpenseGroups`, `fetchExpenses`, `upsertGroup`, `upsertExpense`, `deleteGroup`, `deleteExpense`, `seedExpenses`
- [x] Expenses store — `lib/store/expenses-store.ts`: Zustand store with debounced Supabase sync, offline seed, per-entity sync timers
- [x] Expenses page — `components/pages/expenses-page.tsx`: collapsible groups, inline add/edit, `inRetirement` toggle per item
- [x] Wired into sidebar nav + session init sync
- [x] Supabase tests — `lib/supabase/expenses.test.ts`
- [x] Guard offline seed behind `SUPABASE_ENABLED` flag

## Data Model

```sql
expense_groups (id, session_id, name, color, sort_order)
expenses       (id, session_id, group_id, name, amount, in_retirement, sort_order)
```

- Both tables keyed on `session_id` (= `auth.uid()`) with RLS
- `group_id` FK with `ON DELETE CASCADE` — deleting a group removes all its expenses

## Key Architecture Decision

**Expenses are global, not scenario-tied.** They reflect real current spending, not hypothetical plan variations. The `expenses-store.ts` is separate from `calculator-store.ts` and never reads from or writes to scenario state.

## Phase 9 Follow-ups (Critical)

- `expenses-store.ts` has **zero tests** — syncFromDb, debounce logic, seedExpenses path all untested
- `upsertGroup`/`upsertExpense` error cases missing from test suite (only deletes tested for errors)
- Partial-data cases (groups exist, expenses don't) untested
