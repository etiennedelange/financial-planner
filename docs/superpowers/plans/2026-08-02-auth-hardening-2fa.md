# Auth Hardening & 2FA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous-first auth with a login-required-for-persistence account system carrying optional TOTP 2FA enforced at the database layer, a working password reset, session management, account deletion, and platform hardening.

**Architecture:** Signed-out visitors run entirely in localStorage — no `auth.users` row exists until sign-up. On first sign-in, one idempotent `claimLocalData()` call pushes local work up, but only when the account has no server-side scenarios. 2FA is enforced in RLS via a single `public.mfa_satisfied()` function referenced by every table policy, so a stolen `aal1` token returns zero rows even when calling PostgREST directly. Middleware redirects are UX only.

**Tech Stack:** Next.js 16 (App Router, `proxy.ts` not `middleware.ts`), Supabase (`@supabase/ssr` 0.10, `supabase-js` 2.108), Zustand with `persist`, Vitest + happy-dom, Playwright, shadcn/ui, Zod v4 + react-hook-form.

**Spec:** `docs/superpowers/specs/2026-08-02-auth-hardening-2fa-design.md`

## Global Constraints

- **Branch:** `feature/auth-hardening-2fa` (already created, spec committed at `8e3a1d1`).
- **Every calculation-adjacent or data-migration change ships with unit tests.** CLAUDE.md rule 1.
- **Never duplicate logic — export it.** `mfa_satisfied()` is defined once in SQL and referenced by all four policies. `claimLocalData()` is defined once and called from one site. CLAUDE.md "Common Pitfalls".
- **Verification gate before every commit:** `pnpm test`, `pnpm typecheck`, `pnpm build`. `next build` does not typecheck test files — `typecheck` is not optional.
- **UI components use `<PageCard>` / `<SectionLabel>`.** Never raw `Card + CardHeader + CardTitle`. Never hardcoded colors — semantic tokens only (`bg-primary`, `text-destructive`).
- **Currency formatting** imports from `lib/utils/currency`.
- **Password policy values, verbatim:** `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"`, `secure_password_change = true`.
- **Session policy values, verbatim:** `timebox = "168h"`, `inactivity_timeout = "12h"`.
- **Recovery codes:** exactly 10 per user, single-use, stored as `crypt()` hashes, displayed once.
- **Supabase MFA is a Pro-plan feature in production.** Local development is unaffected. Do not treat a hosted 403 on MFA endpoints as a code bug.
- **Local Supabase must be running** for SQL tests: `npx supabase start`. Reset with `npx supabase db reset`.

## File Structure

**Create**
| File | Responsibility |
| --- | --- |
| `supabase/migrations/20260802000000_auth_user_fks.sql` | Orphan cleanup + FK cascades to `auth.users` |
| `supabase/migrations/20260802000100_mfa_rls.sql` | `public.mfa_satisfied()` + policy rewrite on all four tables |
| `supabase/migrations/20260802000200_recovery_codes.sql` | `user_recovery_codes` table, generate/redeem RPCs |
| `supabase/migrations/20260802000300_user_sessions_rpc.sql` | `public.my_sessions()` RPC over `auth.sessions` |
| `supabase/tests/rls_mfa.test.sql` | RLS behaviour at aal1/aal2, cross-user isolation |
| `lib/supabase/claim.ts` | `claimLocalData()` — the single sign-in data migration path |
| `lib/supabase/claim.test.ts` | Decision table for the above |
| `lib/auth/recovery-codes.ts` | Code generation + formatting (pure, no I/O) |
| `lib/auth/recovery-codes.test.ts` | Generation/format/entropy tests |
| `lib/auth/mfa.ts` | Thin typed wrappers over `supabase.auth.mfa.*` + recovery redemption |
| `lib/auth/mfa.test.ts` | Wrapper tests against a mocked client |
| `lib/security/headers.ts` | CSP string builder + static security headers (pure) |
| `lib/security/headers.test.ts` | CSP directive tests |
| `app/auth/reset-password/page.tsx` | Set-new-password screen |
| `app/auth/mfa/page.tsx` | TOTP challenge screen |
| `app/api/account/delete/route.ts` | Service-role account deletion |
| `app/api/account/export/route.ts` | JSON data export |
| `components/auth/reauthenticate-dialog.tsx` | Current-password gate for sensitive ops |
| `components/auth/mfa-enrollment.tsx` | QR enrolment + verification |
| `components/auth/recovery-codes-dialog.tsx` | One-time code display |
| `components/auth/session-list.tsx` | Active devices + sign out everywhere |
| `components/auth/turnstile.tsx` | Cloudflare Turnstile widget |

**Modify**
| File | Change |
| --- | --- |
| `supabase/config.toml` | Disable anon sign-in, enable TOTP, password + session policy, captcha |
| `components/supabase-provider.tsx:30-93` | Remove `signInAnonymously()`; call `claimLocalData()` |
| `components/auth/user-menu.tsx:28` | `isAnon` → `user === null` |
| `components/auth/auth-modal.tsx:64-95` | Plain `signUp()`, Turnstile token, reset redirect |
| `components/auth/profile-modal.tsx:51-70` | Reauthentication gate, 2FA section, sessions, delete |
| `app/auth/callback/route.ts` | Branch on `type=recovery`; support `token_hash` |
| `lib/supabase/proxy.ts:36` | AAL redirect + security headers + CSP nonce |
| `lib/store/calculator-store.ts:129-168` | Extract the claim branch out of `syncFromDb` |
| `.env.example` | Turnstile + service-role keys |

---

### Task 1: Remove anonymous authentication

**Files:**
- Modify: `supabase/config.toml`
- Modify: `components/supabase-provider.tsx:30-93`
- Modify: `components/auth/user-menu.tsx:28`
- Test: `lib/store/calculator-store.test.ts` (append)

**Interfaces:**
- Consumes: nothing.
- Produces: `useAuth()` returns `{ user: User | null, isLoaded: boolean }` where `user` is `null` for every signed-out visitor — no `is_anonymous` user ever exists.

- [ ] **Step 1: Write the failing test**

Append to `lib/store/calculator-store.test.ts`:

```typescript
describe('local-only mode (no session)', () => {
  it('does not attempt a DB read when sessionId is null', async () => {
    useCalculatorStore.setState({ sessionId: null, activeScenarioId: null })
    await useCalculatorStore.getState().syncFromDb()
    expect(useCalculatorStore.getState().activeScenarioId).toBeNull()
  })

  it('keeps account edits in memory when signed out', () => {
    useCalculatorStore.setState({ sessionId: null, accounts: [] })
    useCalculatorStore.getState().addAccount({
      id: 'acc-local-1',
      name: 'Local RA',
      type: 'retirement_annuity',
      currentBalance: 100000,
      monthlyContribution: 5000,
      annualEscalation: 6,
      expectedReturn: 11,
      equityAllocation: 70,
    })
    expect(useCalculatorStore.getState().accounts).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run it and confirm it passes against current code**

Run: `pnpm test lib/store/calculator-store.test.ts`
Expected: PASS. These lock in behaviour that must survive Task 1 — they are a regression guard, not a red test. If either fails now, stop and report: the store is not local-safe and the account model change is unsound.

- [ ] **Step 3: Disable anonymous sign-in in config**

In `supabase/config.toml`, under `[auth]`:

```toml
enable_anonymous_sign_ins = false
```

- [ ] **Step 4: Remove `signInAnonymously()` from the provider**

Replace the `init()` body in `components/supabase-provider.tsx` (lines 33-65) with:

```typescript
    async function init() {
      try {
        // getUser() verifies the token with the auth server.
        // getSession() trusts the cookie unverified — do not substitute it.
        const { data: { user: current } } = await supabase.auth.getUser()

        if (!current) {
          // Signed out: the app runs entirely from localStorage.
          // Both stores no-op their DB writes while sessionId is null.
          setUser(null)
          setSessionId(null)
          return
        }

        setUser(current)
        if (current.id !== useCalculatorStore.getState().sessionId) {
          setSessionId(current.id)
        }
        await syncFromDb()
        await syncExpensesFromDb(current.id)
      } catch (err) {
        console.error("Supabase init failed:", err)
      } finally {
        setIsLoaded(true)
      }
    }
```

- [ ] **Step 5: Collapse the anon check in UserMenu**

In `components/auth/user-menu.tsx`, replace line 28:

```typescript
  const isAnon = !user
```

- [ ] **Step 6: Verify**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass. Then `npx supabase db reset` and load `http://localhost:3000/calculator` signed out — the Network tab must show **no** call to `/auth/v1/signup`, and the calculator must still accept input.

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml components/supabase-provider.tsx components/auth/user-menu.tsx lib/store/calculator-store.test.ts
git commit -m "feat(auth): remove anonymous sign-in; run local-only when signed out"
```

---

### Task 2: Extract `claimLocalData`

The claim logic already exists but is split across two files and has no direct tests: the `scenarios.length === 0` branch in `lib/store/calculator-store.ts:137-152`, and `migrateExpensesToSession` called from `components/supabase-provider.tsx:83`. This task consolidates both into one tested function. This is the highest data-loss risk in the plan.

**Files:**
- Create: `lib/supabase/claim.ts`
- Create: `lib/supabase/claim.test.ts`
- Modify: `lib/store/calculator-store.ts:129-168`
- Modify: `components/supabase-provider.tsx:69-90`

**Interfaces:**
- Consumes: `listScenarios(userId)`, `createScenario(userId, name, data)`, `cloneAccounts(accounts, scenarioId)` from `lib/supabase/scenarios.ts` and `lib/supabase/accounts.ts`; `migrateExpensesToSession(sessionId, groups, expenses)` from `lib/supabase/expenses.ts`.
- Produces: `claimLocalData(userId: string, local: LocalSnapshot): Promise<ClaimResult>` where `type ClaimResult = { claimed: true; scenarioId: string } | { claimed: false; reason: 'server-has-data' | 'nothing-local' }`, and the exported `LocalSnapshot` interface.

- [ ] **Step 1: Write the failing test**

Create `lib/supabase/claim.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./scenarios', () => ({
  listScenarios: vi.fn(),
  createScenario: vi.fn(),
}))
vi.mock('./accounts', () => ({ cloneAccounts: vi.fn() }))
vi.mock('./expenses', () => ({ migrateExpensesToSession: vi.fn() }))

import { listScenarios, createScenario } from './scenarios'
import { cloneAccounts } from './accounts'
import { migrateExpensesToSession } from './expenses'
import { claimLocalData } from './claim'

const localState = {
  personalInfo: { currentAge: 35, retirementAge: 65, lifeExpectancy: 90, annualIncome: 600000 },
  retirementGoals: { desiredMonthlyIncome: 30000, inflationRate: 5.5, legacyAmount: 0 },
  assumptions: {
    equityReturn: 11, bondReturn: 8, cashReturn: 6.5,
    equityVolatility: 16.5, bondVolatility: 6, inflationRate: 5.5,
    compoundingMethod: 'compound' as const,
  },
  drawdownConfig: {
    strategy: 'fixed_percentage' as const, initialWithdrawalRate: 4,
    minimumWithdrawal: 15000, maximumWithdrawal: 60000, lumpSumPercentage: 0,
    upperGuardrail: 20, lowerGuardrail: 20,
  },
  displayMode: 'nominal' as const,
  accounts: [{ id: 'a1', name: 'RA', type: 'retirement_annuity', currentBalance: 100000,
    monthlyContribution: 5000, annualEscalation: 6, expectedReturn: 11, equityAllocation: 70 }],
  expenseGroups: [{ id: 'g1', name: 'Housing', color: '#6366f1', sortOrder: 0 }],
  expenses: [{ id: 'e1', groupId: 'g1', name: 'Rent', amount: 12000, inRetirement: true, sortOrder: 0 }],
}

beforeEach(() => vi.clearAllMocks())

describe('claimLocalData', () => {
  describe('server has no data', () => {
    it('migrates local state up and reports the new scenario', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue(localState.accounts as never)

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: true, scenarioId: 'scenario-new' })
      expect(createScenario).toHaveBeenCalledWith('user-1', 'My Plan', expect.objectContaining({
        personalInfo: localState.personalInfo,
      }))
      expect(cloneAccounts).toHaveBeenCalledWith(localState.accounts, 'scenario-new')
      expect(migrateExpensesToSession).toHaveBeenCalledWith(
        'user-1', localState.expenseGroups, localState.expenses,
      )
    })
  })

  describe('server already has data', () => {
    it('does not write anything and reports server-has-data', async () => {
      vi.mocked(listScenarios).mockResolvedValue([
        { id: 'existing', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z' },
      ])

      const result = await claimLocalData('user-1', localState as never)

      expect(result).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(createScenario).not.toHaveBeenCalled()
      expect(cloneAccounts).not.toHaveBeenCalled()
      expect(migrateExpensesToSession).not.toHaveBeenCalled()
    })
  })

  describe('idempotence and failure', () => {
    it('is a no-op on the second call once the server has the claimed data', async () => {
      vi.mocked(listScenarios).mockResolvedValueOnce([]).mockResolvedValueOnce([
        { id: 'scenario-new', name: 'My Plan', updatedAt: '2026-01-01T00:00:00Z' },
      ])
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)

      await claimLocalData('user-1', localState as never)
      const second = await claimLocalData('user-1', localState as never)

      expect(second).toEqual({ claimed: false, reason: 'server-has-data' })
      expect(createScenario).toHaveBeenCalledTimes(1)
    })

    it('propagates a scenario-creation failure so local state is not cleared', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockRejectedValue(new Error('network down'))

      await expect(claimLocalData('user-1', localState as never)).rejects.toThrow('network down')
      expect(migrateExpensesToSession).not.toHaveBeenCalled()
    })

    it('does not fail the claim when there is no local expense data', async () => {
      vi.mocked(listScenarios).mockResolvedValue([])
      vi.mocked(createScenario).mockResolvedValue('scenario-new')
      vi.mocked(cloneAccounts).mockResolvedValue([] as never)

      const result = await claimLocalData(
        'user-1', { ...localState, expenseGroups: [], expenses: [] } as never,
      )

      expect(result).toEqual({ claimed: true, scenarioId: 'scenario-new' })
    })
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test lib/supabase/claim.test.ts`
Expected: FAIL — `Failed to resolve import "./claim"`.

- [ ] **Step 3: Implement `claimLocalData`**

Create `lib/supabase/claim.ts`:

```typescript
import type { Account, DrawdownConfig, MarketAssumptions, PersonalInfo, RetirementGoals } from "@/types"
import type { Expense, ExpenseGroup } from "@/lib/store/expenses-store"
import { createScenario, listScenarios } from "./scenarios"
import { cloneAccounts } from "./accounts"
import { migrateExpensesToSession } from "./expenses"

export interface LocalSnapshot {
  personalInfo: PersonalInfo
  retirementGoals: RetirementGoals
  assumptions: MarketAssumptions
  drawdownConfig: DrawdownConfig
  displayMode: "nominal" | "real"
  accounts: Account[]
  expenseGroups: ExpenseGroup[]
  expenses: Expense[]
}

export type ClaimResult =
  | { claimed: true; scenarioId: string }
  | { claimed: false; reason: "server-has-data" | "nothing-local" }

/**
 * Migrates a signed-out visitor's localStorage work into their account on first sign-in.
 *
 * The rule: claim ONLY when the account has zero scenarios server-side. A returning user
 * signing in on a borrowed browser must never have server data overwritten by whatever is
 * in that browser. There is deliberately no merge — two divergent retirement plans have no
 * correct merge, and guessing produces numbers the user cannot explain.
 *
 * Safe to interrupt: a failure part-way through throws, leaving localStorage intact so the
 * next sign-in retries. Safe to call repeatedly — the second call sees server data and stops.
 */
export async function claimLocalData(
  userId: string,
  local: LocalSnapshot
): Promise<ClaimResult> {
  const existing = await listScenarios(userId)
  if (existing.length > 0) return { claimed: false, reason: "server-has-data" }

  const scenarioId = await createScenario(userId, "My Plan", {
    personalInfo: local.personalInfo,
    retirementGoals: local.retirementGoals,
    assumptions: local.assumptions,
    drawdownConfig: local.drawdownConfig,
    displayMode: local.displayMode,
  })

  await cloneAccounts(local.accounts, scenarioId)
  await migrateExpensesToSession(userId, local.expenseGroups, local.expenses)

  return { claimed: true, scenarioId }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test lib/supabase/claim.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Remove the duplicated claim branch from the store**

In `lib/store/calculator-store.ts`, delete lines 137-152 (the `if (scenarios.length === 0) { ... return }` block) and replace with:

```typescript
          if (scenarios.length === 0) {
            // Claiming is owned by claimLocalData(), called from SupabaseProvider on
            // sign-in. syncFromDb must not create scenarios — two code paths creating
            // "My Plan" is how duplicate plans appear.
            set({ activeScenarioId: null, scenarioList: [] })
            return
          }
```

- [ ] **Step 6: Wire the single call site in the provider**

In `components/supabase-provider.tsx`, replace the `onAuthStateChange` body (lines 69-90) with:

```typescript
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const newUser = session?.user ?? null
      setUser(newUser)

      if (!newUser) {
        setSessionId(null)
        return
      }
      if (newUser.id === useCalculatorStore.getState().sessionId) return

      // Snapshot local state BEFORE any sync overwrites it.
      const calc = useCalculatorStore.getState()
      const exp = useExpensesStore.getState()

      setSessionId(newUser.id)

      try {
        await claimLocalData(newUser.id, {
          personalInfo: calc.personalInfo,
          retirementGoals: calc.retirementGoals,
          assumptions: calc.assumptions,
          drawdownConfig: calc.drawdownConfig,
          displayMode: calc.displayMode,
          accounts: calc.accounts,
          expenseGroups: exp.groups,
          expenses: exp.expenses,
        })
      } catch (err) {
        // Local state is untouched; the next sign-in retries.
        console.error("Claiming local data failed:", err)
      }

      await syncFromDb()
      await syncExpensesFromDb(newUser.id)
    })
```

Add the import: `import { claimLocalData } from "@/lib/supabase/claim"` and remove the now-unused `migrateExpensesToSession` import.

- [ ] **Step 7: Verify**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add lib/supabase/claim.ts lib/supabase/claim.test.ts lib/store/calculator-store.ts components/supabase-provider.tsx
git commit -m "refactor(auth): consolidate sign-in data claiming into claimLocalData"
```

---

### Task 3: Foreign keys to `auth.users`

**Files:**
- Create: `supabase/migrations/20260802000000_auth_user_fks.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: deleting a row from `auth.users` cascades to `scenarios`, `expense_groups`, `expenses`, and transitively to `accounts` via `accounts.scenario_id`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260802000000_auth_user_fks.sql`:

```sql
-- session_id columns were plain uuids with no referential integrity. Deleting a user
-- orphaned every row they owned: the data survived, unreachable and unattributed.
-- Adding the constraint requires clearing pre-existing orphans first, or it fails.

delete from expenses       where session_id not in (select id from auth.users);
delete from expense_groups where session_id not in (select id from auth.users);
delete from accounts       where scenario_id not in (select id from scenarios);
delete from scenarios      where session_id not in (select id from auth.users);

alter table scenarios
  add constraint scenarios_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

alter table expense_groups
  add constraint expense_groups_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

alter table expenses
  add constraint expenses_session_id_fkey
  foreign key (session_id) references auth.users (id) on delete cascade;

-- accounts already cascades via accounts.scenario_id -> scenarios(id) on delete cascade,
-- and scenarios now cascades from auth.users, so accounts are reached transitively.
```

- [ ] **Step 2: Apply and verify the cascade actually fires**

```bash
npx supabase db reset
npx supabase db push
```

Then in `psql` (`npx supabase db reset` prints the connection string, or use Studio at `http://127.0.0.1:54323`):

```sql
-- Expect: three rows, all with confdeltype = 'c' (CASCADE)
select conname, confdeltype from pg_constraint
where conname in (
  'scenarios_session_id_fkey',
  'expense_groups_session_id_fkey',
  'expenses_session_id_fkey'
);
```

Expected: 3 rows, `confdeltype` = `c` for each.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260802000000_auth_user_fks.sql
git commit -m "fix(db): cascade user deletion to scenarios, expense groups and expenses"
```

---

### Task 4: `mfa_satisfied()` and RLS enforcement

This is the task that makes the 2FA claim true rather than asserted. Review it hardest.

**Files:**
- Create: `supabase/migrations/20260802000100_mfa_rls.sql`
- Create: `supabase/tests/rls_mfa.test.sql`
- Modify: `supabase/config.toml`

**Interfaces:**
- Consumes: existing policies from `20260427000000`, `20260509120000`, `20260607000000`.
- Produces: `public.mfa_satisfied() returns boolean`, referenced by the `using` and `with check` clause of every policy on `scenarios`, `accounts`, `expense_groups`, `expenses`.

- [ ] **Step 1: Write the failing SQL test**

Create `supabase/tests/rls_mfa.test.sql`. This runs as a plain script asserting with `do $$ ... raise exception ... $$`, so it needs no pgTAP install:

```sql
-- RLS + AAL enforcement tests. Run with:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_mfa.test.sql
-- Any assertion failure aborts with a non-zero exit code.

begin;

-- Two users: alice has a verified TOTP factor, bob has none.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'alice@test.local', 'x'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@test.local', 'x');

insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values ('33333333-3333-3333-3333-333333333333',
        '11111111-1111-1111-1111-111111111111', 'app', 'totp', 'verified', now(), now());

insert into scenarios (id, session_id, name)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Alice Plan'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bob Plan');

set local role authenticated;

-- 1. Alice at aal1 WITH a verified factor: must see nothing.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from scenarios) <> 0 then
    raise exception 'FAIL: enrolled user at aal1 can read scenarios';
  end if;
end $$;

-- 2. Alice at aal2: must see exactly her own row.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal2"}';
do $$ begin
  if (select count(*) from scenarios) <> 1 then
    raise exception 'FAIL: enrolled user at aal2 cannot read own scenarios';
  end if;
end $$;

-- 3. Bob at aal1 WITHOUT a factor: must see exactly his own row.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from scenarios) <> 1 then
    raise exception 'FAIL: unenrolled user at aal1 cannot read own scenarios';
  end if;
end $$;

-- 4. Bob must never see Alice's row, at any AAL.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal2"}';
do $$ begin
  if exists (select 1 from scenarios where session_id = '11111111-1111-1111-1111-111111111111') then
    raise exception 'FAIL: cross-user read is possible';
  end if;
end $$;

-- 5. Alice at aal1 must not be able to WRITE either.
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';
do $$ begin
  begin
    insert into scenarios (session_id, name)
    values ('11111111-1111-1111-1111-111111111111', 'Snuck In');
    raise exception 'FAIL: enrolled user at aal1 can insert scenarios';
  exception when insufficient_privilege then
    null; -- expected
  end;
end $$;

rollback;
```

- [ ] **Step 2: Run it and verify it fails**

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_mfa.test.sql
```

Expected: FAIL at assertion 1 — `FAIL: enrolled user at aal1 can read scenarios`. Current policies have no AAL awareness, so Alice sees her row.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260802000100_mfa_rls.sql`:

```sql
-- Two-factor enforcement lives here, in RLS, not in middleware.
-- The publishable key ships in the client bundle, so anyone holding a stolen aal1
-- token can call PostgREST directly. Middleware never sees that request; RLS does.
--
-- Defined ONCE and referenced by every policy. Do not inline this predicate per-table —
-- four copies of a security rule is four chances for them to drift apart.

create or replace function public.mfa_satisfied()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.jwt() ->> 'aal') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors
        where user_id = (select auth.uid())
          and status = 'verified'
      );
$$;

revoke all on function public.mfa_satisfied() from public;
grant execute on function public.mfa_satisfied() to authenticated;

comment on function public.mfa_satisfied() is
  'True when the caller has cleared their second factor, or has none enrolled. '
  'Referenced by every table policy — the single enforcement point for 2FA.';

-- scenarios
drop policy if exists "session users can manage their own scenario" on scenarios;
create policy "users manage own scenarios"
  on scenarios for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- accounts (scoped through scenarios)
drop policy if exists "users can manage accounts in their scenarios" on accounts;
create policy "users manage own accounts"
  on accounts for all
  using (
    public.mfa_satisfied()
    and scenario_id in (select id from scenarios where session_id = (select auth.uid()))
  )
  with check (
    public.mfa_satisfied()
    and scenario_id in (select id from scenarios where session_id = (select auth.uid()))
  );

-- expense_groups
drop policy if exists "users can manage their own expense groups" on expense_groups;
create policy "users manage own expense groups"
  on expense_groups for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- expenses
drop policy if exists "users can manage their own expenses" on expenses;
create policy "users manage own expenses"
  on expenses for all
  using       (session_id = (select auth.uid()) and public.mfa_satisfied())
  with check  (session_id = (select auth.uid()) and public.mfa_satisfied());

-- mfa_satisfied() probes auth.mfa_factors on every policy evaluation.
create index if not exists mfa_factors_user_status_idx
  on auth.mfa_factors (user_id, status);
```

- [ ] **Step 4: Enable TOTP in config**

In `supabase/config.toml`, under `[auth.mfa.totp]`:

```toml
enroll_enabled = true
verify_enabled = true
```

- [ ] **Step 5: Apply and re-run the test**

```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_mfa.test.sql
```

Expected: exits 0, no `FAIL:` output. All five assertions hold.

- [ ] **Step 6: Add the test to package.json**

In `package.json` scripts:

```json
"test:rls": "psql \"postgresql://postgres:postgres@127.0.0.1:54322/postgres\" -v ON_ERROR_STOP=1 -f supabase/tests/rls_mfa.test.sql"
```

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260802000100_mfa_rls.sql supabase/tests/rls_mfa.test.sql supabase/config.toml package.json
git commit -m "feat(auth): enforce 2FA at the RLS layer via mfa_satisfied()"
```

---

### Task 5: Recovery codes

**Files:**
- Create: `supabase/migrations/20260802000200_recovery_codes.sql`
- Create: `lib/auth/recovery-codes.ts`
- Create: `lib/auth/recovery-codes.test.ts`

**Interfaces:**
- Consumes: `pgcrypto` (already available in Supabase's `extensions` schema).
- Produces:
  - `generateRecoveryCodes(): string[]` — 10 codes, format `xxxxx-xxxxx` from Crockford base32.
  - SQL `public.store_recovery_codes(codes text[]) returns void`
  - SQL `public.redeem_recovery_code(code text) returns boolean`
  - SQL `public.recovery_codes_remaining() returns integer`

- [ ] **Step 1: Write the failing test for code generation**

Create `lib/auth/recovery-codes.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateRecoveryCodes, RECOVERY_CODE_COUNT } from './recovery-codes'

describe('generateRecoveryCodes', () => {
  it('returns exactly ten codes', () => {
    expect(generateRecoveryCodes()).toHaveLength(RECOVERY_CODE_COUNT)
  })

  it('formats codes as xxxxx-xxxxx in Crockford base32', () => {
    for (const code of generateRecoveryCodes()) {
      expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{5}-[0-9A-HJKMNP-TV-Z]{5}$/)
    }
  })

  it('excludes ambiguous characters I, L, O and U', () => {
    const joined = generateRecoveryCodes().join('')
    expect(joined).not.toMatch(/[ILOU]/)
  })

  it('returns distinct codes within a batch', () => {
    const codes = generateRecoveryCodes()
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT)
  })

  it('does not repeat across batches', () => {
    const a = new Set(generateRecoveryCodes())
    const b = generateRecoveryCodes()
    expect(b.some((c) => a.has(c))).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test lib/auth/recovery-codes.test.ts`
Expected: FAIL — `Failed to resolve import "./recovery-codes"`.

- [ ] **Step 3: Implement generation**

Create `lib/auth/recovery-codes.ts`:

```typescript
export const RECOVERY_CODE_COUNT = 10

// Crockford base32 minus I, L, O and U — no character pair a user can confuse
// while copying a code off a screen under pressure.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const GROUP = 5

function randomGroup(): string {
  const bytes = new Uint8Array(GROUP)
  crypto.getRandomValues(bytes)
  // 32-character alphabet divides 256 exactly, so the modulo introduces no bias.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

/** Ten single-use recovery codes. Shown to the user exactly once; only hashes are stored. */
export function generateRecoveryCodes(): string[] {
  const codes = new Set<string>()
  while (codes.size < RECOVERY_CODE_COUNT) {
    codes.add(`${randomGroup()}-${randomGroup()}`)
  }
  return [...codes]
}

/** Normalises user input: strips whitespace, uppercases, tolerates a missing hyphen. */
export function normaliseRecoveryCode(input: string): string {
  const bare = input.replace(/[\s-]/g, "").toUpperCase()
  return bare.length === GROUP * 2 ? `${bare.slice(0, GROUP)}-${bare.slice(GROUP)}` : bare
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test lib/auth/recovery-codes.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the migration**

Create `supabase/migrations/20260802000200_recovery_codes.sql`:

```sql
-- Supabase provides no recovery codes. Without them, a lost authenticator is a
-- permanent lockout with no self-serve path back in.

create table user_recovery_codes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  code_hash  text not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index user_recovery_codes_user_id_idx on user_recovery_codes (user_id);

alter table user_recovery_codes enable row level security;
alter table user_recovery_codes force row level security;

-- Users may see WHETHER their codes are spent, never the hashes themselves.
-- All writes go through the security-definer RPCs below.
create policy "users read own recovery code state"
  on user_recovery_codes for select
  using (user_id = (select auth.uid()));

revoke insert, update, delete on user_recovery_codes from authenticated;

-- Replaces the caller's entire code set. Called at enrolment and at regeneration.
create or replace function public.store_recovery_codes(codes text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  c   text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if array_length(codes, 1) is distinct from 10 then
    raise exception 'expected exactly 10 recovery codes' using errcode = '22023';
  end if;

  delete from public.user_recovery_codes where user_id = uid;

  foreach c in array codes loop
    insert into public.user_recovery_codes (user_id, code_hash)
    values (uid, extensions.crypt(c, extensions.gen_salt('bf', 10)));
  end loop;
end;
$$;

-- Marks one unused code spent. Returns true on success, false if no code matches.
-- Deliberately returns a boolean rather than raising, so the caller cannot distinguish
-- "wrong code" from "no codes left" by error type.
create or replace function public.redeem_recovery_code(code text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid    uuid := (select auth.uid());
  target uuid;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  select id into target
  from public.user_recovery_codes
  where user_id = uid
    and used_at is null
    and code_hash = extensions.crypt(code, code_hash)
  limit 1;

  if target is null then
    return false;
  end if;

  update public.user_recovery_codes set used_at = now() where id = target;
  return true;
end;
$$;

create or replace function public.recovery_codes_remaining()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.user_recovery_codes
  where user_id = (select auth.uid()) and used_at is null;
$$;

revoke all on function public.store_recovery_codes(text[])   from public;
revoke all on function public.redeem_recovery_code(text)     from public;
revoke all on function public.recovery_codes_remaining()     from public;
grant execute on function public.store_recovery_codes(text[]) to authenticated;
grant execute on function public.redeem_recovery_code(text)   to authenticated;
grant execute on function public.recovery_codes_remaining()   to authenticated;
```

- [ ] **Step 6: Append SQL tests for single-use enforcement**

Append to `supabase/tests/rls_mfa.test.sql`, before the final `rollback;`:

```sql
-- Recovery codes: redemption is single-use and scoped to the caller.
set local role postgres;
insert into user_recovery_codes (user_id, code_hash)
values ('11111111-1111-1111-1111-111111111111',
        extensions.crypt('ABCDE-FGHJK', extensions.gen_salt('bf', 10)));

set local role authenticated;
set local request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated","aal":"aal1"}';

do $$ begin
  if not public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: valid recovery code was rejected';
  end if;
  if public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: recovery code redeemed twice';
  end if;
  if public.redeem_recovery_code('ZZZZZ-ZZZZZ') then
    raise exception 'FAIL: unknown recovery code accepted';
  end if;
end $$;

-- Bob must not be able to redeem Alice's code.
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';
do $$ begin
  if public.redeem_recovery_code('ABCDE-FGHJK') then
    raise exception 'FAIL: recovery code redeemable across users';
  end if;
end $$;
```

- [ ] **Step 7: Apply and verify**

```bash
npx supabase db reset && pnpm test:rls && pnpm test
```

Expected: `test:rls` exits 0; Vitest passes.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260802000200_recovery_codes.sql lib/auth/recovery-codes.ts lib/auth/recovery-codes.test.ts supabase/tests/rls_mfa.test.sql
git commit -m "feat(auth): add single-use recovery codes with hashed storage"
```

---

### Task 6: Password policy and reauthentication gate

**Files:**
- Modify: `supabase/config.toml`
- Create: `components/auth/reauthenticate-dialog.tsx`
- Modify: `components/auth/profile-modal.tsx:51-70`
- Modify: `components/auth/auth-modal.tsx:18-21`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/client`.
- Produces: `<ReauthenticateDialog open onCancel onConfirmed email />` — calls `onConfirmed()` only after `signInWithPassword` succeeds against the supplied email.

- [ ] **Step 1: Tighten the config**

In `supabase/config.toml`, under `[auth]`:

```toml
minimum_password_length = 12
password_requirements = "lower_upper_letters_digits"
```

Under `[auth.email]`:

```toml
secure_password_change = true
```

Leaked-password protection has no `config.toml` equivalent — it is a hosted-only setting. Record it as a launch step: **Dashboard → Authentication → Policies → "Prevent use of leaked passwords"**, to be enabled the day a hosted project is created. Note it in `docs/project-phases/phase-3-user-accounts.md` under Pending so it is not lost.

- [ ] **Step 2: Match the client-side schema to the server**

In `components/auth/auth-modal.tsx`, replace the schema at lines 18-21:

```typescript
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a digit")

const emailPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: passwordSchema,
})

// Sign-in must NOT apply the new complexity rules — existing users may hold a
// shorter legacy password and must still be able to sign in to change it.
const signInSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
})
```

Change `signinForm` to use `signInSchema` and `signupForm` to use `emailPasswordSchema`. Update the `EmailPasswordForm` type usage so `signinForm` is typed `z.infer<typeof signInSchema>`.

- [ ] **Step 3: Build the reauthentication dialog**

Create `components/auth/reauthenticate-dialog.tsx`:

```tsx
"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ReauthenticateDialogProps {
  open: boolean
  email: string
  /** What the user is about to do, e.g. "change your email address". */
  action: string
  onCancel: () => void
  onConfirmed: () => void
}

/**
 * Gate for sensitive operations. An active session is not proof of presence — a
 * borrowed unlocked laptop has one. Re-entering the password is.
 */
export function ReauthenticateDialog({
  open, email, action, onCancel, onConfirmed,
}: ReauthenticateDialogProps) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error: signInError } = await createClient().auth.signInWithPassword({ email, password })
    setLoading(false)

    if (signInError) {
      setError("That password is not correct.")
      return
    }
    setPassword("")
    onConfirmed()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-sm">
        <DialogTitle className="text-base font-semibold">Confirm it&apos;s you</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          Enter your password to {action}.
        </DialogDescription>
        <form onSubmit={handleConfirm} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reauth-pw" className="text-xs font-medium">Password</Label>
            <Input
              id="reauth-pw"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={`h-8 text-sm ${error ? "border-destructive" : ""}`}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading || password.length === 0}>
              {loading ? "Checking…" : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Gate the profile modal's sensitive actions**

In `components/auth/profile-modal.tsx`, add state and route both handlers through the gate:

```tsx
const [pendingAction, setPendingAction] = useState<
  { kind: "email"; values: EmailForm } | { kind: "password"; values: PasswordForm } | null
>(null)

async function runEmailChange(values: EmailForm) {
  setEmailLoading(true); setEmailMsg(null)
  const { error } = await createClient().auth.updateUser({ email: values.email })
  setEmailLoading(false)
  setEmailMsg(error
    ? { type: "error", text: error.message }
    : { type: "success", text: "Check both inboxes to confirm the change." })
}

async function runPasswordChange(values: PasswordForm) {
  setPwLoading(true); setPwMsg(null)
  const { error } = await createClient().auth.updateUser({ password: values.password })
  setPwLoading(false)
  setPwMsg(error
    ? { type: "error", text: error.message }
    : { type: "success", text: "Password updated." })
}
```

Change the form `onSubmit` handlers to `(values) => setPendingAction({ kind: "email", values })` and `(values) => setPendingAction({ kind: "password", values })`, then render:

```tsx
<ReauthenticateDialog
  open={pendingAction !== null}
  email={user.email ?? ""}
  action={pendingAction?.kind === "email" ? "change your email address" : "change your password"}
  onCancel={() => setPendingAction(null)}
  onConfirmed={() => {
    const action = pendingAction
    setPendingAction(null)
    if (action?.kind === "email") void runEmailChange(action.values)
    if (action?.kind === "password") void runPasswordChange(action.values)
  }}
/>
```

- [ ] **Step 5: Verify**

Run: `npx supabase db reset && pnpm test && pnpm typecheck && pnpm build`

Then manually: sign up with `Password123456`, open Manage Account, change the password — the confirm dialog must appear, must reject a wrong password, and must let the change through on the correct one. Attempting to sign up with `short` must be rejected client-side, and with `alllowercase123` server-side.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml components/auth/reauthenticate-dialog.tsx components/auth/profile-modal.tsx components/auth/auth-modal.tsx
git commit -m "feat(auth): 12-char password policy and reauthentication for sensitive actions"
```

---

### Task 7: Fix the password reset flow

Today `resetPasswordForEmail` redirects to `/auth/callback?next=/calculator`, the callback exchanges the code, and the user lands on the calculator signed in — never asked for a new password. The reset link is a passwordless login.

**Files:**
- Modify: `app/auth/callback/route.ts`
- Create: `app/auth/reset-password/page.tsx`
- Modify: `components/auth/auth-modal.tsx:87-95`
- Create: `e2e/journeys/02-password-reset.spec.ts`

**Interfaces:**
- Consumes: `createClient()` from `lib/supabase/server` and `lib/supabase/client`.
- Produces: route `/auth/reset-password`; callback contract — `?type=recovery` always lands on `/auth/reset-password`, ignoring `next`.

- [ ] **Step 1: Rewrite the callback route**

Replace `app/auth/callback/route.ts` entirely:

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

/**
 * Handles every email-link return path: signup confirmation, email change,
 * magic link and password recovery.
 *
 * Supabase sends one of two shapes depending on the email template:
 *   - PKCE:   ?code=<uuid>
 *   - OTP:    ?token_hash=<hash>&type=<recovery|signup|email_change|...>
 * Both are handled — which one arrives is a template setting, not a code path
 * the app controls.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? "/calculator"

  const supabase = await createClient()
  let failed = true

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    failed = Boolean(error)
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    failed = Boolean(error)
  }

  if (failed) {
    return NextResponse.redirect(`${origin}/calculator?error=auth`)
  }

  // A recovery link grants a session, which is exactly why it must not drop the
  // user into the app. Without this branch the reset link IS the login.
  if (type === "recovery") {
    return NextResponse.redirect(`${origin}/auth/reset-password`)
  }

  return NextResponse.redirect(`${origin}${next}`)
}
```

- [ ] **Step 2: Send `type=recovery` through the reset email**

In `components/auth/auth-modal.tsx`, change `handleReset` (line 89-91):

```typescript
    const { error } = await createClient().auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
```

- [ ] **Step 3: Build the reset page**

Create `app/auth/reset-password/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"

const schema = z
  .object({
    password: z
      .string()
      .min(12, "Password must be at least 12 characters")
      .regex(/[a-z]/, "Include a lowercase letter")
      .regex(/[A-Z]/, "Include an uppercase letter")
      .regex(/[0-9]/, "Include a digit"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  })

type Form = z.infer<typeof schema>

export default function ResetPasswordPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const form = useForm<Form>({ resolver: zodResolver(schema) })

  // The recovery link must have established a session before we get here.
  // Landing without one means the link was stale, reused, or tampered with.
  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/calculator?error=reset-expired")
        return
      }
      setChecking(false)
    })
  }, [router])

  async function onSubmit(values: Form) {
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password: values.password })
    if (updateError) {
      setError(updateError.message)
      return
    }
    // Kill every other session — a password reset usually means the old one was
    // compromised, and leaving those sessions alive defeats the point.
    await supabase.auth.signOut({ scope: "others" })
    router.replace("/calculator?reset=success")
  }

  if (checking) return null

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center px-4">
      <PageCard label="Set a New Password" contentClassName="space-y-4" className="w-full">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="new-pw" className="text-xs font-medium">New password</Label>
            <Input id="new-pw" type="password" autoComplete="new-password" autoFocus
              className={`h-8 text-sm ${form.formState.errors.password ? "border-destructive" : ""}`}
              {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirm-pw" className="text-xs font-medium">Confirm password</Label>
            <Input id="confirm-pw" type="password" autoComplete="new-password"
              className={`h-8 text-sm ${form.formState.errors.confirm ? "border-destructive" : ""}`}
              {...form.register("confirm")} />
            {form.formState.errors.confirm && (
              <p className="text-xs text-destructive">{form.formState.errors.confirm.message}</p>
            )}
          </div>
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </PageCard>
    </div>
  )
}
```

- [ ] **Step 4: Write the e2e test**

Create `e2e/journeys/02-password-reset.spec.ts`:

```typescript
import { test, expect } from "@playwright/test"

// Local Supabase captures outbound mail in Inbucket on port 54324.
const INBUCKET = "http://127.0.0.1:54324"

async function latestResetLink(email: string): Promise<string> {
  const mailbox = email.split("@")[0]
  const res = await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}`)
  const messages = await res.json()
  const newest = messages[messages.length - 1]
  const detail = await fetch(`${INBUCKET}/api/v1/mailbox/${mailbox}/${newest.id}`).then((r) => r.json())
  const match = (detail.body.text as string).match(/https?:\/\/\S+/)
  if (!match) throw new Error("No link in reset email")
  return match[0]
}

test("password reset requires setting a new password", async ({ page }) => {
  const email = `reset-${Date.now()}@test.local`
  const oldPassword = "OldPassword123"
  const newPassword = "NewPassword456"

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /sign up/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(oldPassword)
  await page.getByRole("button", { name: /create account/i }).click()

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /forgot password/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByRole("button", { name: /send reset link/i }).click()
  await expect(page.getByText(/reset link sent/i)).toBeVisible()

  await page.goto(await latestResetLink(email))

  // The defect this test exists for: the link must NOT drop the user in the app.
  await expect(page).toHaveURL(/\/auth\/reset-password/)
  await expect(page.getByText(/set a new password/i)).toBeVisible()

  await page.getByLabel("New password").fill(newPassword)
  await page.getByLabel("Confirm password").fill(newPassword)
  await page.getByRole("button", { name: /update password/i }).click()
  await expect(page).toHaveURL(/reset=success/)

  // The old password must be dead.
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(oldPassword)
  await page.getByRole("button", { name: /^sign in$/i }).click()
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible()
})
```

- [ ] **Step 5: Run the e2e test**

Run: `npx supabase start && pnpm dev` in one shell, then `npx playwright test e2e/journeys/02-password-reset.spec.ts --project=desktop-chrome`
Expected: PASS.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`

```bash
git add app/auth/callback/route.ts app/auth/reset-password/page.tsx components/auth/auth-modal.tsx e2e/journeys/02-password-reset.spec.ts
git commit -m "fix(auth): password reset now requires setting a new password"
```

---

### Task 8: TOTP enrolment

**Files:**
- Create: `lib/auth/mfa.ts`
- Create: `lib/auth/mfa.test.ts`
- Create: `components/auth/mfa-enrollment.tsx`
- Create: `components/auth/recovery-codes-dialog.tsx`
- Modify: `components/auth/profile-modal.tsx`

**Interfaces:**
- Consumes: `generateRecoveryCodes()`, `normaliseRecoveryCode()` from `lib/auth/recovery-codes`; `supabase.auth.mfa.*`; RPC `store_recovery_codes`.
- Produces:
  - `enrollTotp(): Promise<{ factorId: string; qrCode: string; secret: string }>`
  - `verifyEnrollment(factorId: string, code: string): Promise<string[]>` — returns the recovery codes on success
  - `listFactors(): Promise<{ id: string; friendlyName: string | null }[]>`
  - `unenrollTotp(factorId: string): Promise<void>`
  - `currentAal(): Promise<{ current: string | null; next: string | null }>`

- [ ] **Step 1: Write the failing test**

Create `lib/auth/mfa.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mfa = {
  enroll: vi.fn(),
  challenge: vi.fn(),
  verify: vi.fn(),
  unenroll: vi.fn(),
  listFactors: vi.fn(),
  getAuthenticatorAssuranceLevel: vi.fn(),
}
const rpc = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { mfa }, rpc }),
}))

import { enrollTotp, verifyEnrollment, listFactors, unenrollTotp } from './mfa'

beforeEach(() => vi.clearAllMocks())

describe('enrollTotp', () => {
  it('returns the factor id, QR code and secret', async () => {
    mfa.enroll.mockResolvedValue({
      data: { id: 'factor-1', totp: { qr_code: 'data:image/svg+xml;…', secret: 'JBSWY3DP' } },
      error: null,
    })

    await expect(enrollTotp()).resolves.toEqual({
      factorId: 'factor-1', qrCode: 'data:image/svg+xml;…', secret: 'JBSWY3DP',
    })
  })

  it('throws when Supabase rejects enrolment', async () => {
    mfa.enroll.mockResolvedValue({ data: null, error: { message: 'MFA not enabled' } })
    await expect(enrollTotp()).rejects.toThrow('MFA not enabled')
  })
})

describe('verifyEnrollment', () => {
  it('stores ten recovery codes and returns them on success', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: {}, error: null })
    rpc.mockResolvedValue({ error: null })

    const codes = await verifyEnrollment('factor-1', '123456')

    expect(codes).toHaveLength(10)
    expect(rpc).toHaveBeenCalledWith('store_recovery_codes', { codes })
  })

  it('does not generate recovery codes when the TOTP code is wrong', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: null, error: { message: 'Invalid TOTP code' } })

    await expect(verifyEnrollment('factor-1', '000000')).rejects.toThrow('Invalid TOTP code')
    expect(rpc).not.toHaveBeenCalled()
  })

  it('unenrolls the factor if storing recovery codes fails', async () => {
    mfa.challenge.mockResolvedValue({ data: { id: 'challenge-1' }, error: null })
    mfa.verify.mockResolvedValue({ data: {}, error: null })
    rpc.mockResolvedValue({ error: { message: 'db down' } })
    mfa.unenroll.mockResolvedValue({ error: null })

    await expect(verifyEnrollment('factor-1', '123456')).rejects.toThrow('db down')
    // Leaving a verified factor with no recovery codes is a lockout waiting to happen.
    expect(mfa.unenroll).toHaveBeenCalledWith({ factorId: 'factor-1' })
  })
})

describe('listFactors', () => {
  it('returns only verified TOTP factors', async () => {
    mfa.listFactors.mockResolvedValue({
      data: { totp: [{ id: 'f1', friendly_name: 'Phone' }] }, error: null,
    })
    await expect(listFactors()).resolves.toEqual([{ id: 'f1', friendlyName: 'Phone' }])
  })

  it('returns an empty list when nothing is enrolled', async () => {
    mfa.listFactors.mockResolvedValue({ data: { totp: [] }, error: null })
    await expect(listFactors()).resolves.toEqual([])
  })
})

describe('unenrollTotp', () => {
  it('throws when unenrolment fails', async () => {
    mfa.unenroll.mockResolvedValue({ error: { message: 'aal2 required' } })
    await expect(unenrollTotp('f1')).rejects.toThrow('aal2 required')
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test lib/auth/mfa.test.ts`
Expected: FAIL — `Failed to resolve import "./mfa"`.

- [ ] **Step 3: Implement the wrappers**

Create `lib/auth/mfa.ts`:

```typescript
import { createClient } from "@/lib/supabase/client"
import { generateRecoveryCodes, normaliseRecoveryCode } from "./recovery-codes"

export interface TotpEnrollment {
  factorId: string
  qrCode: string
  secret: string
}

export async function enrollTotp(): Promise<TotpEnrollment> {
  const { data, error } = await createClient().auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  })
  if (error) throw new Error(error.message)
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
}

/**
 * Confirms an enrolment with a code from the authenticator app, then issues recovery codes.
 *
 * If code storage fails the factor is rolled back. A verified factor with no recovery codes
 * is a lockout waiting to happen — better to make the user enrol again than to strand them.
 */
export async function verifyEnrollment(factorId: string, code: string): Promise<string[]> {
  const supabase = createClient()

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw new Error(challengeError.message)

  const { error: verifyError } = await supabase.auth.mfa.verify({
    factorId, challengeId: challenge.id, code,
  })
  if (verifyError) throw new Error(verifyError.message)

  const codes = generateRecoveryCodes()
  const { error: storeError } = await supabase.rpc("store_recovery_codes", { codes })
  if (storeError) {
    await supabase.auth.mfa.unenroll({ factorId })
    throw new Error(storeError.message)
  }

  return codes
}

export async function listFactors(): Promise<{ id: string; friendlyName: string | null }[]> {
  const { data, error } = await createClient().auth.mfa.listFactors()
  if (error) throw new Error(error.message)
  return (data.totp ?? []).map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null }))
}

export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await createClient().auth.mfa.unenroll({ factorId })
  if (error) throw new Error(error.message)
}

export async function currentAal(): Promise<{ current: string | null; next: string | null }> {
  const { data, error } = await createClient().auth.mfa.getAuthenticatorAssuranceLevel()
  if (error) throw new Error(error.message)
  return { current: data.currentLevel, next: data.nextLevel }
}

/** Signs a challenge with a recovery code instead of a TOTP code. */
export async function redeemRecoveryCode(code: string): Promise<boolean> {
  const { data, error } = await createClient()
    .rpc("redeem_recovery_code", { code: normaliseRecoveryCode(code) })
  if (error) throw new Error(error.message)
  return data === true
}

export async function recoveryCodesRemaining(): Promise<number> {
  const { data, error } = await createClient().rpc("recovery_codes_remaining")
  if (error) throw new Error(error.message)
  return data ?? 0
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test lib/auth/mfa.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Regenerate database types so the RPCs are typed**

```bash
npx supabase gen types typescript --local > types/supabase.ts
```

- [ ] **Step 6: Build the recovery codes dialog**

Create `components/auth/recovery-codes-dialog.tsx`:

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"

interface RecoveryCodesDialogProps {
  open: boolean
  codes: string[]
  onClose: () => void
}

/**
 * Shows recovery codes exactly once — only hashes are stored, so there is no
 * second chance. Closing is gated on an explicit acknowledgement.
 */
export function RecoveryCodesDialog({ open, codes, onClose }: RecoveryCodesDialogProps) {
  const [acknowledged, setAcknowledged] = useState(false)

  function handleDownload() {
    const blob = new Blob(
      [`Retirement Calculator recovery codes\n\nEach code works once.\n\n${codes.join("\n")}\n`],
      { type: "text/plain" },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "retirement-calculator-recovery-codes.txt"
    a.click()
    URL.revokeObjectURL(url)
    setAcknowledged(true)
  }

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogTitle className="text-base font-semibold">Save your recovery codes</DialogTitle>
        <DialogDescription className="text-xs text-muted-foreground">
          These are shown once and never again. Each works a single time. Without them, a lost
          authenticator means losing access to your account.
        </DialogDescription>

        <div className="grid grid-cols-2 gap-2 rounded-md border bg-muted/30 p-3 font-mono text-sm">
          {codes.map((code) => <span key={code}>{code}</span>)}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={handleDownload}>Download</Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => { void navigator.clipboard.writeText(codes.join("\n")); setAcknowledged(true) }}
          >
            Copy
          </Button>
        </div>

        <Button className="w-full" disabled={!acknowledged} onClick={onClose}>
          {acknowledged ? "I've saved them" : "Download or copy them first"}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 7: Build the enrolment component**

Create `components/auth/mfa-enrollment.tsx`:

```tsx
"use client"

import { useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { enrollTotp, verifyEnrollment, type TotpEnrollment } from "@/lib/auth/mfa"
import { RecoveryCodesDialog } from "./recovery-codes-dialog"

interface MfaEnrollmentProps {
  onEnrolled: () => void
}

export function MfaEnrollment({ onEnrolled }: MfaEnrollmentProps) {
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null)
  const [code, setCode] = useState("")
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function start() {
    setLoading(true); setError(null)
    try { setEnrollment(await enrollTotp()) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not start enrolment") }
    finally { setLoading(false) }
  }

  async function confirm() {
    if (!enrollment) return
    setLoading(true); setError(null)
    try { setCodes(await verifyEnrollment(enrollment.factorId, code)) }
    catch (e) { setError(e instanceof Error ? e.message : "Could not verify the code") }
    finally { setLoading(false) }
  }

  if (!enrollment) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Add an authenticator app so a stolen password alone cannot reach your plan.
        </p>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={start} disabled={loading} className="w-full">
          {loading ? "Starting…" : "Set Up Two-Factor Authentication"}
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Scan this with your authenticator app, then enter the six-digit code it shows.
        </p>
        <div className="flex justify-center rounded-md border bg-background p-3">
          <Image src={enrollment.qrCode} alt="TOTP enrolment QR code" width={180} height={180} unoptimized />
        </div>
        <p className="text-center font-mono text-xs text-muted-foreground break-all">
          {enrollment.secret}
        </p>
        <div className="space-y-1">
          <Label htmlFor="totp-code" className="text-xs font-medium">Six-digit code</Label>
          <Input id="totp-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className={`h-8 text-sm ${error ? "border-destructive" : ""}`} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <Button onClick={confirm} disabled={loading || code.length !== 6} className="w-full">
          {loading ? "Verifying…" : "Verify & Enable"}
        </Button>
      </div>

      <RecoveryCodesDialog
        open={codes !== null}
        codes={codes ?? []}
        onClose={() => { setCodes(null); onEnrolled() }}
      />
    </>
  )
}
```

- [ ] **Step 8: Add a Security section to the profile modal**

Create `components/auth/security-section.tsx`, and render `<SecuritySection />` inside `ProfileModal`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { PageCard } from "@/components/ui/page-card"
import { listFactors, recoveryCodesRemaining, unenrollTotp } from "@/lib/auth/mfa"
import { MfaEnrollment } from "./mfa-enrollment"
import { ReauthenticateDialog } from "./reauthenticate-dialog"

export function SecuritySection({ email }: { email: string }) {
  const [factorId, setFactorId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [confirmingDisable, setConfirmingDisable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const factors = await listFactors()
      setFactorId(factors[0]?.id ?? null)
      setRemaining(factors.length > 0 ? await recoveryCodesRemaining() : null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load security settings.")
    }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  async function disable() {
    if (!factorId) return
    try {
      await unenrollTotp(factorId)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not disable two-factor authentication.")
    }
  }

  return (
    <PageCard label="Security" contentClassName="space-y-3">
      {error && <p className="text-xs text-destructive">{error}</p>}

      {factorId === null ? (
        <MfaEnrollment onEnrolled={refresh} />
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            Two-factor authentication is on. Sign-in requires a code from your authenticator app.
          </p>
          {remaining !== null && (
            <p className={`text-xs ${remaining <= 2 ? "text-destructive" : "text-muted-foreground"}`}>
              {remaining} recovery {remaining === 1 ? "code" : "codes"} remaining
              {remaining <= 2 && " — disable and re-enrol to get a fresh set."}
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={() => setConfirmingDisable(true)}>
            Disable Two-Factor Authentication
          </Button>
        </>
      )}

      <ReauthenticateDialog
        open={confirmingDisable}
        email={email}
        action="disable two-factor authentication"
        onCancel={() => setConfirmingDisable(false)}
        onConfirmed={() => { setConfirmingDisable(false); void disable() }}
      />
    </PageCard>
  )
}
```

Add `components/auth/security-section.tsx` to this task's commit.

- [ ] **Step 9: Verify**

Run: `pnpm test && pnpm typecheck && pnpm build`

Then manually: sign up, open Manage Account, enrol with a real authenticator app, confirm the recovery codes appear once and the dialog cannot be dismissed until downloaded or copied.

- [ ] **Step 10: Commit**

```bash
git add lib/auth/mfa.ts lib/auth/mfa.test.ts components/auth/mfa-enrollment.tsx components/auth/recovery-codes-dialog.tsx components/auth/security-section.tsx components/auth/profile-modal.tsx types/supabase.ts
git commit -m "feat(auth): TOTP enrolment with one-time recovery codes"
```

---

### Task 9: MFA challenge on sign-in

**Files:**
- Create: `app/auth/mfa/page.tsx`
- Modify: `lib/supabase/proxy.ts:36`
- Create: `e2e/journeys/03-two-factor.spec.ts`

**Interfaces:**
- Consumes: `listFactors()`, `redeemRecoveryCode()` from `lib/auth/mfa`; `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` directly in middleware (the `lib/auth/mfa` wrappers use the browser client and cannot be called from `proxy.ts`).
- Produces: route `/auth/mfa`; middleware contract — any request to `/calculator/*` where `currentLevel === 'aal1'` and `nextLevel === 'aal2'` redirects to `/auth/mfa`.

- [ ] **Step 1: Add the AAL gate to middleware**

In `lib/supabase/proxy.ts`, replace line 36 (`await supabase.auth.getUser()`) with:

```typescript
  const { data: { user } } = await supabase.auth.getUser()

  // UX only. The real enforcement is public.mfa_satisfied() in RLS — a client that
  // ignores this redirect and calls PostgREST directly still gets zero rows.
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    const needsSecondFactor = aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2"
    const path = request.nextUrl.pathname

    if (needsSecondFactor && !path.startsWith("/auth/")) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/mfa"
      url.search = ""
      return NextResponse.redirect(url)
    }
    if (!needsSecondFactor && path === "/auth/mfa") {
      const url = request.nextUrl.clone()
      url.pathname = "/calculator"
      url.search = ""
      return NextResponse.redirect(url)
    }
  }
```

- [ ] **Step 2: Build the challenge page**

Create `app/auth/mfa/page.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { listFactors, redeemRecoveryCode } from "@/lib/auth/mfa"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PageCard } from "@/components/ui/page-card"

export default function MfaChallengePage() {
  const router = useRouter()
  const [factorId, setFactorId] = useState<string | null>(null)
  const [mode, setMode] = useState<"totp" | "recovery">("totp")
  const [value, setValue] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listFactors()
      .then((factors) => {
        if (factors.length === 0) router.replace("/calculator")
        else setFactorId(factors[0].id)
      })
      .catch(() => setError("Could not load your authentication factors."))
  }, [router])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!factorId) return
    setLoading(true); setError(null)

    try {
      if (mode === "recovery") {
        const ok = await redeemRecoveryCode(value)
        if (!ok) {
          setError("That recovery code is not valid, or has already been used.")
          return
        }
      } else {
        const supabase = createClient()
        const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
        if (cErr) { setError(cErr.message); return }
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId, challengeId: challenge.id, code: value,
        })
        if (vErr) { setError("That code is not correct."); return }
      }
      router.replace("/calculator")
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md items-center px-4">
      <PageCard label="Two-Factor Authentication" contentClassName="space-y-4" className="w-full">
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="mfa-input" className="text-xs font-medium">
              {mode === "totp" ? "Code from your authenticator app" : "Recovery code"}
            </Label>
            <Input id="mfa-input" autoFocus autoComplete="one-time-code"
              inputMode={mode === "totp" ? "numeric" : "text"}
              maxLength={mode === "totp" ? 6 : 11}
              value={value}
              onChange={(e) => setValue(mode === "totp" ? e.target.value.replace(/\D/g, "") : e.target.value)}
              className={`h-8 text-sm ${error ? "border-destructive" : ""}`} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading || value.length === 0}>
            {loading ? "Verifying…" : "Verify"}
          </Button>
        </form>
        <button type="button"
          onClick={() => { setMode(mode === "totp" ? "recovery" : "totp"); setValue(""); setError(null) }}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">
          {mode === "totp" ? "Use a recovery code instead" : "Use your authenticator app instead"}
        </button>
      </PageCard>
    </div>
  )
}
```

- [ ] **Step 3: Write the e2e test**

Create `e2e/journeys/03-two-factor.spec.ts`. Generate TOTP codes in-test with `otplib` (`pnpm add -D otplib`):

```typescript
import { test, expect } from "@playwright/test"
import { authenticator } from "otplib"

test("enrolling in 2FA gates the next sign-in", async ({ page }) => {
  const email = `mfa-${Date.now()}@test.local`
  const password = "StrongPassword123"

  await page.goto("/calculator")
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByRole("button", { name: /sign up/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /create account/i }).click()

  await page.getByRole("button", { name: new RegExp(email, "i") }).click()
  await page.getByRole("menuitem", { name: /manage account/i }).click()
  await page.getByRole("button", { name: /set up two-factor/i }).click()

  const secret = await page.locator("p.font-mono").innerText()
  await page.getByLabel("Six-digit code").fill(authenticator.generate(secret.trim()))
  await page.getByRole("button", { name: /verify & enable/i }).click()

  const codeCells = page.locator(".font-mono span")
  await expect(codeCells).toHaveCount(10)
  const recoveryCode = await codeCells.first().innerText()
  await page.getByRole("button", { name: /^copy$/i }).click()
  await page.getByRole("button", { name: /i've saved them/i }).click()

  // Sign out, then back in — must be stopped at the challenge.
  await page.getByRole("button", { name: new RegExp(email, "i") }).click()
  await page.getByRole("menuitem", { name: /sign out/i }).click()
  await page.getByRole("button", { name: /sign in/i }).click()
  await page.getByLabel("Email").fill(email)
  await page.getByLabel("Password").fill(password)
  await page.getByRole("button", { name: /^sign in$/i }).click()

  await expect(page).toHaveURL(/\/auth\/mfa/)

  // A recovery code gets in, and is then spent.
  await page.getByRole("button", { name: /use a recovery code/i }).click()
  await page.getByLabel("Recovery code").fill(recoveryCode)
  await page.getByRole("button", { name: /verify/i }).click()
  await expect(page).toHaveURL(/\/calculator/)
})
```

- [ ] **Step 4: Run it**

Run: `npx playwright test e2e/journeys/03-two-factor.spec.ts --project=desktop-chrome`
Expected: PASS.

- [ ] **Step 5: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`

```bash
git add app/auth/mfa/page.tsx lib/supabase/proxy.ts e2e/journeys/03-two-factor.spec.ts package.json
git commit -m "feat(auth): challenge for second factor on sign-in"
```

---

### Task 10: Session and device management

**Files:**
- Create: `supabase/migrations/20260802000300_user_sessions_rpc.sql`
- Create: `components/auth/session-list.tsx`
- Modify: `supabase/config.toml`
- Modify: `components/auth/profile-modal.tsx`

**Interfaces:**
- Consumes: `auth.sessions`.
- Produces: RPC `public.my_sessions() returns table (id uuid, created_at timestamptz, updated_at timestamptz, user_agent text, ip inet, is_current boolean)`.

- [ ] **Step 1: Set session timeouts**

In `supabase/config.toml`, uncomment and set `[auth.sessions]`:

```toml
[auth.sessions]
timebox = "168h"
inactivity_timeout = "12h"
```

- [ ] **Step 2: Write the RPC migration**

Create `supabase/migrations/20260802000300_user_sessions_rpc.sql`:

```sql
-- auth.sessions is not exposed through PostgREST, so device listing needs an
-- explicit, tightly-scoped accessor. It returns the caller's own sessions only.

create or replace function public.my_sessions()
returns table (
  id         uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip         inet,
  is_current boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select s.id,
         s.created_at,
         s.updated_at,
         s.user_agent,
         s.ip,
         s.id = ((select auth.jwt() ->> 'session_id'))::uuid as is_current
  from auth.sessions s
  where s.user_id = (select auth.uid())
  order by s.updated_at desc;
$$;

revoke all on function public.my_sessions() from public;
grant execute on function public.my_sessions() to authenticated;
```

- [ ] **Step 3: Append an isolation test**

Append to `supabase/tests/rls_mfa.test.sql`, before `rollback;`:

```sql
-- my_sessions() must never leak another user's sessions.
set local role postgres;
insert into auth.sessions (id, user_id, created_at, updated_at)
values ('44444444-4444-4444-4444-444444444444',
        '11111111-1111-1111-1111-111111111111', now(), now());

set local role authenticated;
set local request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated","aal":"aal1"}';
do $$ begin
  if (select count(*) from public.my_sessions()) <> 0 then
    raise exception 'FAIL: my_sessions() leaks other users sessions';
  end if;
end $$;
```

- [ ] **Step 4: Build the session list**

Create `components/auth/session-list.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"

interface SessionRow {
  id: string
  updated_at: string
  user_agent: string | null
  ip: string | null
  is_current: boolean
}

export function SessionList() {
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().rpc("my_sessions").then(({ data, error: rpcError }) => {
      if (rpcError) setError("Could not load your active sessions.")
      else setSessions((data ?? []) as SessionRow[])
    })
  }, [])

  async function signOutEverywhere() {
    await createClient().auth.signOut({ scope: "global" })
    window.location.href = "/calculator"
  }

  if (error) return <p className="text-xs text-destructive">{error}</p>

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {sessions.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 rounded-md border px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {s.user_agent ?? "Unknown device"}
                {s.is_current && <span className="ml-2 text-primary">This device</span>}
              </p>
              <p className="text-xs text-muted-foreground">
                {s.ip ?? "unknown IP"} · last active {new Date(s.updated_at).toLocaleString("en-ZA")}
              </p>
            </div>
          </li>
        ))}
      </ul>
      <Button variant="outline" className="w-full" onClick={signOutEverywhere}>
        Sign Out Everywhere
      </Button>
    </div>
  )
}
```

- [ ] **Step 5: Mount it in the profile modal**

Add a `<PageCard label="Active Sessions">` section rendering `<SessionList />`.

- [ ] **Step 6: Verify and commit**

Run: `npx supabase db reset && pnpm test:rls && pnpm test && pnpm typecheck && pnpm build`

```bash
git add supabase/migrations/20260802000300_user_sessions_rpc.sql components/auth/session-list.tsx components/auth/profile-modal.tsx supabase/config.toml supabase/tests/rls_mfa.test.sql
git commit -m "feat(auth): session listing, sign out everywhere, session timeouts"
```

---

### Task 11: Account deletion and data export

**Files:**
- Create: `app/api/account/delete/route.ts`
- Create: `app/api/account/export/route.ts`
- Modify: `components/auth/profile-modal.tsx`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY` (server-only — never `NEXT_PUBLIC_`), FK cascades from Task 3, `mfa_satisfied()` from Task 4.
- Produces: `DELETE /api/account/delete`, `GET /api/account/export`.

- [ ] **Step 1: Add the env var**

Append to `.env.example`:

```bash
# ── Service role (server-only, never exposed to the browser) ──────────────────
# Required for account deletion. Local value comes from `npx supabase status`.
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Write the deletion route**

Create `app/api/account/delete/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

/**
 * Self-serve account deletion. POPIA gives users a right to erasure, and this is
 * the path that honours it.
 *
 * Row deletion happens by cascade: auth.users -> scenarios -> accounts, and
 * auth.users -> expense_groups -> expenses (migration 20260802000000).
 */
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  // If a second factor is enrolled, deletion requires it. Otherwise a stolen
  // password could destroy the account that 2FA exists to protect.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2") {
    return NextResponse.json({ error: "Two-factor verification required" }, { status: 403 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!serviceKey || !url) {
    return NextResponse.json({ error: "Server not configured for deletion" }, { status: 500 })
  }

  const admin = createAdminClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase.auth.signOut({ scope: "global" })
  return NextResponse.json({ deleted: true })
}
```

- [ ] **Step 3: Write the export route**

Create `app/api/account/export/route.ts`:

```typescript
import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** POPIA data portability: everything the account holds, as JSON. */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const [scenarios, expenseGroups, expenses] = await Promise.all([
    supabase.from("scenarios").select("*").eq("session_id", user.id),
    supabase.from("expense_groups").select("*").eq("session_id", user.id),
    supabase.from("expenses").select("*").eq("session_id", user.id),
  ])

  const scenarioIds = (scenarios.data ?? []).map((s) => s.id)
  const accounts = scenarioIds.length
    ? await supabase.from("accounts").select("*").in("scenario_id", scenarioIds)
    : { data: [] }

  const payload = {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email, createdAt: user.created_at },
    scenarios: scenarios.data ?? [],
    accounts: accounts.data ?? [],
    expenseGroups: expenseGroups.data ?? [],
    expenses: expenses.data ?? [],
  }

  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="retirement-calculator-export-${Date.now()}.json"`,
    },
  })
}
```

- [ ] **Step 4: Add the Danger Zone to the profile modal**

Using the canonical destructive pattern from CLAUDE.md:

```tsx
<PageCard label="Danger Zone" labelVariant="destructive"
  className="border-destructive/40" contentClassName="space-y-3">
  <p className="text-xs text-muted-foreground">
    Deleting your account removes every scenario, account and expense permanently.
    This cannot be undone. Export your data first if you want a copy.
  </p>
  <Button variant="outline" className="w-full" asChild>
    <a href="/api/account/export" download>Export My Data</a>
  </Button>
  <Button variant="destructive" className="w-full"
    onClick={() => setPendingAction({ kind: "delete" })}>
    Delete My Account
  </Button>
</PageCard>
```

Extend `pendingAction` with `{ kind: "delete" }`, wire it through `ReauthenticateDialog` with `action="delete your account permanently"`, and on confirmation call:

```tsx
async function runDelete() {
  const res = await fetch("/api/account/delete", { method: "DELETE" })
  if (!res.ok) {
    const { error } = await res.json()
    setPwMsg({ type: "error", text: error ?? "Could not delete the account." })
    return
  }
  localStorage.clear()
  window.location.href = "/calculator"
}
```

- [ ] **Step 5: Verify manually**

With `SUPABASE_SERVICE_ROLE_KEY` set from `npx supabase status`: create an account, add a scenario and expenses, export (confirm the JSON contains them), then delete. Verify in Studio that `auth.users`, `scenarios`, `accounts`, `expense_groups` and `expenses` all have zero rows for that user.

- [ ] **Step 6: Verify and commit**

Run: `pnpm test && pnpm typecheck && pnpm build`

```bash
git add app/api/account/delete/route.ts app/api/account/export/route.ts components/auth/profile-modal.tsx .env.example
git commit -m "feat(auth): self-serve account deletion and data export"
```

---

### Task 12: Security headers and CSP

**Files:**
- Create: `lib/security/headers.ts`
- Create: `lib/security/headers.test.ts`
- Modify: `lib/supabase/proxy.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`.
- Produces: `buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string`, `SECURITY_HEADERS: Record<string, string>`.

- [ ] **Step 1: Write the failing test**

Create `lib/security/headers.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCsp, SECURITY_HEADERS } from './headers'

const SUPABASE = 'https://abc.supabase.co'

function directive(csp: string, name: string): string {
  const found = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `))
  if (!found) throw new Error(`No ${name} directive in CSP`)
  return found
}

describe('buildCsp', () => {
  it('binds script-src to the request nonce', () => {
    expect(directive(buildCsp('abc123', SUPABASE, false), 'script-src')).toContain("'nonce-abc123'")
  })

  it('allows the Supabase origin to be contacted', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'connect-src')).toContain(SUPABASE)
  })

  it('blocks framing entirely', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'frame-ancestors')).toContain("'none'")
  })

  it('restricts form submission to the same origin', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'form-action')).toContain("'self'")
  })

  it('does not permit unsafe-eval in production', () => {
    expect(buildCsp('n', SUPABASE, false)).not.toContain("'unsafe-eval'")
  })

  it('permits unsafe-eval in development for React refresh', () => {
    expect(directive(buildCsp('n', SUPABASE, true), 'script-src')).toContain("'unsafe-eval'")
  })

  it('allows the data: URIs used by TOTP QR codes', () => {
    expect(directive(buildCsp('n', SUPABASE, false), 'img-src')).toContain('data:')
  })
})

describe('SECURITY_HEADERS', () => {
  it('denies framing', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('sets a two-year HSTS max-age including subdomains', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=63072000')
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toContain('includeSubDomains')
  })

  it('blocks MIME sniffing', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })

  it('does not leak full URLs cross-origin', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })
})
```

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm test lib/security/headers.test.ts`
Expected: FAIL — `Failed to resolve import "./headers"`.

- [ ] **Step 3: Implement**

Create `lib/security/headers.ts`:

```typescript
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
}

/**
 * Per-request CSP. The nonce must be generated per request and threaded into
 * Next's script tags — a static nonce is no better than 'unsafe-inline'.
 *
 * style-src keeps 'unsafe-inline': Next.js and Tailwind both emit inline styles,
 * and there is no nonce hook for them. Inline styles are a materially smaller
 * risk than inline scripts.
 */
export function buildCsp(nonce: string, supabaseUrl: string, isDev: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    "https://challenges.cloudflare.com",
    // React Fast Refresh compiles with eval in development only.
    isDev ? "'unsafe-eval'" : "",
  ].filter(Boolean).join(" ")

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    // data: covers the TOTP enrolment QR code, which is an inline SVG data URI.
    `img-src 'self' data: blob:`,
    `font-src 'self' data:`,
    `connect-src 'self' ${supabaseUrl} https://vitals.vercel-insights.com`,
    `frame-src https://challenges.cloudflare.com`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ")
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm test lib/security/headers.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Apply the headers in middleware**

In `lib/supabase/proxy.ts`, at the top of `updateSession`:

```typescript
  const nonce = crypto.randomUUID().replace(/-/g, "")
  const isDev = process.env.NODE_ENV === "development"

  // Next reads x-nonce to stamp its own script tags.
  request.headers.set("x-nonce", nonce)
```

and before each `return`, apply:

```typescript
  function applySecurityHeaders(response: NextResponse): NextResponse {
    Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
    response.headers.set(
      "Content-Security-Policy",
      buildCsp(nonce, process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", isDev),
    )
    return response
  }
```

Wrap every returned response in `applySecurityHeaders(...)`.

- [ ] **Step 6: Verify no CSP violations**

Run `pnpm build && pnpm start`, load `/calculator`, and check the browser console. Expected: zero `Refused to …` CSP errors. Walk sign-in, MFA enrolment (the QR must render) and the reset page. Any violation means a missing directive — fix `buildCsp` and add a test for it, do not widen to `'unsafe-inline'` on scripts.

- [ ] **Step 7: Commit**

```bash
git add lib/security/headers.ts lib/security/headers.test.ts lib/supabase/proxy.ts
git commit -m "feat(security): nonce-based CSP and security headers"
```

---

### Task 13: Bot protection

**Files:**
- Create: `components/auth/turnstile.tsx`
- Modify: `components/auth/auth-modal.tsx`
- Modify: `supabase/config.toml`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`.
- Produces: `<Turnstile onToken={(token: string) => void} />`.

- [ ] **Step 1: Add config and env**

In `supabase/config.toml`:

```toml
[auth.captcha]
enabled = true
provider = "turnstile"
secret = "env(TURNSTILE_SECRET_KEY)"
```

Append to `.env.example`:

```bash
# ── Cloudflare Turnstile (bot protection on auth forms) ──────────────────────
# Test keys that always pass: https://developers.cloudflare.com/turnstile/troubleshooting/testing/
NEXT_PUBLIC_TURNSTILE_SITE_KEY=1x00000000000000000000AA
TURNSTILE_SECRET_KEY=1x0000000000000000000000000000000AA
```

- [ ] **Step 2: Build the widget**

Create `components/auth/turnstile.tsx`:

```tsx
"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string
      remove: (id: string) => void
    }
  }
}

/**
 * Renders the Turnstile widget and hands the resulting token to the caller,
 * which passes it to Supabase as options.captchaToken.
 *
 * Renders nothing when no site key is configured, so local development without
 * Turnstile keys still works.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !ref.current) return

    function render() {
      if (!window.turnstile || !ref.current || widgetId.current) return
      widgetId.current = window.turnstile.render(ref.current, { sitekey: siteKey!, callback: onToken })
    }

    if (window.turnstile) {
      render()
    } else {
      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey, onToken])

  if (!siteKey) return null
  return <div ref={ref} className="flex justify-center" />
}
```

- [ ] **Step 3: Wire it into the auth modal**

Add `const [captchaToken, setCaptchaToken] = useState<string | undefined>()`, render `<Turnstile onToken={setCaptchaToken} />` above the submit button in all three forms, and pass the token:

```typescript
await supabase.auth.signInWithPassword({
  email: values.email, password: values.password, options: { captchaToken },
})
await supabase.auth.signUp({
  email: values.email, password: values.password,
  options: { captchaToken, emailRedirectTo: `${window.location.origin}/auth/callback` },
})
await supabase.auth.resetPasswordForEmail(values.email, {
  captchaToken, redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
})
```

- [ ] **Step 4: Verify**

Run: `npx supabase db reset && pnpm test && pnpm typecheck && pnpm build`

Then manually: with the test keys above, sign-up and sign-in must still succeed. Confirm the widget renders and the CSP does not block `challenges.cloudflare.com`.

- [ ] **Step 5: Commit**

```bash
git add components/auth/turnstile.tsx components/auth/auth-modal.tsx supabase/config.toml .env.example
git commit -m "feat(security): Turnstile bot protection on auth forms"
```

---

### Task 14: Documentation

Required by CLAUDE.md rule 2.

**Files:**
- Modify: `docs/project-phases/phase-3-user-accounts.md`
- Modify: `docs/project-phases.md`
- Create: `docs/history/2026-08-02-auth-hardening-2fa.md`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Rewrite the phase doc**

`docs/project-phases/phase-3-user-accounts.md` currently documents the anonymous-first model as complete. Mark the anonymous-first section superseded, and record what replaced it: login-required-for-persistence, `claimLocalData()`, TOTP with recovery codes, RLS-level AAL enforcement, session management, account deletion. Move "Protected routes" from Pending to Completed. Keep Google OAuth in Pending.

Delete the now-false Key Design Decision "Anonymous-first: App works without auth. Anonymous session created on first load" and replace with:

```markdown
- **Local-first, not anonymous-first**: the calculator runs from localStorage with no
  `auth.users` row. On first sign-in, `claimLocalData()` migrates local work up — but only
  when the account has zero scenarios server-side. Never merges; the server always wins for
  an established account.
- **2FA is enforced in RLS, not middleware**: `public.mfa_satisfied()` is referenced by every
  table policy. The middleware redirect to `/auth/mfa` is UX. Because the publishable key
  ships in the client bundle, middleware-only enforcement would be bypassable by calling
  PostgREST directly.
- **Recovery codes are custom**: Supabase provides none. 10 per user, `crypt()`-hashed,
  single-use, shown exactly once.
```

- [ ] **Step 2: Add the history entry**

Create `docs/history/2026-08-02-auth-hardening-2fa.md` covering: the broken reset flow and why it was a passwordless login; the missing FKs to `auth.users` and the orphan rows they caused; why AAL enforcement belongs in RLS; the claim-on-signup rule and the data-loss reasoning behind refusing to merge.

- [ ] **Step 3: Update the status summary**

Add a dated entry to "Current Status Summary" in `docs/project-phases.md` and update the Phase 3 status emoji from 🔄 to ✅.

- [ ] **Step 4: Update CLAUDE.md**

Add to the Dev Commands block:

```bash
pnpm test:rls            # RLS + AAL policy tests (needs local Supabase running)
```

Add to Common Pitfalls:

```markdown
- ❌ Don't enforce authorization in `proxy.ts` alone — the publishable key is in the client
  bundle, so anyone can call PostgREST directly. RLS is the boundary; middleware is UX.
- ❌ Don't add a policy without `public.mfa_satisfied()` — a new table without it is a 2FA
  bypass for every row in it.
```

- [ ] **Step 5: Commit**

```bash
git add docs/ CLAUDE.md
git commit -m "docs: record auth hardening and 2FA architecture"
```

---

### Task 15: Full verification

- [ ] **Step 1: Reset and run everything**

```bash
npx supabase db reset
pnpm test
pnpm test:coverage
pnpm test:rls
pnpm typecheck
pnpm lint
pnpm build
npx playwright test --project=desktop-chrome
```

Expected: all green. Coverage on `lib/supabase/claim.ts`, `lib/auth/*.ts` and `lib/security/headers.ts` above 90%.

- [ ] **Step 2: Check the Supabase advisors**

Use the `mcp__supabase-local__get_advisors` tool for both `security` and `performance`. Expected: no new errors. `mfa_satisfied()` and the RPCs are `security definer` with `set search_path = ''`, which is what the advisor checks for.

- [ ] **Step 3: Walk the flows manually**

1. Signed out — enter a plan, reload, data survives in localStorage, no `auth.users` row created
2. Sign up — local plan is claimed into the account
3. Enrol 2FA — recovery codes shown once, dialog cannot be dismissed unsaved
4. Sign out, sign in — challenged at `/auth/mfa`
5. Sign in with a recovery code — works once, then dead
6. Forgot password — reset page appears, old password stops working
7. Manage Account — password change demands the current password
8. Sessions listed, "Sign Out Everywhere" works
9. Export produces complete JSON; deletion leaves zero rows anywhere
10. Browser console shows no CSP violations on any screen

- [ ] **Step 4: Confirm 2FA actually holds at the API**

The claim this whole plan rests on. With a 2FA-enrolled account signed in at `aal1`, take the access token from the browser's storage and call PostgREST directly:

```bash
curl -s "http://127.0.0.1:54321/rest/v1/scenarios?select=*" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -H "Authorization: Bearer <aal1-access-token>"
```

Expected: `[]`. Anything else means the RLS enforcement is not working and Task 4 must be reopened.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin feature/auth-hardening-2fa
gh pr create --title "Auth hardening and TOTP 2FA" --body "$(cat <<'EOF'
## Summary
Replaces anonymous-first auth with login-required-for-persistence, adds optional TOTP 2FA
enforced at the RLS layer, and fixes a password reset flow that never reset the password.

## Defects fixed
- Password reset link signed users in without ever prompting for a new password
- `scenarios`, `expense_groups` and `expenses` had no FK to `auth.users` — deleting a user
  orphaned every row they owned
- 6-character passwords with no complexity requirement
- Password changeable from a stale session with no reauthentication

## Verification
- `pnpm test`, `pnpm test:rls`, `pnpm typecheck`, `pnpm lint`, `pnpm build`, Playwright — all green
- Direct PostgREST call with an `aal1` token on a 2FA-enrolled account returns `[]`

## Note
Production MFA requires Supabase Pro. Local development is unaffected.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01MoW7RaunoCRZ3ruBQDaDty
EOF
)"
```
