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

## Completed (2026-04-27) — localStorage fallback

- `SUPABASE_ENABLED` flag exported from `lib/supabase/client.ts` — true only when `NEXT_PUBLIC_SUPABASE_URL` is set
- `createClient()` returns `null` when Supabase is not configured; all functions in `accounts.ts` and `scenarios.ts` early-return on null client
- `SupabaseProvider` skips auth/sync entirely when `SUPABASE_ENABLED` is false
- `accounts` added to Zustand `partialize` so they survive in `localStorage` when Supabase is off
- Effect: local dev uses Supabase; Vercel deployments without the env var fall back to localStorage automatically — no toggle needed

## Completed (2026-06-16) — Anon→Auth Migration & Form Persistence

### Anon→Auth Migration
- `migrateExpensesToSession()` in `lib/supabase/expenses.ts` — copies expense groups and items from anonymous session to authenticated user account on first real login (120 unit tests added)
- `components/supabase-provider.tsx` — calls migration after auth state change (sign-in)
- Effect: users don't lose expense data when converting from anon to paid account

### Form Persistence Fixes
- `components/inputs/personal-info-form.tsx` + `assumptions-form.tsx` — added reset effects to properly restore form state after Zustand hydration
- Fixes issue where form fields showed stale values on page reload even after store was restored
- Ensures "Plan" page forms remain in sync after scenario switches

### Local Development Setup
- `.env.development` now contains `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT anon token) for localhost proxy routing
- Proxy pattern: `localhost:3000/supabase/*` → `localhost:54321/*` (local Supabase API)
- Keeps `NEXT_PUBLIC_SUPABASE_URL` pointed at `http://127.0.0.1:54321` for WSL2 compatibility
- `@supabase/ssr` client detects anon key and routes through proxy automatically

## Pending

- **Phase 3 upgrade path** — when a user signs up, link their authenticated session to accounts/scenarios created as anon (now partially covered by migrateExpensesToSession)
