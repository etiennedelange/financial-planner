# Phase 4: Data Persistence ✅ Complete

**Goal:** Save and load user data from database, support named scenarios.

## Completed

- [x] **CRUD operations for accounts** — per-scenario isolation via `scenario_id` FK with CASCADE delete; RLS checks ownership through parent scenario
- [x] **Named scenarios** — `scenarios.name` column; unique constraint on `session_id` dropped; `ScenarioSwitcher` component with inline rename, delete, new scenario creation; shown in header for authenticated users
- [x] **Per-scenario accounts** — accounts linked to scenarios (not users); `createNewScenario` clones all accounts with new UUIDs; `switchScenario` loads that scenario's accounts
- [x] **Auto-save** — 800ms debounce via `scheduleScenarioSync`; syncs settings to active scenario on every input change
- [x] **Import/export plan (JSON)** — `lib/utils/plan-io.ts`; full state round-trip (accounts + all settings); Plan dropdown in header; validated on import with clear error messages
- [x] **Sync state between local and database** — `syncFromDb` on sign-in; first sign-in bootstraps "My Plan" from localStorage state

## Key Design Decisions

- **Accounts are per-scenario, not per-user** — each scenario has its own independent account set; creating a new scenario clones accounts so you start with an identical copy to diverge from
- **Scenario delete cascades** — `ON DELETE CASCADE` on `accounts.scenario_id`; deleting a scenario wipes its accounts automatically
- **Single scenario for anonymous/offline users** — switcher only shown for authenticated non-anonymous users; localStorage fallback still works as before
- **Import/export is scenario-aware** — importing overwrites the active scenario's settings and accounts

## DB Migrations

- `20260509110000_add_scenario_names.sql` — adds `name` column, drops `unique` on `session_id`
- `20260509120000_link_accounts_to_scenarios.sql` — adds `scenario_id` FK, backfills, updates RLS, makes `session_id` nullable
