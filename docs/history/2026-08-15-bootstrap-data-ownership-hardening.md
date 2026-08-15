# Bootstrap and Data Ownership Hardening — Implemented

## What changed

Phase 9.4 replaced the overlapping hydration, auth-callback, database-sync, and
route-specific persistence paths with **one serialized bootstrap coordinator**,
implemented as an XState 5 state machine, and made guest/user data ownership
explicit at every layer.

### Single bootstrap owner (`lib/auth/`)

- `bootstrap-machine.ts` — the state chart: `hydratingGuest → authenticating →
  hydratingUser → applyingTransition → checkingAal → syncing/ready/
  mfaRequired/error`. Two design properties carry the plan's guarantees:
  - **Event capture during hydration.** `hydratingGuest`/`hydratingUser` use
    target-less `AUTH_EVENT` handlers, so supabase-js's `INITIAL_SESSION`
    (which arrives mid-guest-hydration because the listener registers before
    `start()`) can never cancel the one-time legacy migration; captured events
    are applied after the hydration settles.
  - **Superseded-transition cancellation.** A newer `AUTH_EVENT` re-targets
    `authenticating` from any non-hydration state (including `error`, which is
    deliberately not final), stopping the superseded state's in-flight actor.
  - The claim/sync guard is a visible transition guard: only
    `SIGNED_IN`/`INITIAL_SESSION` with a userId change reach `syncing`;
    `TOKEN_REFRESHED`/`USER_UPDATED`/`PASSWORD_RECOVERY` never re-claim or
    re-sync.
- `bootstrap-coordinator.ts` — thin adapter exposing `getState`/`start`/
  `enqueueAuthEvent`/`flush`/`subscribe`; pre-start events are queued and
  delivered one at a time after startup settles (a back-to-back delivery would
  let event B cancel event A's still-resolving identity chain).
- `SupabaseProvider` is now a pure forwarder: its `onAuthStateChange` callback
  captures only the event type + session presence and enqueues into the
  coordinator. All hydration, verified `getUser`, MFA assurance, claim, and
  sync run inside the machine's actors — never inside the auth callback
  (which deadlocks against supabase-js's own init promise). The layout and
  `/print` no longer call `persist.rehydrate()`; they consume the provider's
  readiness (`phase === "ready"`).

### Explicit persistence scopes (`lib/store/`)

- `persistence-scope.ts` — `PersistenceScope` (`guest` | `user:<id>`) with
  scoped storage keys (`retirement-calculator-storage:guest`,
  `...:user:<userId>`, same for `expenses-store-v2`). The scope is set only by
  the coordinator; identity is deliberately not persisted inside the payload.
- `persist-gate.ts` — the write gate now re-closes on every registered
  instance whenever the scope switches, so the window between
  `setScope(user)` and the user-scoped rehydrate settling cannot leak guest
  state into the user's key (the plan's highest-risk interaction).
- `legacy-scope-migration.ts` — one-time read-and-move of the un-scoped legacy
  keys: a payload with `sessionId` copies into that user's scoped key; a
  `sessionId: null` payload parks in the ambiguous holding area and is never
  auto-claimed. `legacy-local-plan-prompt` offers the explicit
  use-vs-discard choice. Delete-on-success only. Version decision: stores stay
  at `version: 2` (the copy preserves the payload's version, so the R1-trillion
  monetary clamp still runs for v1 payloads).
- `calculator-store.ts` / `expenses-store.ts` — `sessionId` renamed to
  `identity: PersistenceScope`; sign-out clears scenario metadata, cancels
  pending debounce timers, switches back to the guest scope, and evicts the
  signed-out user's scoped keys. Every remote mutation captures
  `identity.userId` + `activeScenarioId` before scheduling and re-checks both
  before the request (and after awaits for deleteScenario). `syncFromDb`
  takes explicit `(userId, generation)`; stale responses whose user changed
  or whose generation was superseded are dropped at commit time, and the
  in-flight map is per-(userId, generation).

### Claim and MFA ordering (`lib/supabase/`, `lib/auth/`)

- `claimLocalData(userId, local, source)` — `ClaimSource` is now a required
  argument: only `"guest"` enters the automatic claim path; `"user"` returns
  server-wins; `"legacy-unknown"` is non-claimable until the prompt converts
  it. The pending-claim marker is per-user
  (`rc-pending-claim-scenario-id:<userId>`), so one account's in-flight claim
  can never be resumed by another on a shared device.
- `currentAal()` is token-aware (`getAuthenticatorAssuranceLevel(access_token)`
  — the live `getUser(jwt)` path), matching the middleware fix.
- `app/auth/mfa/page.tsx` — `submit()` no longer silently drops a click that
  lands before the factor list loads; it awaits the in-flight load (via a ref,
  since the closure's `factorId` is stale) and reports a real error if factors
  genuinely fail.

### Regression coverage

- 27 new unit tests across the coordinator, machine, scopes, migration, and
  store guards (incl. the anti-clobber stale-transition contract, the
  scope-switch gate, and stale-generation rejection).
- `e2e/journeys/09-bootstrap-data-ownership.spec.ts` — signed-out reload with
  no user key behind, sign-out eviction, second-user isolation, `/print`
  bootstrap.
- `08-two-factor.spec.ts` — asserts zero plan-table PostgREST requests
  between sign-in and MFA elevation, and that sync runs after elevation;
  `auth-helper` updated for the settings-page enrolment flow.
- `state-manager.ts` — `waitForHydration()` polls the real readiness signal
  (`data-bootstrap-phase="ready"`) instead of a blind sleep; `clearState()`
  clears every scoped key for both stores; seeds the guest-scoped key at the
  current store version.

## Verification

- `npm run test` — 985/985 unit tests
- `npm run test:coverage` — overall branches 85.08% (threshold 85%), store
  files above their documented baseline
- `npm run typecheck`, `npm run lint`, `npm run build` — clean
- `npm run test:rls` — passes against the local Supabase stack
- Journey 08 (MFA) and journey 09 (bootstrap) pass end-to-end
- The other seven state-using journeys still fail on pre-existing staleness
  (charts moved to `/charts` in the 2026-08-09 redesign; accounts-page button
  location; password-reset label ambiguity) — reproduced identically on clean
  main, not caused by this plan.
