# Bootstrap and Data Ownership Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping hydration, auth, and database-sync timing fixes with one serialized bootstrap flow and explicit guest/user data ownership.

**Architecture:** `SupabaseProvider` will own one bootstrap coordinator. The coordinator hydrates both Zustand stores once, resolves the verified auth identity, checks MFA assurance, chooses guest-claim versus server-wins behaviour, and exposes one readiness state. Auth callbacks will only enqueue events; stores will reject stale or unauthenticated remote writes. Persistence will use explicit guest and user scopes so one account's local cache cannot silently become another account's claim.

## Design Decisions (resolved during review)

- **Identity model.** `identity: PersistenceScope` (`{ kind: "guest" }` or `{ kind: "user"; userId: string }`) is the single source of truth for who owns a store instance. It is set only by the coordinator via `setIdentity` and is not itself persisted inside the scoped payload — the storage *key* encodes the scope. The legacy `sessionId` field is removed; its ~40 read sites migrate to `identity.userId` (nullable). Store write-guards capture `identity.userId` + `activeScenarioId` when a write is scheduled and re-check both at fire time, so writes need no generation value.
- **Transition generation is coordinator-only.** Generation is passed down as a parameter to sync functions (`syncFromDb(userId, generation)`, `syncExpensesFromDb(userId, generation)`); no store action reads it directly, so there is no store↔coordinator import cycle.
- **MFA assurance reads are token-aware.** The `currentAal` dependency must call `getAuthenticatorAssuranceLevel(access_token)` (the live `getUser(jwt)` path), never the argument-less cookie-cached form that can report a removed factor as still making `aal2` reachable (see `lib/supabase/proxy.ts`).
- **Legacy migration is a one-time key move, not a `persist` `migrate`.** `persist`'s `migrate` only runs against the current key; scoping introduces *new* keys, so the legacy un-scoped keys (`retirement-calculator-storage`, `expenses-store-v2`) must be read, classified, copied into the correct scoped key, and deleted exactly once before first rehydrate. `migrate`/`version` then apply to scoped keys from then on.
- **Scoped storage is one wrapper with an active scope.** `createGatedPersistStorage` holds a module-level `activeScope`; its `getItem`/`setItem`/`removeItem` compute the scoped key from `activeScope` + the base name zustand passes in. `setScope()` swaps the scope and resets the release flag; the coordinator calls `setScope` then `rehydrate()`. No per-scope storage re-creation.
- **`mfa-required` is a client-side-window gate, not the primary gate.** On a fresh page load, middleware (`lib/supabase/proxy.ts`) redirects a `aal1`+`aal2` session to `/auth/mfa` before the provider mounts; the coordinator's `mfa-required` phase only protects the sign-in-in-place window (client-side `signInWithPassword` before `router.refresh()` redirects).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase `@supabase/ssr` 0.10 / `supabase-js` 2.108+, Zustand `persist`, Vitest + happy-dom, Playwright.

## Global Constraints

- Every calculation-adjacent or data-migration change ships with unit tests.
- The verified identity comes from `supabase.auth.getUser()` outside `onAuthStateChange`; never await Supabase methods inside the auth callback.
- RLS remains the security boundary. Middleware and client readiness states are UX coordination only.
- A user with `currentAal === "aal1"` and `next === "aal2"` must not trigger protected reads, writes, claim operations, or database sync.
- No remote mutation may rely on `activeScenarioId` alone; it must also validate the current authenticated user and the captured transition generation.
- Existing persisted state must be migrated deliberately. Ambiguous legacy state must not be silently claimed by a different account.
- Keep `createGatedPersistStorage` during the transition. Remove it only after the single-bootstrap tests prove that no pre-hydration writer remains.
- Auth callbacks forward the raw Supabase event type (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `INITIAL_SESSION`, `PASSWORD_RECOVERY`). Only a sign-in/sign-out transition runs claim and sync; token-refresh and user-update events must not re-claim or re-sync.
- The legacy un-scoped storage keys are migrated to scoped keys exactly once and deleted on success; a failed migration leaves the legacy key intact for retry.
- Required verification before completion: `npm run test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run build`, and the MFA/RLS test suite when the local Supabase stack is available.
- After implementation, update the dated history record, Phase 3, Phase 4, Phase 9, and the Recent Activity index.

## File Structure

**Create**

| File | Responsibility |
| --- | --- |
| `lib/auth/bootstrap-coordinator.ts` | Single serialized bootstrap and auth-transition state machine |
| `lib/auth/bootstrap-coordinator.test.ts` | Deterministic tests for hydration, auth ordering, MFA gating, and stale transitions |
| `lib/store/persistence-scope.ts` | Guest/user persistence-scope types and scoped storage-key policy |
| `lib/store/persistence-scope.test.ts` | Scope selection and legacy-state migration tests |
| `lib/store/legacy-scope-migration.ts` | One-time read-and-move of the legacy un-scoped keys into scoped keys |
| `lib/store/legacy-scope-migration.test.ts` | Legacy-key classification, copy, and delete-once tests |
| `components/auth/legacy-local-plan-prompt.tsx` | Explicit user choice for ambiguous legacy local state |
| `e2e/journeys/09-bootstrap-data-ownership.spec.ts` | Browser coverage for reload, account switching, MFA, and print bootstrap |
| `docs/history/2026-08-15-bootstrap-data-ownership-hardening-plan.md` | Record the planning decision and scope |

**Modify**

| File | Change |
| --- | --- |
| `components/supabase-provider.tsx` | Register a non-async auth listener and delegate all transitions to the coordinator |
| `app/calculator/layout.tsx` | Consume provider readiness; remove its second store rehydrate path |
| `app/print/print-client.tsx` | Consume provider readiness; remove its standalone rehydrate call |
| `lib/store/persist-gate.ts` | Add scope switching and per-hydration gate reset while retaining the safety invariant |
| `lib/store/calculator-store.ts` | Add explicit identity transitions and guard all delayed/account remote writes |
| `lib/store/expenses-store.ts` | Add explicit identity transitions and guard all delayed/delete remote writes |
| `lib/store/calculator-store.test.ts` | Cover sign-out cleanup, stale syncs, delayed writes, and ownership transitions |
| `lib/store/expenses-store.test.ts` | Cover sign-out cleanup, stale syncs, and guarded deletes |
| `lib/supabase/claim.ts` | Require a guest-owned snapshot and preserve server-wins semantics |
| `lib/supabase/claim.test.ts` | Cover ownership rejection and claim ordering |
| `e2e/helpers/auth-helper.ts` | Add bootstrap-ready assertions; keep the generic dev-overlay dismisser |
| `e2e/journeys/08-two-factor.spec.ts` | Assert that no protected sync runs before MFA elevation |
| `docs/project-phases/phase-3-user-accounts.md` | Add a linked high-priority post-completion auth follow-up |
| `docs/project-phases/phase-4-data-persistence.md` | Add a linked high-priority post-completion persistence follow-up |
| `docs/project-phases/phase-9-site-improvement.md` | Add Phase 9.4 with the high-priority lifecycle item |
| `docs/project-phases.md` | Add the dated Recent Activity entry and keep the latest ten entries |

---

### Task 1: Define the Bootstrap Coordinator Contract

**Files:**

- Create: `lib/auth/bootstrap-coordinator.ts`
- Create: `lib/auth/bootstrap-coordinator.test.ts`

**Interfaces:**

- Consumes: store hydration, verified `getUser`, `currentAal`, guest snapshot, claim, and server-sync functions supplied as dependencies.
- Produces: `BootstrapState`, `getState()`, `start()`, `enqueueAuthEvent()`, and `flush()` for `SupabaseProvider`.

Define the coordinator dependency contract in the same file so the test fixture and provider use the same names:

```typescript
type AuthEventType =
  | "INITIAL_SESSION"
  | "SIGNED_IN"
  | "SIGNED_OUT"
  | "TOKEN_REFRESHED"
  | "USER_UPDATED"
  | "PASSWORD_RECOVERY"

interface AuthEvent {
  type: AuthEventType
  userId: string | null
  hasSession: boolean
}

interface BootstrapDependencies {
  hydrateStores: () => Promise<void>
  getUser: () => Promise<User | null>
  // MUST be token-aware: getAuthenticatorAssuranceLevel(access_token), not the
  // argument-less cookie-cached form (which can report a removed factor as still
  // making aal2 reachable). See lib/supabase/proxy.ts.
  currentAal: () => Promise<{ current: string | null; next: string | null }>
  applyAuthTransition: (event: AuthEvent, generation: number) => Promise<void>
  claimLocalData: (userId: string, source: "guest" | "user" | "legacy-unknown") => Promise<void>
  syncFromDb: (userId: string, generation: number) => Promise<void>
  syncExpensesFromDb: (userId: string, generation: number) => Promise<void>
}
```

Export `createBootstrapCoordinator(dependencies: BootstrapDependencies): BootstrapCoordinator`, where `BootstrapCoordinator` exposes the methods listed above.

Use these states:

```typescript
type BootstrapPhase =
  | "idle"
  | "hydrating"
  | "authenticating"
  | "mfa-required"
  | "syncing"
  | "ready"
  | "error"

interface BootstrapState {
  phase: BootstrapPhase
  userId: string | null
  error: Error | null
}
```

- [ ] **Step 1: Write the failing coordinator tests.**

Create a `makeDependencies()` fixture that implements `BootstrapDependencies`, records each dependency call in an `events` array, and returns deferred promises for hydration, AAL, claim, and sync. Import `User` from `@supabase/supabase-js`. Cover these cases:

```typescript
it("hydrates before resolving auth or claiming local data", async () => {
  const events: string[] = []
  const dependencies = makeDependencies({
    hydrateStores: async () => { events.push("hydrate") },
    getUser: async () => { events.push("getUser"); return null },
  })

  await createBootstrapCoordinator(dependencies).start()

  expect(events).toEqual(["hydrate", "getUser"])
  expect(dependencies.claimLocalData).not.toHaveBeenCalled()
})

it("returns the same startup promise when start is called twice", async () => {
  const coordinator = createBootstrapCoordinator(makeDependencies())

  expect(coordinator.start()).toBe(coordinator.start())
})

it("does not call protected sync while MFA is required", async () => {
  const dependencies = makeDependencies({
    getUser: async () => ({ id: "user-a" } as User),
    currentAal: async () => ({ current: "aal1", next: "aal2" }),
  })
  const coordinator = createBootstrapCoordinator(dependencies)

  await coordinator.start()

  expect(coordinator.getState().phase).toBe("mfa-required")
  expect(dependencies.claimLocalData).not.toHaveBeenCalled()
  expect(dependencies.syncFromDb).not.toHaveBeenCalled()
})

it("processes an auth event only after the callback has returned", async () => {
  let callbackReturned = false
  const dependencies = makeDependencies({
    applyAuthTransition: async () => { expect(callbackReturned).toBe(true) },
  })
  const coordinator = createBootstrapCoordinator(dependencies)

  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
  callbackReturned = true
  await coordinator.flush()

  expect(dependencies.applyAuthTransition).toHaveBeenCalledWith(
    expect.objectContaining({ hasSession: true })
  )
  expect(callbackReturned).toBe(true)
})

it("does not commit a stale transition after a newer user event", async () => {
  const dependencies = makeDependencies()
  const coordinator = createBootstrapCoordinator(dependencies)

  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-b", hasSession: true })
  await coordinator.flush()

  expect(coordinator.getState().userId).toBe("user-b")
})

it("does not report ready when hydration or sync fails", async () => {
  const dependencies = makeDependencies({
    hydrateStores: async () => { throw new Error("storage unavailable") },
  })
  const coordinator = createBootstrapCoordinator(dependencies)

  await expect(coordinator.start()).rejects.toThrow("storage unavailable")
  expect(coordinator.getState().phase).toBe("error")
})

it("does not re-claim or re-sync on a token refresh", async () => {
  const dependencies = makeDependencies({
    getUser: async () => ({ id: "user-a" } as User),
  })
  const coordinator = createBootstrapCoordinator(dependencies)

  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
  coordinator.enqueueAuthEvent({ type: "TOKEN_REFRESHED", userId: "user-a", hasSession: true })
  await coordinator.flush()

  expect(dependencies.claimLocalData).toHaveBeenCalledTimes(1)
  expect(dependencies.syncFromDb).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run the focused tests and confirm they fail for the missing coordinator behaviour.**

Run: `npm run test -- lib/auth/bootstrap-coordinator.test.ts`

Expected: FAIL because the coordinator contract does not exist yet.

- [ ] **Step 3: Implement the coordinator.**

The implementation must:

- Cache one hydration/startup promise.
- Hydrate calculator and expense stores before any identity mutation.
- Register auth events as signals only; process them on a deferred queue after the callback returns.
- Use a monotonically increasing transition generation and check it before every state commit.
- Call `getUser()` outside the auth callback for a verified identity.
- Call `currentAal()` before claim or database sync.
- Stop at `mfa-required` when `currentAal()` is `aal1` and `next` is `aal2`.
- Classify each auth event by `type`: only `SIGNED_IN`/`INITIAL_SESSION` may claim+sync; `TOKEN_REFRESHED`/`USER_UPDATED`/`PASSWORD_RECOVERY` must not.
- Claim only a guest-owned local snapshot, then sync the claimed server state.
- Mark `ready` only after the applicable local and remote work has completed.
- Remain idempotent under React StrictMode's double `useEffect` (two `start()` calls in dev must share one hydration and one startup promise).

- [ ] **Step 4: Run the focused tests and confirm they pass.**

Run: `npm run test -- lib/auth/bootstrap-coordinator.test.ts`

Expected: PASS for all coordinator ordering and stale-transition cases.

---

### Task 2: Make SupabaseProvider the Only Bootstrap Owner

**Files:**

- Modify: `components/supabase-provider.tsx`
- Modify: `app/calculator/layout.tsx`
- Modify: `app/print/print-client.tsx`

**Interfaces:**

- Consumes: the coordinator from Task 1.
- Produces: `useAuth()` state backed by the coordinator's phase and verified user.

- [ ] **Step 1: Extend `lib/auth/bootstrap-coordinator.test.ts` with the provider dependency harness.**

The harness must prove that one coordinator startup calls calculator-store hydration once and expenses-store hydration once, even when the calculator layout also mounts — and that React StrictMode's double `useEffect` in dev still results in a single hydration. The browser journey in Task 6 covers the actual provider/layout composition.

- [ ] **Step 2: Register `onAuthStateChange` immediately with a synchronous callback.**

The callback may capture only the event type and whether a session exists. It must not call `getUser`, `claimLocalData`, `syncFromDb`, `syncExpensesFromDb`, or any other Supabase method.

- [ ] **Step 3: Start the coordinator after listener registration.**

The provider must expose the coordinator phase through `AuthContext`. Define the new context surface explicitly — `{ user, phase, error }` with `isLoaded` derived as `phase === "ready"` (or kept as a separate flag if consumers need it) — and update every `useAuth()` consumer (`sidebar.tsx`, `settings-page.tsx`, `app-shell.tsx`, `print-client.tsx`) in this same task so no consumer breaks mid-transition. Preserve the current full-navigation MFA behaviour so the root provider remounts after elevation.

- [ ] **Step 4: Remove duplicate hydration calls.**

`app/calculator/layout.tsx` must use provider readiness instead of calling either store's `persist.rehydrate()`. `app/print/print-client.tsx` must remove its local rehydrate effect and wait for provider readiness before calculating or printing — including rendering distinct error and `mfa-required` states, not just a loading spinner, so a failed bootstrap does not hang the print route.

- [ ] **Step 5: Run the focused tests and browser smoke checks.**

Run: `npm run test -- lib/auth/bootstrap-coordinator.test.ts lib/store/calculator-store.test.ts lib/store/expenses-store.test.ts`

Expected: no duplicate hydration and no initial render from unhydrated state.

---

### Task 3: Add Explicit Guest/User Persistence Scopes

**Files:**

- Create: `lib/store/persistence-scope.ts`
- Create: `lib/store/persistence-scope.test.ts`
- Create: `components/auth/legacy-local-plan-prompt.tsx`
- Modify: `lib/store/persist-gate.ts`
- Modify: `lib/store/calculator-store.ts`
- Modify: `lib/store/expenses-store.ts`
- Modify: `lib/store/calculator-store.test.ts`
- Modify: `lib/store/expenses-store.test.ts`

**Interfaces:**

- Consumes: verified user IDs and the coordinator's scope transitions.
- Produces: `PersistenceScope = { kind: "guest" } | { kind: "user"; userId: string }` and scoped storage names.

Use separate keys for guest and authenticated data:

```text
retirement-calculator-storage:guest
retirement-calculator-storage:user:<userId>
expenses-store-v2:guest
expenses-store-v2:user:<userId>
```

- [ ] **Step 1: Write scope and migration tests.**

Cover guest keys, user keys, switching users, and the legacy un-scoped keys. A legacy state with a non-null `sessionId` maps to that user's scope; a legacy state with `sessionId: null` is ambiguous and must not be silently auto-claimed by a new account. Add tests that the legacy key is read, copied into the scoped key, and deleted exactly once, and that a failed copy leaves the legacy key intact for retry.

- [ ] **Step 2: Add scope-aware storage as one wrapper with an active scope.**

Keep a single `createGatedPersistStorage` instance holding a module-level `activeScope`. Its `getItem`/`setItem`/`removeItem` compute the scoped key from `activeScope` + the base name zustand passes in; `setScope(scope)` swaps `activeScope` and resets the release flag. The coordinator calls `setScope` before each `rehydrate()`. There is no per-scope storage re-creation, and writes stay gated until that scope's first read settles.

- [ ] **Step 3: Migrate the legacy un-scoped keys once.**

Implement `lib/store/legacy-scope-migration.ts`. Before the first scoped rehydrate, read the legacy keys (`retirement-calculator-storage`, `expenses-store-v2`): a non-null `sessionId` copies into that user's scoped key; `sessionId: null` moves to the ambiguous-legacy holding area (fed to `legacy-local-plan-prompt`), never straight into `claimLocalData`. Delete the legacy key only after a successful copy; on failure leave it intact for retry. Bump the persisted `version` so scoped keys get their own `migrate` from now on.

- [ ] **Step 4: Add the explicit legacy-state choice.**

Render `components/auth/legacy-local-plan-prompt.tsx` when the coordinator detects ambiguous legacy state. The prompt must offer `Use this local plan` and `Keep account data`; it must not claim data merely because a user signed in. Choosing the local plan converts the state to the guest scope and then invokes the normal claim path.

- [ ] **Step 5: Run persistence tests.**

Run: `npm run test -- lib/store/persistence-scope.test.ts lib/store/persist-gate.test.ts lib/store/calculator-store.test.ts lib/store/expenses-store.test.ts`

Expected: user A's local cache is never returned as user B's guest claim, and each scope persists subsequent writes only after hydration.

---

### Task 4: Guard Store Remote Writes and Identity Transitions

**Files:**

- Modify: `lib/store/calculator-store.ts`
- Modify: `lib/store/expenses-store.ts`
- Modify: `lib/store/calculator-store.test.ts`
- Modify: `lib/store/expenses-store.test.ts`

**Interfaces:**

- Consumes: explicit `PersistenceScope` and transition generations from Tasks 1 and 3.
- Produces: identity-safe store actions and sync functions that accept explicit user context.

- [ ] **Step 1: Add failing tests for stale and unauthenticated writes.**

Use `vi.useFakeTimers()` in the store test setup and mock the existing Supabase helpers. Cover:

```typescript
it("clears active scenario metadata on sign-out", () => {
  useCalculatorStore.getState().setIdentity({ kind: "guest" })

  expect(useCalculatorStore.getState()).toEqual(
    expect.objectContaining({ identity: { kind: "guest" }, activeScenarioId: null, scenarioList: [] })
  )
})

it("does not update the previous user's scenario after sign-out", async () => {
  useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
  useCalculatorStore.getState().setDrawdownConfig({ initialWithdrawalRate: 4.5 })
  useCalculatorStore.getState().setIdentity({ kind: "guest" })
  vi.runAllTimers()

  expect(updateScenario).not.toHaveBeenCalled()
})

it("does not delete a previous user's account from a signed-out store", () => {
  useCalculatorStore.getState().setIdentity({ kind: "guest" })
  useCalculatorStore.getState().removeAccount("user-a-account")

  expect(deleteAccount).not.toHaveBeenCalled()
})

it("does not delete a previous user's expense after sign-out", () => {
  useExpensesStore.getState().setIdentity({ kind: "guest" })
  useExpensesStore.getState().removeExpense("user-a-expense")

  expect(deleteExpense).not.toHaveBeenCalled()
})

it("cancels pending expense sync timers on sign-out", async () => {
  useExpensesStore.getState().setIdentity({ kind: "user", userId: "user-a" })
  useExpensesStore.getState().addGroup("Groceries", "#000000")
  const group = useExpensesStore.getState().groups[0]
  useExpensesStore.getState().setIdentity({ kind: "guest" })
  await vi.advanceTimersByTimeAsync(1000)

  expect(upsertGroup).not.toHaveBeenCalled()
  expect(group).toBeTruthy()
})

it("does not commit user A's sync after switching to user B", async () => {
  fetchScenario.mockReturnValueOnce(deferredScenarioFor("user-a"))
  useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-a" })
  const sync = useCalculatorStore.getState().syncFromDb("user-a")
  useCalculatorStore.getState().setIdentity({ kind: "user", userId: "user-b" })
  resolveScenarioFor("user-a")
  await sync

  expect(useCalculatorStore.getState().identity).toEqual({ kind: "user", userId: "user-b" })
})
```

Define `deferredScenarioFor(userId)` and `resolveScenarioFor(userId)` in the store test fixture. `deferredScenarioFor` must return a promise whose resolution is controlled by the test, so the user switch happens while user A's fetch is still pending.

- [ ] **Step 2: Replace bare session mutations with explicit identity transitions.**

Replace `sessionId`/`setSessionId` with `identity`/`setIdentity` and migrate all read sites to `identity.userId`. A sign-out transition must clear `identity`, `activeScenarioId`, and `scenarioList`, cancel pending timers — including the expenses store's `groupSyncTimers` and `expenseSyncTimers` maps — and switch persistence to the guest scope. A sign-in transition must set the user scope before loading server data.

- [ ] **Step 3: Guard every remote mutation.**

Capture the user ID and scenario ID before scheduling a write. Re-check both immediately before the request. Apply this to scenario updates, account add/update/remove, expense group delete, expense delete, and all debounced sync functions.

- [ ] **Step 4: Make sync functions explicit and stale-safe.**

Pass `userId` (and `generation`, for the coordinator-driven path) into calculator sync rather than reading a mutable `identity` internally. Before applying fetched data, verify the user and transition generation still match. Replace the single-boolean `dbSyncInProgress`/`syncInProgress` flags with a per-(`userId`, `generation`) in-flight map so a re-run for the same identity does not duplicate fetches.

- [ ] **Step 5: Run store tests and coverage.**

Run: `npm run test -- lib/store/calculator-store.test.ts lib/store/expenses-store.test.ts`

Expected: all stale-transition and sign-out tests pass without database calls for invalid identities.

---

### Task 5: Make Claiming and MFA Ordering Explicit

**Files:**

- Modify: `lib/supabase/claim.ts`
- Modify: `lib/supabase/claim.test.ts`
- Modify: `components/supabase-provider.tsx`
- Modify: `e2e/helpers/auth-helper.ts`
- Modify: `e2e/journeys/08-two-factor.spec.ts`

**Interfaces:**

- Consumes: guest-owned snapshots and the coordinator's verified user/AAL state.
- Produces: `ClaimSource = "guest" | "user" | "legacy-unknown"` and a claim function that cannot automatically process authenticated or ambiguous local data.

- [ ] **Step 1: Add claim-source tests.**

Verify that `claimLocalData` accepts a guest snapshot, rejects a user-owned snapshot, rejects ambiguous legacy state, and never runs at AAL1 when a verified factor requires AAL2.

- [ ] **Step 2: Require an explicit claim source in `claimLocalData`.**

Change the signature to accept `source: ClaimSource`. The function must not infer ownership from `identity.kind === "guest"`; only `source === "guest"` may enter the automatic claim path. `"user"` returns server-wins without copying local state, and `"legacy-unknown"` returns a non-claimable result until the explicit prompt completes. The coordinator derives `source` from the event type and identity: a `SIGNED_IN`/`INITIAL_SESSION` event that changes identity is `"guest"`; a re-auth/refresh of an existing identity is `"user"`; ambiguous legacy local state (un-scoped key with `sessionId: null`) is `"legacy-unknown"`. Also scope `PENDING_CLAIM_KEY` per user (`rc-pending-claim-scenario-id:<userId>`) so one account's in-flight claim is never read or resumed by another.

- [ ] **Step 3: Sequence claim before server sync.**

For a new account, claim first and then load the resulting server scenario. For an existing account, discard guest state and load server data. Never run claim and sync concurrently.

- [ ] **Step 4: Assert no protected work runs before elevation.**

Update `08-two-factor.spec.ts` to assert that no protected sync or claim occurs before elevation. The current AAL1 behaviour is only documented in comments (`08-two-factor.spec.ts:63-69`); there is no dedicated helper to remove. Keep `dismissDevOverlay()` — it is a generic dev-overlay dismisser used by `signOut`/`signIn`/`enrollTotp`, not an AAL1-specific workaround. Keep the hard navigation after successful MFA verification.

- [ ] **Step 5: Run claim and MFA tests.**

Run: `npm run test -- lib/supabase/claim.test.ts lib/auth/bootstrap-coordinator.test.ts`

Run: `npm run test:rls`

Expected: protected tables are untouched at AAL1 and loaded only after AAL2.

---

### Task 6: Add End-to-End Regression Coverage and Remove Redundant Guards

**Files:**

- Create: `e2e/journeys/09-bootstrap-data-ownership.spec.ts`
- Modify: `e2e/helpers/state-manager.ts`
- Modify: `lib/store/persist-gate.ts`
- Modify: `components/supabase-provider.tsx`

- [ ] **Step 1: Add browser regressions.**

Cover slow localStorage hydration plus auth initialization, signed-out reload, signed-in reload, user A to user B switching, sign-out followed by local edits, MFA sign-in, and `/print` loading through the root bootstrap.

Also update `e2e/helpers/state-manager.ts` (it hardcodes `'retirement-calculator-storage'` and writes `version: 0`) to read/write the scoped guest/user key, and audit the eight existing journeys that call `clearState`/`seedState`/`getState` so they keep working against scoped storage.

- [ ] **Step 2: Run the focused browser journeys.**

Run: `npm run ui:doc -- e2e/journeys/08-two-factor.spec.ts e2e/journeys/09-bootstrap-data-ownership.spec.ts`

Expected: no plan wipe, no cross-account claim, no stale remote mutation, no pre-MFA RLS request, and no route-specific hydration workaround.

- [ ] **Step 3: Remove obsolete timing workarounds only after the regressions pass.**

Remove duplicate rehydrate calls and the route-specific hydration workaround. Replace the single-boolean `dbSyncInProgress`/`syncInProgress` locks with the per-(`userId`, `generation`) in-flight map from Task 4 (generation checks prevent stale commits, not duplicate concurrent fetches). Keep the persist gate as defense-in-depth. Verify `/print` renders its error and `mfa-required` states (not just the loading state) so a failed bootstrap does not hang the print route.

- [ ] **Step 4: Run the complete verification gate.**

Run: `npm run test`

Run: `npm run test:coverage`

Run: `npm run typecheck`

Run: `npm run lint`

Run: `npm run build`

Expected: all checks pass, modified store files remain above the project coverage threshold, and no calculation behaviour changes.

---

## Completion Criteria

- There is exactly one application bootstrap owner.
- No auth callback performs asynchronous Supabase/database work.
- No route calls store `persist.rehydrate()` independently.
- AAL1 sessions with a verified factor perform no protected sync.
- Token-refresh and user-update events do not re-claim or re-sync.
- Guest, user A, and user B persistence scopes are distinct.
- The legacy un-scoped storage keys are migrated once and removed.
- `PENDING_CLAIM_KEY` is scoped per user.
- Sign-out clears remote identity and invalidates pending remote writes (including the expenses debounce timers).
- `/print` renders distinct loading, error, and `mfa-required` states.
- Existing plan reload, claim, MFA, print, and account-switch journeys pass.
- The dated history record and all linked phase documents reflect the completed implementation.
