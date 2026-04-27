# Phase 2: Supabase Integration ✅ Complete

**Goal:** Set up database infrastructure for persistent data storage.

**Tasks:**
- [x] Initialize Supabase project (local, docker-in-docker in devcontainer)
- [x] Design and migrate `accounts` table with RLS
- [x] Anonymous auth — users get a session without signing up
- [x] Implement Row Level Security (RLS) on `accounts` (keyed on `auth.uid()`)
- [x] Wire store account actions to fire-and-forget DB sync
- [x] `scenarios` table (save/load full calculator state)
- [x] TypeScript type generation from DB schema (`supabase gen types`)

## Completed (2026-04-19)

### Infrastructure
- Added `docker-in-docker` feature to `.devcontainer/devcontainer.json`
- Local Supabase stack running on default ports (API: 54321, Studio: 54323)
- Anonymous sign-ins enabled in `supabase/config.toml`

### Database
- Migration: `supabase/migrations/20260419212359_create_accounts_table.sql`
- `accounts` table uses `session_id` (= `auth.uid()`) instead of `user_id` — compatible with both anonymous and future authenticated users
- RLS policy: users can only read/write their own accounts
- `updated_at` trigger auto-maintained

### Application layer
- `lib/supabase/client.ts` — browser Supabase client via `@supabase/ssr`
- `lib/supabase/accounts.ts` — `fetchAccounts`, `upsertAccount`, `deleteAccount` with camelCase↔snake_case mapping
- `components/supabase-provider.tsx` — signs in anonymously on mount, hydrates accounts from DB into store
- `lib/store/calculator-store.ts` — added `sessionId`, `setSessionId`, `syncAccountsFromDb`; account mutations fire-and-forget to DB
- `.env.local` — `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Completed (2026-04-27)

### Scenarios table
- Migration: `supabase/migrations/20260427000000_create_scenarios_table.sql`
- `scenarios` table: one row per session, JSONB columns for all calculator state, `session_id unique` for upsert-on-conflict
- RLS policy mirrors accounts: users can only read/write their own scenario
- Reuses existing `update_updated_at` trigger

### Application layer
- `lib/supabase/scenarios.ts` — `fetchScenario`, `upsertScenario` with camelCase↔snake_case mapping
- `lib/store/calculator-store.ts` — added `syncScenarioFromDb`; all setters (`setPersonalInfo`, `setRetirementGoals`, `setAssumptions`, `setDrawdownConfig`, `setDisplayMode`) fire debounced 800ms upsert
- `components/supabase-provider.tsx` — loads accounts and scenario in parallel on session init

### TypeScript types
- `types/supabase.ts` — generated via `npx supabase gen types typescript --local`

## Pending

- **Phase 3 upgrade path** — when a user signs up, link their anonymous session to a real account so data is not lost
