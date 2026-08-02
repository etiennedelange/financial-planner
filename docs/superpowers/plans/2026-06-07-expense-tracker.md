# Expense Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Uitgawes.xlsx spreadsheet with a built-in monthly expense tracker that stores data in Supabase, groups expenses into user-defined groups, marks which expenses continue into retirement, and auto-drives `desiredMonthlyIncome` in the retirement calculator.

**Architecture:** Three existing untracked files (`types/expenses.ts`, `lib/store/expenses-store.ts`, `components/pages/expenses-page.tsx`) are rewritten in-place to use user-defined groups (replacing the fixed `ExpenseCategory` enum) and an `inRetirement` boolean (replacing `excluded`). A new Supabase migration creates `expense_groups` and `expenses` tables. A new `lib/supabase/expenses.ts` helper module handles all DB I/O. The Zustand store gains Supabase sync via the same 800 ms debounce pattern as `calculator-store`. The app is wired in `sidebar.tsx`, `calculator-client.tsx`, and `supabase-provider.tsx`.

**Tech Stack:** Next.js App Router, TypeScript, Zustand + persist, Supabase (PostgreSQL + RLS), shadcn/ui, Lucide icons, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/migrations/20260607000000_create_expense_tables.sql` | Create | DB schema for `expense_groups` + `expenses` |
| `types/expenses.ts` | Rewrite | `ExpenseGroup` + `Expense` interfaces |
| `lib/supabase/expenses.ts` | Create | DB helpers: fetch, upsert, delete, seed |
| `lib/supabase/expenses.test.ts` | Create | Unit tests for DB helpers |
| `lib/store/expenses-store.ts` | Rewrite | Zustand store with groups, CRUD, Supabase sync |
| `components/pages/expenses-page.tsx` | Rewrite | Page UI: grouped list, inRetirement badge, summary panel |
| `components/layout/sidebar.tsx` | Modify | Add `expenses` nav item |
| `app/calculator/calculator-client.tsx` | Modify | Render `ExpensesPage`, update `NavPage` usage |
| `components/supabase-provider.tsx` | Modify | Call `useExpensesStore.syncFromDb` on session init |

---

## Task 1: Supabase migration

**Files:**
- Create: `supabase/migrations/20260607000000_create_expense_tables.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/20260607000000_create_expense_tables.sql

create table expense_groups (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null,
  name        text not null,
  color       text not null default '#6366f1',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

create index expense_groups_session_id_idx on expense_groups (session_id);

alter table expense_groups enable row level security;

create policy "users can manage their own expense groups"
  on expense_groups for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));

create table expenses (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null,
  group_id       uuid not null references expense_groups(id) on delete cascade,
  name           text not null,
  amount         numeric(12,2) not null default 0,
  in_retirement  boolean not null default true,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index expenses_session_id_idx on expenses (session_id);
create index expenses_group_id_idx   on expenses (group_id);

alter table expenses enable row level security;

create policy "users can manage their own expenses"
  on expenses for all
  using (session_id = (select auth.uid()))
  with check (session_id = (select auth.uid()));
```

- [ ] **Step 2: Apply migration to local Supabase**

```bash
npx supabase db reset
```

Expected: migration runs without error, tables visible in Supabase Studio at http://localhost:54323.

If local Supabase isn't running:
```bash
npx supabase start
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260607000000_create_expense_tables.sql
git commit -m "feat: add expense_groups and expenses tables"
```

---

## Task 2: Rewrite types

**Files:**
- Modify: `types/expenses.ts`

- [ ] **Step 1: Replace the file contents**

```typescript
// types/expenses.ts
export interface ExpenseGroup {
  id: string
  name: string
  color: string
  sortOrder: number
}

export interface Expense {
  id: string
  groupId: string
  name: string
  amount: number
  inRetirement: boolean
  sortOrder: number
}

export const GROUP_COLOR_OPTIONS = [
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#6366f1", // indigo
  "#14b8a6", // teal
  "#94a3b8", // slate
  "#71717a", // zinc
] as const
```

- [ ] **Step 2: Verify the types export cleanly**

```bash
npm run build 2>&1 | grep -i "expenses\|error" | head -20
```

Expected: no errors referencing `types/expenses.ts`. Other errors are fine at this stage.

- [ ] **Step 3: Commit**

```bash
git add types/expenses.ts
git commit -m "feat: rewrite expense types with user-defined groups and inRetirement"
```

---

## Task 3: Supabase helpers

**Files:**
- Create: `lib/supabase/expenses.ts`

- [ ] **Step 1: Create the helper module**

```typescript
// lib/supabase/expenses.ts
import type { Expense, ExpenseGroup } from "@/types/expenses"
import { createClient } from "./client"

// ─── row shapes ───────────────────────────────────────────────────────────────

type GroupRow = {
  id: string
  session_id: string
  name: string
  color: string
  sort_order: number
}

type ExpenseRow = {
  id: string
  session_id: string
  group_id: string
  name: string
  amount: number
  in_retirement: boolean
  sort_order: number
}

function groupFromRow(row: GroupRow): ExpenseGroup {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order }
}

function expenseFromRow(row: ExpenseRow): Expense {
  return {
    id: row.id,
    groupId: row.group_id,
    name: row.name,
    amount: Number(row.amount),
    inRetirement: row.in_retirement,
    sortOrder: row.sort_order,
  }
}

// ─── fetch ────────────────────────────────────────────────────────────────────

export async function fetchExpenses(
  sessionId: string
): Promise<{ groups: ExpenseGroup[]; expenses: Expense[] }> {
  const supabase = createClient()
  if (!supabase) return { groups: [], expenses: [] }

  const [{ data: groupData, error: ge }, { data: expData, error: ee }] = await Promise.all([
    supabase.from("expense_groups").select("*").eq("session_id", sessionId).order("sort_order"),
    supabase.from("expenses").select("*").eq("session_id", sessionId).order("sort_order"),
  ])

  if (ge) throw ge
  if (ee) throw ee

  return {
    groups: (groupData ?? []).map((r) => groupFromRow(r as GroupRow)),
    expenses: (expData ?? []).map((r) => expenseFromRow(r as ExpenseRow)),
  }
}

// ─── upsert ───────────────────────────────────────────────────────────────────

export async function upsertGroup(sessionId: string, group: ExpenseGroup): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("expense_groups").upsert(
    { id: group.id, session_id: sessionId, name: group.name, color: group.color, sort_order: group.sortOrder },
    { onConflict: "id" }
  )
  if (error) throw error
}

export async function upsertExpense(sessionId: string, expense: Expense): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("expenses").upsert(
    {
      id: expense.id,
      session_id: sessionId,
      group_id: expense.groupId,
      name: expense.name,
      amount: expense.amount,
      in_retirement: expense.inRetirement,
      sort_order: expense.sortOrder,
    },
    { onConflict: "id" }
  )
  if (error) throw error
}

// ─── delete ───────────────────────────────────────────────────────────────────

export async function deleteGroup(id: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("expense_groups").delete().eq("id", id)
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.from("expenses").delete().eq("id", id)
  if (error) throw error
}

// ─── seed ─────────────────────────────────────────────────────────────────────

export async function seedExpenses(sessionId: string): Promise<{ groups: ExpenseGroup[]; expenses: Expense[] }> {
  const supabase = createClient()
  if (!supabase) return { groups: [], expenses: [] }

  const seedGroups: Omit<ExpenseGroup, "sortOrder"> & { sortOrder: number }[] = [
    { id: crypto.randomUUID(), name: "Housing",       color: "#ef4444", sortOrder: 0 },
    { id: crypto.randomUUID(), name: "Food",          color: "#f97316", sortOrder: 1 },
    { id: crypto.randomUUID(), name: "Savings",       color: "#10b981", sortOrder: 2 },
    { id: crypto.randomUUID(), name: "Insurance",     color: "#3b82f6", sortOrder: 3 },
    { id: crypto.randomUUID(), name: "Subscriptions", color: "#8b5cf6", sortOrder: 4 },
    { id: crypto.randomUUID(), name: "Utilities",     color: "#06b6d4", sortOrder: 5 },
    { id: crypto.randomUUID(), name: "Transport",     color: "#f59e0b", sortOrder: 6 },
    { id: crypto.randomUUID(), name: "Family",        color: "#ec4899", sortOrder: 7 },
    { id: crypto.randomUUID(), name: "Software",      color: "#6366f1", sortOrder: 8 },
    { id: crypto.randomUUID(), name: "Health",        color: "#14b8a6", sortOrder: 9 },
    { id: crypto.randomUUID(), name: "Banking",       color: "#94a3b8", sortOrder: 10 },
    { id: crypto.randomUUID(), name: "Other",         color: "#71717a", sortOrder: 11 },
  ]

  const g = (name: string) => seedGroups.find((g) => g.name === name)!.id

  const seedExpenses: Omit<Expense, never>[] = [
    // Housing
    { id: crypto.randomUUID(), groupId: g("Housing"),       name: "Verband",               amount: 12800, inRetirement: false, sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Housing"),       name: "Munisipaliteit",         amount: 1550,  inRetirement: true,  sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Housing"),       name: "Elektrisiteit",          amount: 600,   inRetirement: true,  sortOrder: 2 },
    // Food
    { id: crypto.randomUUID(), groupId: g("Food"),          name: "Groceries",              amount: 7500,  inRetirement: true,  sortOrder: 0 },
    // Savings
    { id: crypto.randomUUID(), groupId: g("Savings"),       name: "Allan Gray RA",          amount: 5000,  inRetirement: false, sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Savings"),       name: "TFSA",                   amount: 2000,  inRetirement: false, sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Savings"),       name: "Discretionary savings",  amount: 1000,  inRetirement: false, sortOrder: 2 },
    // Insurance
    { id: crypto.randomUUID(), groupId: g("Insurance"),     name: "Versekering",            amount: 1705,  inRetirement: true,  sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Insurance"),     name: "PPS",                    amount: 425,   inRetirement: true,  sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Insurance"),     name: "Alarm",                  amount: 445,   inRetirement: true,  sortOrder: 2 },
    { id: crypto.randomUUID(), groupId: g("Insurance"),     name: "Gap cover",              amount: 330,   inRetirement: true,  sortOrder: 3 },
    // Subscriptions
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "Netflix",                amount: 229,   inRetirement: true,  sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "Apple One",              amount: 180,   inRetirement: true,  sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "Disney+",                amount: 170,   inRetirement: true,  sortOrder: 2 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "YouTube Subscriptions",  amount: 160,   inRetirement: true,  sortOrder: 3 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "YouTube Premium",        amount: 100,   inRetirement: true,  sortOrder: 4 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "PSN",                    amount: 249,   inRetirement: true,  sortOrder: 5 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "Xbox Game Pass",         amount: 0,     inRetirement: false, sortOrder: 6 },
    { id: crypto.randomUUID(), groupId: g("Subscriptions"), name: "DStv",                   amount: 0,     inRetirement: false, sortOrder: 7 },
    // Utilities
    { id: crypto.randomUUID(), groupId: g("Utilities"),     name: "Bellbuoy",               amount: 1200,  inRetirement: true,  sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Utilities"),     name: "Internet",               amount: 847,   inRetirement: true,  sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Utilities"),     name: "Selfoon",                amount: 199,   inRetirement: true,  sortOrder: 2 },
    // Transport
    { id: crypto.randomUUID(), groupId: g("Transport"),     name: "Petrol",                 amount: 800,   inRetirement: false, sortOrder: 0 },
    // Family
    { id: crypto.randomUUID(), groupId: g("Family"),        name: "Ma bydrae",              amount: 1500,  inRetirement: false, sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Family"),        name: "Ma foon",                amount: 260,   inRetirement: false, sortOrder: 1 },
    // Software
    { id: crypto.randomUUID(), groupId: g("Software"),      name: "Claude Code",            amount: 400,   inRetirement: true,  sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Software"),      name: "1Password",              amount: 84,    inRetirement: true,  sortOrder: 1 },
    { id: crypto.randomUUID(), groupId: g("Software"),      name: "Gemini",                 amount: 53,    inRetirement: true,  sortOrder: 2 },
    // Health
    { id: crypto.randomUUID(), groupId: g("Health"),        name: "Pille",                  amount: 80,    inRetirement: true,  sortOrder: 0 },
    { id: crypto.randomUUID(), groupId: g("Health"),        name: "Gym",                    amount: 0,     inRetirement: false, sortOrder: 1 },
    // Banking
    { id: crypto.randomUUID(), groupId: g("Banking"),       name: "FNB",                    amount: 250,   inRetirement: true,  sortOrder: 0 },
    // Other
    { id: crypto.randomUUID(), groupId: g("Other"),         name: "Spending",               amount: 2000,  inRetirement: true,  sortOrder: 0 },
  ]

  const groupRows = seedGroups.map((g) => ({ ...g, sort_order: g.sortOrder, session_id: sessionId }))
  const expenseRows = seedExpenses.map((e) => ({
    id: e.id, session_id: sessionId, group_id: e.groupId,
    name: e.name, amount: e.amount, in_retirement: e.inRetirement, sort_order: e.sortOrder,
  }))

  const { error: ge } = await supabase.from("expense_groups").insert(groupRows)
  if (ge) throw ge
  const { error: ee } = await supabase.from("expenses").insert(expenseRows)
  if (ee) throw ee

  return {
    groups: seedGroups.map((g) => ({ id: g.id, name: g.name, color: g.color, sortOrder: g.sortOrder })),
    expenses: seedExpenses,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/supabase/expenses.ts
git commit -m "feat: add Supabase helpers for expense_groups and expenses"
```

---

## Task 4: Tests for Supabase helpers

**Files:**
- Create: `lib/supabase/expenses.test.ts`

- [ ] **Step 1: Create test file**

```typescript
// lib/supabase/expenses.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchExpenses, upsertGroup, upsertExpense, deleteGroup, deleteExpense } from './expenses'
import type { Expense, ExpenseGroup } from '@/types/expenses'

vi.mock('./client', () => ({ createClient: vi.fn() }))
import { createClient } from './client'

function makeChain(resolveWith: { data?: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {}
  const methods = ['from', 'select', 'insert', 'upsert', 'delete', 'eq', 'order']
  methods.forEach((m) => { chain[m] = vi.fn(() => chain) })
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve)
  return chain
}

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = makeChain({ data, error })
  vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
  return chain
}

const groupRow = { id: 'g-1', session_id: 's-1', name: 'Housing', color: '#ef4444', sort_order: 0 }
const expenseRow = { id: 'e-1', session_id: 's-1', group_id: 'g-1', name: 'Verband', amount: 12800, in_retirement: false, sort_order: 0 }

const group: ExpenseGroup = { id: 'g-1', name: 'Housing', color: '#ef4444', sortOrder: 0 }
const expense: Expense = { id: 'e-1', groupId: 'g-1', name: 'Verband', amount: 12800, inRetirement: false, sortOrder: 0 }

beforeEach(() => vi.clearAllMocks())

describe('fetchExpenses', () => {
  it('returns empty arrays when supabase is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    const result = await fetchExpenses('s-1')
    expect(result).toEqual({ groups: [], expenses: [] })
  })

  it('maps group rows to ExpenseGroup objects', async () => {
    const chain = makeChain({ data: [groupRow], error: null })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    // fetchExpenses calls Promise.all — both queries resolve via the same chain mock
    const result = await fetchExpenses('s-1')
    expect(result.groups[0]).toEqual(group)
  })

  it('maps expense rows to Expense objects', async () => {
    const chain = makeChain({ data: [expenseRow], error: null })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    const result = await fetchExpenses('s-1')
    expect(result.expenses[0]).toEqual(expense)
  })

  it('throws on DB error', async () => {
    const chain = makeChain({ data: null, error: new Error('db error') })
    vi.mocked(createClient).mockReturnValue(chain as ReturnType<typeof createClient>)
    await expect(fetchExpenses('s-1')).rejects.toThrow('db error')
  })
})

describe('upsertGroup', () => {
  it('does nothing when supabase is disabled', async () => {
    vi.mocked(createClient).mockReturnValue(null)
    await expect(upsertGroup('s-1', group)).resolves.toBeUndefined()
  })

  it('calls upsert with correct row shape', async () => {
    const chain = mockSupabase(null)
    await upsertGroup('s-1', group)
    expect(vi.mocked(chain.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      { id: 'g-1', session_id: 's-1', name: 'Housing', color: '#ef4444', sort_order: 0 },
      { onConflict: 'id' }
    )
  })
})

describe('upsertExpense', () => {
  it('calls upsert with correct row shape', async () => {
    const chain = mockSupabase(null)
    await upsertExpense('s-1', expense)
    expect(vi.mocked(chain.upsert as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      { id: 'e-1', session_id: 's-1', group_id: 'g-1', name: 'Verband', amount: 12800, in_retirement: false, sort_order: 0 },
      { onConflict: 'id' }
    )
  })
})

describe('deleteGroup', () => {
  it('calls delete with correct id', async () => {
    const chain = mockSupabase(null)
    await deleteGroup('g-1')
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'g-1')
  })
})

describe('deleteExpense', () => {
  it('calls delete with correct id', async () => {
    const chain = mockSupabase(null)
    await deleteExpense('e-1')
    expect(vi.mocked(chain.eq as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('id', 'e-1')
  })
})
```

- [ ] **Step 2: Run tests**

```bash
npm run test lib/supabase/expenses.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/expenses.test.ts
git commit -m "test: add unit tests for expense Supabase helpers"
```

---

## Task 5: Rewrite the expenses store

**Files:**
- Modify: `lib/store/expenses-store.ts`

- [ ] **Step 1: Replace the file**

```typescript
// lib/store/expenses-store.ts
"use client"

import type { Expense, ExpenseGroup } from "@/types/expenses"
import {
  fetchExpenses,
  upsertGroup,
  upsertExpense,
  deleteGroup,
  deleteExpense,
  seedExpenses,
} from "@/lib/supabase/expenses"
import { create } from "zustand"
import { persist } from "zustand/middleware"

let groupSyncTimer: ReturnType<typeof setTimeout> | null = null
let expenseSyncTimer: ReturnType<typeof setTimeout> | null = null

function scheduleGroupSync(group: ExpenseGroup, sessionId: string) {
  if (groupSyncTimer) clearTimeout(groupSyncTimer)
  groupSyncTimer = setTimeout(() => {
    upsertGroup(sessionId, group).catch(console.error)
  }, 800)
}

function scheduleExpenseSync(expense: Expense, sessionId: string) {
  if (expenseSyncTimer) clearTimeout(expenseSyncTimer)
  expenseSyncTimer = setTimeout(() => {
    upsertExpense(sessionId, expense).catch(console.error)
  }, 800)
}

interface ExpensesState {
  sessionId: string | null
  groups: ExpenseGroup[]
  expenses: Expense[]
  monthlyIncome: number

  setSessionId: (id: string) => void
  syncFromDb: (sessionId: string) => Promise<void>

  addGroup: (name: string, color: string) => void
  updateGroup: (id: string, patch: Partial<Pick<ExpenseGroup, "name" | "color">>) => void
  removeGroup: (id: string) => void

  addExpense: (groupId: string, name: string, amount: number) => void
  updateExpense: (id: string, patch: Partial<Pick<Expense, "name" | "amount" | "inRetirement">>) => void
  removeExpense: (id: string) => void
  toggleRetirement: (id: string) => void

  setMonthlyIncome: (income: number) => void
}

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set, get) => ({
      sessionId: null,
      groups: [],
      expenses: [],
      monthlyIncome: 56500,

      setSessionId: (id) => set({ sessionId: id }),

      syncFromDb: async (sessionId) => {
        set({ sessionId })
        const { groups, expenses } = await fetchExpenses(sessionId)
        if (groups.length === 0) {
          const seeded = await seedExpenses(sessionId)
          set({ groups: seeded.groups, expenses: seeded.expenses })
        } else {
          set({ groups, expenses })
        }
      },

      addGroup: (name, color) => {
        const { sessionId } = get()
        const group: ExpenseGroup = {
          id: crypto.randomUUID(),
          name,
          color,
          sortOrder: get().groups.length,
        }
        set((s) => ({ groups: [...s.groups, group] }))
        if (sessionId) scheduleGroupSync(group, sessionId)
      },

      updateGroup: (id, patch) => {
        const { sessionId } = get()
        set((s) => ({
          groups: s.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)),
        }))
        const updated = get().groups.find((g) => g.id === id)
        if (updated && sessionId) scheduleGroupSync(updated, sessionId)
      },

      removeGroup: (id) => {
        set((s) => ({
          groups: s.groups.filter((g) => g.id !== id),
          expenses: s.expenses.filter((e) => e.groupId !== id),
        }))
        deleteGroup(id).catch(console.error)
      },

      addExpense: (groupId, name, amount) => {
        const { sessionId } = get()
        const expense: Expense = {
          id: crypto.randomUUID(),
          groupId,
          name,
          amount,
          inRetirement: true,
          sortOrder: get().expenses.filter((e) => e.groupId === groupId).length,
        }
        set((s) => ({ expenses: [...s.expenses, expense] }))
        if (sessionId) scheduleExpenseSync(expense, sessionId)
      },

      updateExpense: (id, patch) => {
        const { sessionId } = get()
        set((s) => ({
          expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...patch } : e)),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && sessionId) scheduleExpenseSync(updated, sessionId)
      },

      removeExpense: (id) => {
        set((s) => ({ expenses: s.expenses.filter((e) => e.id !== id) }))
        deleteExpense(id).catch(console.error)
      },

      toggleRetirement: (id) => {
        const { sessionId } = get()
        set((s) => ({
          expenses: s.expenses.map((e) =>
            e.id === id ? { ...e, inRetirement: !e.inRetirement } : e
          ),
        }))
        const updated = get().expenses.find((e) => e.id === id)
        if (updated && sessionId) scheduleExpenseSync(updated, sessionId)
      },

      setMonthlyIncome: (income) => set({ monthlyIncome: income }),
    }),
    { name: "expenses-store-v2" }
  )
)
```

- [ ] **Step 2: Verify TypeScript**

```bash
npm run build 2>&1 | grep "expenses-store" | head -10
```

Expected: no errors from `expenses-store.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/store/expenses-store.ts
git commit -m "feat: rewrite expenses store with groups, inRetirement, and Supabase sync"
```

---

## Task 6: Rewrite the ExpensesPage component

**Files:**
- Modify: `components/pages/expenses-page.tsx`

- [ ] **Step 1: Replace the file**

```typescript
// components/pages/expenses-page.tsx
"use client"

import { useEffect, useState } from "react"
import { useShallow } from "zustand/react/shallow"
import { Check, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useExpensesStore } from "@/lib/store/expenses-store"
import { useCalculatorStore } from "@/lib/store/calculator-store"
import { formatCurrency } from "@/lib/utils/currency"
import { GROUP_COLOR_OPTIONS, type Expense, type ExpenseGroup } from "@/types/expenses"
import { cn } from "@/lib/utils"

// ─── inline edit row ──────────────────────────────────────────────────────────

function EditRow({
  expense,
  onSave,
  onCancel,
  onDelete,
}: {
  expense: Expense
  onSave: (name: string, amount: number) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const [name, setName] = useState(expense.name)
  const [amount, setAmount] = useState(String(expense.amount))

  const commit = () => {
    const parsed = parseFloat(amount.replace(/\s/g, ""))
    onSave(name.trim() || expense.name, isNaN(parsed) ? expense.amount : parsed)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-accent/60 rounded-sm border border-border">
      <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm flex-1 min-w-0" autoFocus />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm w-28 text-right font-mono" placeholder="0" />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── add expense row ──────────────────────────────────────────────────────────

function AddExpenseRow({
  onSave,
  onCancel,
}: {
  onSave: (name: string, amount: number) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("")

  const commit = () => {
    if (!name.trim()) { onCancel(); return }
    const parsed = parseFloat(amount.replace(/\s/g, ""))
    onSave(name.trim(), isNaN(parsed) ? 0 : parsed)
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") commit()
    if (e.key === "Escape") onCancel()
  }

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/5 rounded-sm border border-primary/25">
      <Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm flex-1 min-w-0" placeholder="Expense name" autoFocus />
      <Input value={amount} onChange={(e) => setAmount(e.target.value)} onKeyDown={onKey}
        className="h-7 text-sm w-28 text-right font-mono" placeholder="0" />
      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── add group row ────────────────────────────────────────────────────────────

function AddGroupRow({ onSave, onCancel }: { onSave: (name: string, color: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("")
  const [color, setColor] = useState(GROUP_COLOR_OPTIONS[8]) // indigo default

  const commit = () => {
    if (!name.trim()) { onCancel(); return }
    onSave(name.trim(), color)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-sm border border-primary/25 mb-3">
      <Input value={name} onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") onCancel() }}
        className="h-7 text-sm flex-1" placeholder="Group name" autoFocus />
      <div className="flex gap-1 flex-wrap">
        {GROUP_COLOR_OPTIONS.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className={cn("w-4 h-4 rounded-full border-2 transition-all", color === c ? "border-foreground scale-110" : "border-transparent")}
            style={{ background: c }}
          />
        ))}
      </div>
      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={commit}>
        <Check className="h-3.5 w-3.5" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onCancel}>
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}

// ─── expense group section ────────────────────────────────────────────────────

function GroupSection({
  group,
  expenses,
  editingId,
  addingToGroupId,
  onEdit,
  onUpdate,
  onRemoveExpense,
  onToggleRetirement,
  onAddExpense,
  onSetAdding,
  onRemoveGroup,
}: {
  group: ExpenseGroup
  expenses: Expense[]
  editingId: string | null
  addingToGroupId: string | null
  onEdit: (id: string | null) => void
  onUpdate: (id: string, name: string, amount: number) => void
  onRemoveExpense: (id: string) => void
  onToggleRetirement: (id: string) => void
  onAddExpense: (groupId: string, name: string, amount: number) => void
  onSetAdding: (groupId: string | null) => void
  onRemoveGroup: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const groupTotal = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="border border-border rounded-md overflow-hidden">
      {/* Group header */}
      <div
        className="group flex items-center gap-2.5 px-3 py-2.5 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setCollapsed((c) => !c)}
      >
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: group.color }} />
        <span className="flex-1 text-sm font-semibold">{group.name}</span>
        <span className="text-xs text-muted-foreground tabular-nums font-mono">{formatCurrency(groupTotal)}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveGroup(group.id) }}
          className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity ml-1"
          title="Delete group"
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </button>
        {collapsed ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {/* Group body */}
      {!collapsed && (
        <div className="divide-y divide-border/50">
          {expenses.map((expense) =>
            editingId === expense.id ? (
              <div key={expense.id} className="px-2 py-1">
                <EditRow
                  expense={expense}
                  onSave={(name, amount) => { onUpdate(expense.id, name, amount); onEdit(null) }}
                  onCancel={() => onEdit(null)}
                  onDelete={() => { onRemoveExpense(expense.id); onEdit(null) }}
                />
              </div>
            ) : (
              <div
                key={expense.id}
                className="group flex items-center gap-2 px-3 py-2 hover:bg-muted/20 transition-colors"
              >
                <span className="flex-1 text-sm truncate">{expense.name}</span>
                <button
                  onClick={() => onToggleRetirement(expense.id)}
                  className={cn(
                    "shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors",
                    expense.inRetirement
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400"
                      : "bg-muted/50 text-muted-foreground border-border"
                  )}
                >
                  {expense.inRetirement ? "in retirement" : "not in retirement"}
                </button>
                <span className="text-sm font-mono tabular-nums w-20 text-right">{formatCurrency(expense.amount)}</span>
                <button onClick={() => onEdit(expense.id)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity shrink-0">
                  <Pencil className="h-3 w-3" />
                </button>
              </div>
            )
          )}

          {/* Add expense row */}
          {addingToGroupId === group.id ? (
            <div className="px-2 py-1">
              <AddExpenseRow
                onSave={(name, amount) => { onAddExpense(group.id, name, amount); onSetAdding(null) }}
                onCancel={() => onSetAdding(null)}
              />
            </div>
          ) : (
            <button
              onClick={() => onSetAdding(group.id)}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Add expense
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── summary panel ────────────────────────────────────────────────────────────

function SummaryPanel({ monthlyIncome, groups, expenses, onSetIncome }: {
  monthlyIncome: number
  groups: ExpenseGroup[]
  expenses: Expense[]
  onSetIncome: (v: number) => void
}) {
  const [editIncome, setEditIncome] = useState(false)
  const [incomeInput, setIncomeInput] = useState(String(monthlyIncome))

  const total = expenses.reduce((s, e) => s + e.amount, 0)
  const retirementTotal = expenses.filter((e) => e.inRetirement).reduce((s, e) => s + e.amount, 0)
  const surplus = monthlyIncome - total
  const fourPctTarget = retirementTotal * 300

  const groupTotals = groups
    .map((g) => ({ group: g, total: expenses.filter((e) => e.groupId === g.id).reduce((s, e) => s + e.amount, 0) }))
    .filter((x) => x.total > 0)
    .sort((a, b) => b.total - a.total)

  const maxGroupTotal = groupTotals[0]?.total ?? 1

  const saveIncome = () => {
    const parsed = parseFloat(incomeInput.replace(/[\s,]/g, ""))
    if (!isNaN(parsed) && parsed > 0) onSetIncome(parsed)
    setEditIncome(false)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Monthly Summary</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Income</span>
            {editIncome ? (
              <div className="flex items-center gap-1">
                <Input value={incomeInput} onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") saveIncome(); if (e.key === "Escape") setEditIncome(false) }}
                  className="h-6 w-28 text-right text-sm font-mono" autoFocus />
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveIncome}>
                  <Check className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <button onClick={() => { setIncomeInput(String(monthlyIncome)); setEditIncome(true) }}
                className="text-sm font-mono font-semibold hover:text-primary transition-colors">
                {formatCurrency(monthlyIncome)}
              </button>
            )}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Total expenses</span>
            <span className="text-sm font-mono font-semibold text-destructive">{formatCurrency(total)}</span>
          </div>
          <div className="h-px bg-border" />
          <div className="flex justify-between items-center">
            <span className="text-sm font-semibold">Surplus</span>
            <span className={cn("text-sm font-mono font-bold", surplus >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")}>
              {formatCurrency(surplus)}
            </span>
          </div>
          <div>
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${Math.min(100, monthlyIncome > 0 ? (total / monthlyIncome) * 100 : 0)}%` }} />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {monthlyIncome > 0 ? `${((total / monthlyIncome) * 100).toFixed(1)}% of income` : "—"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">By Group</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {groupTotals.map(({ group, total: gt }) => (
            <div key={group.id}>
              <div className="flex justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: group.color }} />
                  <span className="text-xs text-muted-foreground">{group.name}</span>
                </div>
                <span className="text-xs font-mono tabular-nums">{formatCurrency(gt)}</span>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${(gt / maxGroupTotal) * 100}%`, background: group.color }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader className="pb-2"><CardTitle className="text-sm">4% Rule Target</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Monthly retirement expenses × 300</p>
          <p className="text-2xl font-bold font-mono">{formatCurrency(fourPctTarget)}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">In retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Not in retirement</p>
              <p className="font-mono font-semibold">{formatCurrency(total - retirementTotal)}<span className="text-xs text-muted-foreground font-normal">/mo</span></p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export function ExpensesPage() {
  const {
    groups, expenses, monthlyIncome,
    addGroup, removeGroup,
    addExpense, updateExpense, removeExpense, toggleRetirement,
    setMonthlyIncome,
  } = useExpensesStore(
    useShallow((s) => ({
      groups: s.groups,
      expenses: s.expenses,
      monthlyIncome: s.monthlyIncome,
      addGroup: s.addGroup,
      removeGroup: s.removeGroup,
      addExpense: s.addExpense,
      updateExpense: s.updateExpense,
      removeExpense: s.removeExpense,
      toggleRetirement: s.toggleRetirement,
      setMonthlyIncome: s.setMonthlyIncome,
    }))
  )

  const setRetirementGoals = useCalculatorStore((s) => s.setRetirementGoals)

  // Auto-sync retirement total → desiredMonthlyIncome
  useEffect(() => {
    const retirementTotal = expenses.filter((e) => e.inRetirement).reduce((s, e) => s + e.amount, 0)
    setRetirementGoals({ desiredMonthlyIncome: retirementTotal })
  }, [expenses, setRetirementGoals])

  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingToGroupId, setAddingToGroupId] = useState<string | null>(null)
  const [addingGroup, setAddingGroup] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Monthly Expenses</h2>
          <p className="text-sm text-muted-foreground">
            Expenses marked "in retirement" drive your retirement income target automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setAddingGroup(true)} disabled={addingGroup}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Group
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-3">
          {addingGroup && (
            <AddGroupRow
              onSave={(name, color) => { addGroup(name, color); setAddingGroup(false) }}
              onCancel={() => setAddingGroup(false)}
            />
          )}
          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              expenses={expenses.filter((e) => e.groupId === group.id)}
              editingId={editingId}
              addingToGroupId={addingToGroupId}
              onEdit={(id) => { setEditingId(id); if (id) setAddingToGroupId(null) }}
              onUpdate={(id, name, amount) => updateExpense(id, { name, amount })}
              onRemoveExpense={removeExpense}
              onToggleRetirement={toggleRetirement}
              onAddExpense={(groupId, name, amount) => addExpense(groupId, name, amount)}
              onSetAdding={(id) => { setAddingToGroupId(id); if (id) setEditingId(null) }}
              onRemoveGroup={removeGroup}
            />
          ))}
        </div>

        <SummaryPanel
          monthlyIncome={monthlyIncome}
          groups={groups}
          expenses={expenses}
          onSetIncome={setMonthlyIncome}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
npm run build 2>&1 | grep "expenses-page\|error TS" | head -20
```

Expected: no errors from `expenses-page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/pages/expenses-page.tsx
git commit -m "feat: rewrite ExpensesPage with user-defined groups and inRetirement toggle"
```

---

## Task 7: Wire into the app

**Files:**
- Modify: `components/layout/sidebar.tsx`
- Modify: `app/calculator/calculator-client.tsx`
- Modify: `components/supabase-provider.tsx`

- [ ] **Step 1: Add Expenses to sidebar nav**

In `components/layout/sidebar.tsx`, add `Receipt` to the lucide import and insert the nav item:

```typescript
// Change this import line:
import {
  LayoutDashboard,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  Settings,
  Receipt,          // ← add
  User as UserIcon,
} from "lucide-react"

// Change this type:
export type NavPage = "overview" | "accounts" | "plan" | "expenses" | "projections" | "settings"

// Change NAV_ITEMS array — insert after "plan":
const NAV_ITEMS: { id: NavPage; label: string; icon: React.ElementType; showBadge?: boolean }[] = [
  { id: "overview",    label: "Overview",    icon: LayoutDashboard },
  { id: "accounts",   label: "Accounts",    icon: Wallet, showBadge: true },
  { id: "plan",       label: "Plan",        icon: SlidersHorizontal },
  { id: "expenses",   label: "Expenses",    icon: Receipt },          // ← add
  { id: "projections", label: "Projections", icon: TrendingUp },
]
```

- [ ] **Step 2: Wire ExpensesPage in calculator-client**

In `app/calculator/calculator-client.tsx`, add the import and case:

```typescript
// Add import (alongside other page imports):
import { ExpensesPage } from "@/components/pages/expenses-page"

// Add case inside the switch (after "plan" case):
case "expenses":
  return <ExpensesPage />
```

- [ ] **Step 3: Hook expenses sync into SupabaseProvider**

In `components/supabase-provider.tsx`:

```typescript
// Add import:
import { useExpensesStore } from "@/lib/store/expenses-store"

// Inside SupabaseProvider component, after the existing store hooks:
const syncExpensesFromDb = useExpensesStore((s) => s.syncFromDb)

// In the init() function, after the existing syncFromDb() call:
//   setSessionId(session.user.id)
//   await syncFromDb()
//   await syncExpensesFromDb(session.user.id)   ← add this line

// Do the same in both places syncFromDb() is called (init and onAuthStateChange):
// Pattern: wherever you see `await syncFromDb()`, add `await syncExpensesFromDb(userId)` on the next line.
```

Full updated `init` block:
```typescript
async function init() {
  const { data: { session } } = await supabase.auth.getSession()

  if (session) {
    setUser(session.user)
    if (session.user.id !== sessionId) {
      setSessionId(session.user.id)
      await syncFromDb()
      await syncExpensesFromDb(session.user.id)
    }
    return
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) { console.error("Anonymous sign-in failed:", error.message); return }
  if (data.user) {
    setUser(data.user)
    setSessionId(data.user.id)
    await syncFromDb()
    await syncExpensesFromDb(data.user.id)
  }
}
```

Full updated `onAuthStateChange` callback:
```typescript
supabase.auth.onAuthStateChange(async (event, session) => {
  const newUser = session?.user ?? null
  setUser(newUser)

  if (newUser && newUser.id !== useCalculatorStore.getState().sessionId) {
    setSessionId(newUser.id)
    await syncFromDb()
    await syncExpensesFromDb(newUser.id)
  }
})
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npm run build 2>&1 | grep "error TS\|Module not found" | head -20
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/layout/sidebar.tsx app/calculator/calculator-client.tsx components/supabase-provider.tsx
git commit -m "feat: wire Expenses page into sidebar, app shell, and session sync"
```

---

## Task 8: Smoke test in the browser

**Files:** (no code changes — verification only)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Open http://localhost:3000.

- [ ] **Step 2: Verify Expenses nav item appears**

Click "Expenses" in the sidebar. Expected: ExpensesPage renders with the 12 seeded groups (Housing, Food, Savings, Insurance, Subscriptions, Utilities, Transport, Family, Software, Health, Banking, Other) and all 32 expense items.

- [ ] **Step 3: Verify inRetirement toggle**

Click the "in retirement" badge on "Verband" (should start as "not in retirement"). Expected: badge text flips, the summary panel's "In retirement" total updates immediately, and the "4% Rule Target" card recalculates.

- [ ] **Step 4: Verify retirement goals auto-sync**

Navigate to Plan → Retirement Goals. Expected: "Desired Monthly Income" shows the same value as the "In retirement" monthly total from the Expenses page.

- [ ] **Step 5: Verify add/edit/delete**

- Click "+ Add expense" in Housing → type "Tolpad" → R200 → Enter. Expected: new item appears in Housing group.
- Hover the item → click pencil → change amount to R250 → Enter. Expected: amount updates.
- Hover → click trash. Expected: item removed.

- [ ] **Step 6: Verify "+ New Group"**

Click "New Group" → type "Hobbies" → pick a colour → Enter. Expected: new group appears at bottom of list with an empty "+ Add expense" row.

- [ ] **Step 7: Run full test suite**

```bash
npm run test
```

Expected: all tests pass.

- [ ] **Step 8: Final commit if any test fixes needed**

```bash
git add -p   # stage only intentional changes
git commit -m "fix: address any issues found during smoke test"
```
