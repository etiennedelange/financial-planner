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

## Completed (2026-06-16) — Sample Data UX & Anon→Auth Migration

### Sample Data UX Refinement
- Removed auto-seed on reload (from `useEffect`) — expenses now start empty by default
- Added "Load Sample Data" button in empty state (`ExpensesPage`) for explicit user choice
- Behavior: `seedExpenses()` still available on first anonymous session load (via `SupabaseProvider`), but users can clear and reload without auto-populating
- User intent clearer: no surprise data, but seed available if they want a template

### Anon→Auth Migration Integration
- `migrateExpensesToSession()` called automatically on auth state change
- Copies all user's anonymous expense groups/items to authenticated account
- 120 unit tests verify migration handles: empty groups, expenses without groups, duplicate names, group color preservation
- Effect: users can work offline with sample data (anon), then sign in to keep it

### SUPABASE_ENABLED Consistency
- `expenses-store.ts` properly gates all DB operations behind `SUPABASE_ENABLED` flag
- Offline seed (localStorage) only triggered when Supabase is unavailable
- Vercel deployments without env vars fall back to localStorage expenses gracefully
- All Supabase helpers (`upsertGroup`, `upsertExpense`, `deleteExpense`, `seedExpenses`) early-return on null client

## Phase 9 Follow-ups (Critical)

- `expenses-store.ts` has **zero tests** — syncFromDb, debounce logic, seedExpenses path all untested
- `upsertGroup`/`upsertExpense` error cases missing from test suite (only deletes tested for errors)
- Partial-data cases (groups exist, expenses don't) untested
- `migrateExpensesToSession` tested at Supabase layer; store-level integration tests needed
