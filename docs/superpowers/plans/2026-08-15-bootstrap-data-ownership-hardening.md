# Bootstrap and Data Ownership Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace overlapping hydration, auth, and database-sync timing fixes with one serialized bootstrap flow and explicit guest/user data ownership.

**Architecture:** `SupabaseProvider` will own one bootstrap coordinator. The coordinator hydrates both Zustand stores once, resolves the verified auth identity, checks MFA assurance, chooses guest-claim versus server-wins behaviour, and exposes one readiness state. Auth callbacks will only enqueue events; stores will reject stale or unauthenticated remote writes. Persistence will use explicit guest and user scopes so one account's local cache cannot silently become another account's claim.

## Design Decisions (resolved during review)

- **Identity model.** `identity: PersistenceScope` (`{ kind: "guest" }` or `{ kind: "user"; userId: string }`) is the single source of truth for who owns a store instance. It is set only by the coordinator via `setIdentity` and is not itself persisted inside the scoped payload — the storage *key* encodes the scope. The legacy `sessionId` field is removed; its ~40 read sites migrate to `identity.userId` (nullable). Store write-guards capture `identity.userId` + `activeScenarioId` when a write is scheduled and re-check both at fire time, so writes need no generation value.
- **Hydration happens once *per scope*, not once.** Scoped storage keys depend on identity, but identity is not known until `getUser()` resolves — so the first hydration can only ever be guest-scoped, and an authenticated session requires a second, user-scoped hydration. The machine therefore has two hydration states (`hydratingGuest` → … → `hydratingUser`). The "hydrate exactly once" criterion is replaced by: **exactly one hydration per scope, and never more than one hydration in flight at a time.** Task 2's harness asserts that shape, not a single call.
- **Legacy migration runs pre-auth, in `hydratingGuest`.** It does not need the current user id: a legacy payload is routed by the `sessionId` *inside its own payload*, so classification is self-contained. This is why the circularity in the hydration ordering does not extend to the legacy migration.
- **Transition generation is coordinator-only, and XState does not replace it.** XState cancels the invoked *actor* when a state is exited, but it cannot cancel a `fetchScenario` promise already in flight inside a store — that promise still resolves and would still write. The machine therefore `assign`s an incrementing `generation` on every `AUTH_EVENT`, and passes it to sync functions (`syncFromDb(userId, generation)`, `syncExpensesFromDb(userId, generation)`); no store action reads it directly, so there is no store↔coordinator import cycle. Note this is a *different* mechanism from the store write-guards in the decision above: write-guards re-check `identity.userId` + `activeScenarioId` and need no generation; sync *reads* need the generation to drop a late response.
- **MFA assurance reads are token-aware.** The `currentAal` dependency must call `getAuthenticatorAssuranceLevel(access_token)` (the live `getUser(jwt)` path), never the argument-less cookie-cached form that can report a removed factor as still making `aal2` reachable (see `lib/supabase/proxy.ts`).
- **Legacy migration is a one-time key move, not a `persist` `migrate`.** `persist`'s `migrate` only runs against the current key; scoping introduces *new* keys, so the legacy un-scoped keys (`retirement-calculator-storage`, `expenses-store-v2`) must be read, classified, copied into the correct scoped key, and deleted exactly once before first rehydrate. `migrate`/`version` then apply to scoped keys from then on. Classification is self-contained and can run pre-auth: `sessionId` is inside both persisted payloads (`calculator-store.ts:352` `partialize`, `expenses-store.ts:27` `PersistedExpensesState`), so a legacy blob is routed by *its own* stored id, not the currently-authenticating user's.
- **Scoped storage is one wrapper with an active scope, and the gate flag needs an instance registry.** `createGatedPersistStorage` gains a module-level `activeScope`; its `getItem`/`setItem`/`removeItem` compute the scoped key from `activeScope` + the base name zustand passes in. No per-scope storage re-creation.

  **Implementation constraint (verified against source):** `persist-gate.ts:13` declares `let released = false` *inside* the factory, and there are two independent instances — `calculator-store.ts:39` and `expenses-store.ts:32`. A module-level `setScope()` therefore cannot reach those per-closure flags. `persist-gate.ts` must keep a module-level registry of created instances so `setScope()` can re-gate every one of them. Without this, `setScope` silently leaves both stores ungated.

- **The scope switch must re-close the write gate — this is the plan's highest-risk interaction.** Each store releases the gate via `onRehydrateStorage: () => () => storage?.release()`, which fires when the **guest** hydration settles. Between `setScope(user)` and the user-scoped rehydrate settling, the gate would otherwise be *open* while the store still holds guest data, so any `set()` in that window writes guest-shaped state into the user's key. That is exactly the "pre-hydration write clobbers saved data" failure `createGatedPersistStorage` was built to prevent, reintroduced by two-phase hydration. `setScope()` must re-close the gate on every registered instance, and Task 3 must test this window directly.

- **Bumping `version` must preserve the existing monetary-clamp migration.** Both stores are already at `version: 2` (`calculator-store.ts:313`, `expenses-store.ts:206`) with a load-bearing `migrate` that clamps monetary fields to the R1 trillion cap. Any version bump must keep that clamp reachable for payloads still at v1, or pre-cap absurd values resurface. Do not treat the bump as a no-op.
- **`mfa-required` is a client-side-window gate, not the primary gate.** On a fresh page load, middleware (`lib/supabase/proxy.ts`) redirects a `aal1`+`aal2` session to `/auth/mfa` before the provider mounts; the coordinator's `mfa-required` phase only protects the sign-in-in-place window (client-side `signInWithPassword` before `router.refresh()` redirects).
- **Elevation out of `mfaRequired` is by remount, not by event.** Because MFA elevation triggers a full navigation, the provider remounts and the actor is rebuilt from `hydratingGuest`. There is therefore **no `MFA_ELEVATED` event** — adding that transition would be dead code. `mfaRequired` is a terminal-for-this-actor resting state that the remount replaces. If in-place elevation is ever introduced, the event is added then, with a test that actually sends it.
- **Sign-out evicts the signed-out user's scoped keys.** On a shared device, leaving `…:user:<userId>` behind for every account that ever signed in is both a localStorage quota concern and a privacy one. Sign-out removes the scoped keys for the user being signed out.
- **Cross-tab sign-out is already covered by supabase-js**, which broadcasts auth changes across tabs; tab B receives `SIGNED_OUT` and processes it through the normal coordinator path. This needs a confirming test, not new design.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase `@supabase/ssr` 0.10 / `supabase-js` 2.108+, Zustand `persist`, XState 5 (bootstrap coordinator only), Vitest + happy-dom, Playwright.

## Global Constraints

- Every calculation-adjacent or data-migration change ships with unit tests.
- The verified identity comes from `supabase.auth.getUser()` outside `onAuthStateChange`; never await Supabase methods inside the auth callback.
- RLS remains the security boundary. Middleware and client readiness states are UX coordination only.
- A user with `currentAal === "aal1"` and `next === "aal2"` must not trigger protected reads, writes, claim operations, or database sync.
- No remote mutation may rely on `activeScenarioId` alone; it must also validate the current authenticated user and the captured transition generation.
- Existing persisted state must be migrated deliberately. Ambiguous legacy state must not be silently claimed by a different account.
- Keep `createGatedPersistStorage` during the transition. Remove it only after the single-bootstrap tests prove that no pre-hydration writer remains.
- **Do not ship from the Task 2 / Task 3 boundary.** Task 2 removes the duplicate rehydrate calls before Task 3 introduces scoping, so between those commits the app hydrates exactly once into an un-scoped key. That intermediate state is coherent for development but is not a releasable point.
- Auth callbacks forward the raw Supabase event type (`SIGNED_IN`, `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`, `INITIAL_SESSION`, `PASSWORD_RECOVERY`). Only a sign-in/sign-out transition runs claim and sync; token-refresh and user-update events must not re-claim or re-sync.
- The legacy un-scoped storage keys are migrated to scoped keys exactly once and deleted on success; a failed migration leaves the legacy key intact for retry.
- Required verification before completion: `npm run test`, `npm run test:coverage`, `npm run typecheck`, `npm run lint`, `npm run build`, and the MFA/RLS test suite when the local Supabase stack is available.
- After implementation, update the dated history record, Phase 3, Phase 4, Phase 9, and the Recent Activity index.

## File Structure

**Create**

| File | Responsibility |
| --- | --- |
| `lib/auth/bootstrap-machine.ts` | XState machine: bootstrap and auth-transition states, guards, actor stubs |
| `lib/auth/bootstrap-machine.test.ts` | State-chart tests: reachable states, guards, superseded-transition cancellation |
| `lib/auth/bootstrap-coordinator.ts` | Thin wrapper adapting the machine actor to the `BootstrapCoordinator` surface (`getState`, `start`, `enqueueAuthEvent`, `flush`) |
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

### Task 1: Define the Bootstrap Coordinator Contract (XState)

**Add dependency:** `xstate` (v5). No other packages in this plan depend on it — scope stays isolated to the coordinator.

**Files:**

- Create: `lib/auth/bootstrap-machine.ts` — the XState machine definition (states, guards, actor `src` stubs typed against `BootstrapDependencies`)
- Create: `lib/auth/bootstrap-coordinator.ts` — thin wrapper: creates the actor from `bootstrap-machine.ts` with real dependencies wired into `actors`, and adapts actor `subscribe`/`send` to the same `BootstrapCoordinator` surface (`getState`, `start`, `enqueueAuthEvent`, `flush`) so `SupabaseProvider` and Task 2 do not need to know XState is involved.
- Create: `lib/auth/bootstrap-coordinator.test.ts`
- Create: `lib/auth/bootstrap-machine.test.ts` — state-chart-level tests (reachable states, guard behavior) using `@xstate/test` or plain `createActor` + `waitFor`

**Interfaces:**

- Consumes: store hydration, verified `getUser`, `currentAal`, guest snapshot, claim, and server-sync functions supplied as dependencies, wired into the machine's `actors` map via `.provide()`.
- Produces (unchanged from the non-XState version, so no downstream task changes): `BootstrapState`, `getState()`, `start()`, `enqueueAuthEvent()`, and `flush()` for `SupabaseProvider`.

Replace the hand-rolled `generation` counter and `queue[]`/`drain()` loop with XState's native mechanisms:

- A single top-level `on: { AUTH_EVENT: { target: ".authenticating", actions: assign(...) } }` handler means a new event arriving mid-transition re-enters `authenticating` directly; XState cancels the in-flight `invoke` for the state being left. This is the state-chart equivalent of the `gen !== generation` check that guarded every `commit()` call in the plain version — verify this behavior directly in `bootstrap-machine.test.ts` rather than re-deriving it by hand.
- XState serializes event processing per-actor by default, so no explicit `queue[]`/`drain()` loop is needed for "process one auth event at a time, only after the callback returns."
- `mfa-required` becomes a real state (`mfaRequired`) with its own `on: { MFA_ELEVATED: "checkingAal" }` transition, not an early-return branch inside one large function.
- The `CLAIM_EVENT_TYPES.has(type)` skip (`TOKEN_REFRESHED`/`USER_UPDATED`/`PASSWORD_RECOVERY` must not claim or sync) must be expressed as a **guard on the transition into the `syncing` state**, not hidden inside the `claimAndSync` actor — this keeps the skip visible in the chart and independently testable.

A working sketch of the machine shape lives at `docs/sketches/bootstrap-machine-sketch.ts` (illustrative only, not wired up — use it as a starting point, not a copy-paste source, since it does not yet implement the `pendingEvent`-driven `claimAndSync` input contract precisely).

Define the coordinator dependency contract in `bootstrap-machine.ts` so the test fixture and provider use the same names (this contract is unchanged from the non-XState version — only its consumer, the machine's `actors` map, differs):

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

// NOTE: asserting only the final userId is NOT sufficient — that passes even if
// user A's claim+sync fully committed first and was merely overwritten. The
// assertions below are the actual anti-clobber contract, and this is the single
// most important test in the plan.
it("does not commit a stale transition after a newer user event", async () => {
  const dependencies = makeDependencies()
  // user A's sync is left pending so user B supersedes it mid-flight.
  dependencies.syncFromDb.mockReturnValueOnce(neverResolves())
  const coordinator = createBootstrapCoordinator(dependencies)

  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-b", hasSession: true })
  await coordinator.flush()

  expect(coordinator.getState().userId).toBe("user-b")
  // user A must never have reached claim at all...
  expect(dependencies.claimLocalData).not.toHaveBeenCalledWith("user-a", expect.anything())
  // ...and the only completed sync belongs to user B.
  expect(dependencies.syncExpensesFromDb).toHaveBeenCalledTimes(1)
  expect(dependencies.syncExpensesFromDb).toHaveBeenCalledWith("user-b", expect.any(Number))
})

it("rejects a late store response carrying a stale generation", async () => {
  // Guards what actor cancellation cannot reach: a fetch already in flight inside
  // the store when the transition was superseded.
  const dependencies = makeDependencies()
  const coordinator = createBootstrapCoordinator(dependencies)

  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-a", hasSession: true })
  coordinator.enqueueAuthEvent({ type: "SIGNED_IN", userId: "user-b", hasSession: true })
  await coordinator.flush()

  const [, generationA] = dependencies.syncFromDb.mock.calls[0] ?? []
  const [, generationB] = dependencies.syncFromDb.mock.calls.at(-1) ?? []
  expect(generationB).toBeGreaterThan(generationA ?? -1)
})

it("still processes an auth event after an error", async () => {
  // Regression guard: `error` must not be a final state, or the actor stops forever.
  const dependencies = makeDependencies({
    getUser: async () => { throw new Error("network down") },
  })
  const coordinator = createBootstrapCoordinator(dependencies)

  await expect(coordinator.start()).rejects.toThrow("network down")
  expect(coordinator.getState().phase).toBe("error")

  coordinator.enqueueAuthEvent({ type: "SIGNED_OUT", userId: null, hasSession: false })
  await coordinator.flush()

  expect(coordinator.getState().phase).toBe("ready")
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

Run: `npm run test -- lib/auth/bootstrap-coordinator.test.ts lib/auth/bootstrap-machine.test.ts`

Expected: FAIL because the machine and coordinator wrapper do not exist yet.

- [ ] **Step 3: Define the machine states and transitions in `bootstrap-machine.ts`.**

States: `hydratingGuest`, `authenticating`, `hydratingUser`, `applyingTransition`, `checkingAal`, `mfaRequired`, `syncing`, `ready`, `error`.

This is a larger state set than `BootstrapPhase` has members, because scoping forces hydration to split in two and `applyAuthTransition` needs its own state. `getState()` in the wrapper collapses them back onto `BootstrapPhase` (`hydratingGuest`/`hydratingUser` → `"hydrating"`, `applyingTransition`/`checkingAal` → `"authenticating"`) so no downstream consumer changes.

The machine must:

- Invoke `hydrateGuestScope` on entry to `hydratingGuest`: run the one-time legacy-key migration, set the guest scope, then hydrate both stores. Transition to `authenticating` on success, `error` on failure. This scope is guest because identity is not yet known.
- Invoke `getUser()` (`resolveIdentity`) in `authenticating`; a null user goes straight to `ready` (guest scope is already hydrated), a verified user goes to `hydratingUser`.
- Invoke `hydrateUserScope` in `hydratingUser`: `setScope({kind:"user",userId})` then `rehydrate()`. This is the second, user-scoped hydration — expected and required, not a duplicate.
- Invoke `applyAuthTransition(event, generation)` in `applyingTransition`. This state exists specifically so the dependency is actually wired; an earlier draft of this plan declared `applyAuthTransition` in the contract and asserted it in a test without ever invoking it.
- Invoke `currentAal()` in `checkingAal`; guard the transition to `mfaRequired` on `current === "aal1" && next === "aal2"`. Otherwise guard the transition into `syncing` on the event type: only `SIGNED_IN`/`INITIAL_SESSION` invoke `claimAndSync` (claim then sync, sequenced, never concurrent); `TOKEN_REFRESHED`/`USER_UPDATED`/`PASSWORD_RECOVERY` fall through to `ready` without invoking anything.
- Treat `mfaRequired` as a resting state with **no outgoing `MFA_ELEVATED` transition** — elevation triggers a full navigation and the actor is rebuilt by the provider remount (see Design Decisions). Do not add an event nothing sends.
- Handle a top-level `AUTH_EVENT` from any state — **including `error`** — by re-targeting `.authenticating`, assigning the new event into context, and incrementing `context.generation`. Leaving the current state stops its in-flight `invoke`, so a superseded transition cannot commit. The incremented generation covers what actor cancellation cannot: promises already in flight inside the stores.
- Keep `error` as an ordinary state, **not `type: "final"`** — a final state stops the actor permanently, so a transient sync failure could never be recovered from without a full page reload.
- Cache the actor's initial `start()` via the coordinator wrapper (next step), not inside the machine itself — the machine has no notion of "called twice."

- [ ] **Step 4: Implement the coordinator wrapper in `bootstrap-coordinator.ts`.**

`createBootstrapCoordinator(dependencies)`:

- Creates the actor via `bootstrapMachine.provide({ actors: { ...map dependencies to actor `src`s... } })` and `createActor(...)`.
- `start()` caches one promise: starts the actor (if not already started) and resolves/rejects when the actor reaches `ready` or `error` — two calls in React StrictMode's double `useEffect` must share the same promise and not restart the actor.
- `enqueueAuthEvent(event)` calls `actor.send({ type: "AUTH_EVENT", event })`.
- `flush()` returns a promise that resolves once the actor's current transition settles (subscribe, resolve on next `ready`/`error`/idle snapshot after the queued event was processed).
- `getState()` maps the actor's current XState snapshot (`state.value`, `context.userId`, `context.error`) to the existing `BootstrapState` shape so Task 2's `SupabaseProvider` integration needs no changes.

- [ ] **Step 5: Run the focused tests and confirm they pass.**

Run: `npm run test -- lib/auth/bootstrap-coordinator.test.ts lib/auth/bootstrap-machine.test.ts`

Expected: PASS for all coordinator ordering and stale-transition cases, plus the machine-level reachability/guard tests.

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

The harness must prove **one hydration per scope**, not one hydration total (see Design Decisions — scoped keys force a guest hydration before identity is known and a user-scoped hydration after). Specifically: a signed-out startup hydrates each store exactly once (guest); a signed-in startup hydrates each store exactly twice (guest, then user) and never has two hydrations in flight simultaneously; and React StrictMode's double `useEffect` in dev does not add a third. The browser journey in Task 6 covers the actual provider/layout composition.

- [ ] **Step 2: Register `onAuthStateChange` immediately with a synchronous callback.**

The callback may capture only the event type and whether a session exists. It must not call `getUser`, `claimLocalData`, `syncFromDb`, `syncExpensesFromDb`, or any other Supabase method.

- [ ] **Step 3: Start the coordinator after listener registration.**

The provider must expose the coordinator phase through `AuthContext`. Define the new context surface explicitly — `{ user, phase, error }` with `isLoaded` derived as `phase === "ready"` (or kept as a separate flag if consumers need it) — and update every `useAuth()` consumer in this same task so no consumer breaks mid-transition.

The consumers, verified against the tree (an earlier draft of this plan listed `sidebar.tsx` and `app-shell.tsx`, neither of which references `useAuth`, and omitted the calculator layout, which does):

- `components/pages/settings-page.tsx`
- `app/print/print-client.tsx`
- `app/calculator/layout.tsx`
- `components/supabase-provider.tsx` (the provider itself)

Re-run `grep -rl "useAuth" --include=*.tsx components app` before starting, in case the set has drifted again.

Preserve the current full-navigation MFA behaviour so the root provider remounts after elevation — this remount *is* the exit path from `mfaRequired`, which is why the machine has no `MFA_ELEVATED` event.

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

**Also add the scope-switch gate test — this is the highest-risk case in the plan.** It must fail against a naive implementation:

```typescript
it("re-closes the write gate on scope switch so guest state cannot leak into the user key", async () => {
  setScope({ kind: "guest" })
  await useCalculatorStore.persist.rehydrate()   // releases the gate

  setScope({ kind: "user", userId: "user-a" })   // gate must re-close HERE
  // A write in the window before the user-scoped rehydrate settles:
  useCalculatorStore.getState().setDisplayMode("real")

  expect(localStorage.getItem("retirement-calculator-storage:user:user-a")).toBeNull()

  await useCalculatorStore.persist.rehydrate()
  // Only after the user scope has hydrated may writes land.
  useCalculatorStore.getState().setDisplayMode("nominal")
  expect(localStorage.getItem("retirement-calculator-storage:user:user-a")).not.toBeNull()
})

it("re-gates every registered store instance, not just the first", async () => {
  setScope({ kind: "guest" })
  await Promise.all([
    useCalculatorStore.persist.rehydrate(),
    useExpensesStore.persist.rehydrate(),
  ])

  setScope({ kind: "user", userId: "user-a" })
  useExpensesStore.getState().setMonthlyIncome(50_000)

  expect(localStorage.getItem("expenses-store-v2:user:user-a")).toBeNull()
})
```

- [ ] **Step 2: Add scope-aware storage as one wrapper with an active scope.**

Add a module-level `activeScope` to `persist-gate.ts`. `getItem`/`setItem`/`removeItem` compute the scoped key from `activeScope` + the base name zustand passes in. There is no per-scope storage re-creation.

**`setScope(scope)` must swap `activeScope` and re-close the write gate on every instance.** Verified against source: `persist-gate.ts:13` declares `let released = false` *inside* the factory, and two independent instances exist (`calculator-store.ts:39`, `expenses-store.ts:32`). A module-level `setScope()` cannot reach per-closure flags, so `persist-gate.ts` must maintain a module-level registry of created instances and re-gate each one. Re-closing matters because `onRehydrateStorage` releases the gate when the *guest* hydration settles; without re-closing, the window between `setScope(user)` and the user rehydrate is ungated while the store still holds guest data — reintroducing the exact clobber bug this gate exists to prevent.

The coordinator calls `setScope` before each `rehydrate()`. Writes stay gated until that scope's own read settles.

- [ ] **Step 3: Migrate the legacy un-scoped keys once.**

Implement `lib/store/legacy-scope-migration.ts`, run inside the machine's `hydratingGuest` state (it needs no authenticated identity — see Design Decisions). Read the legacy keys (`retirement-calculator-storage`, `expenses-store-v2`): a non-null `sessionId` copies into that user's scoped key; `sessionId: null` moves to the ambiguous-legacy holding area (fed to `legacy-local-plan-prompt`), never straight into `claimLocalData`. Delete the legacy key only after a successful copy; on failure leave it intact for retry.

**If you bump `version`, carry the existing migration forward.** Both stores are already `version: 2` (`calculator-store.ts:313`, `expenses-store.ts:206`) with a load-bearing `migrate` that clamps monetary fields to the R1 trillion cap. A bump to 3 must still apply that clamp to any payload arriving at v1, or pre-cap absurd values resurface and can poison calculations. Add a test that a v1 legacy payload with an out-of-range `annualIncome` is still clamped after migrating into a scoped key. Note the copy preserves the payload's own `version`, so the simplest correct option is **not** to bump at all — decide explicitly rather than by default.

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

- [ ] **Step 2a: Mechanical rename, in its own commit, with no behaviour change.**

Replace `sessionId`/`setSessionId` with `identity`/`setIdentity` and migrate all read sites to `identity.userId`. **Scope: 67 non-test source references plus 21 in tests** (verified by `grep -rn "sessionId" --include=*.ts --include=*.tsx lib components app e2e`) — an earlier draft of this plan estimated "~40", which understates it by roughly 1.7×.

Commit this separately and confirm `npm run test` is green *before* Step 2b. A rename this wide bundled into a behavioural change makes the behavioural diff effectively unreviewable.

- [ ] **Step 2b: Add the identity transition semantics.**

A sign-out transition must clear `identity`, `activeScenarioId`, and `scenarioList`, cancel pending timers — including the expenses store's `groupSyncTimers` and `expenseSyncTimers` maps — switch persistence to the guest scope, and **remove the signed-out user's scoped keys** (`retirement-calculator-storage:user:<userId>`, `expenses-store-v2:user:<userId>`) so a shared device does not accumulate every past account's plan. A sign-in transition must set the user scope before loading server data.

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

Verify that `claimLocalData` accepts a guest snapshot, rejects a user-owned snapshot, rejects ambiguous legacy state, and never runs at AAL1 when a verified factor requires AAL2. Add a test that a second user cannot read or resume the first user's `PENDING_CLAIM_KEY` once it is per-user scoped. `claim.test.ts:16` currently hardcodes the un-scoped key and will need updating alongside.

- [ ] **Step 2: Require an explicit claim source in `claimLocalData`.**

**Current behaviour, verified against source — read this before implementing.** `claim.ts:54` is `claimLocalData(userId: string, local: LocalSnapshot)`. It contains **no `identity` reference at all**; it accepts whatever snapshot the caller hands it and gates only on *server* state (`claim.ts:75`: `if (existing.length > 0) return { claimed: false, reason: "server-has-data" }`). An earlier draft of this plan said the function "must not infer ownership from `identity.kind === "guest"`" — there is no such inference to remove. Ownership is decided entirely by the **call site that builds `LocalSnapshot`**, which is where the real hole is.

The change is therefore twofold:

1. Add `source: ClaimSource` as a required third argument, so the caller's ownership claim is explicit and visible at every call site (consistent with the plan's "don't express a behavioural difference as an omitted optional parameter" rule). Only `source === "guest"` may enter the automatic claim path; `"user"` returns server-wins without copying local state; `"legacy-unknown"` returns a non-claimable result until the explicit prompt completes.
2. Audit every existing `claimLocalData` call site and make it pass a `source` it can actually justify — a call site that cannot prove the snapshot is guest-owned must not pass `"guest"`.

The coordinator derives `source` from the event type and identity: a `SIGNED_IN`/`INITIAL_SESSION` event that changes identity is `"guest"`; a re-auth/refresh of an existing identity is `"user"`; ambiguous legacy local state (un-scoped key with `sessionId: null`) is `"legacy-unknown"`.

Also scope `PENDING_CLAIM_KEY` per user (`claim.ts:22`, currently the un-scoped `"rc-pending-claim-scenario-id"`) to `rc-pending-claim-scenario-id:<userId>` so one account's in-flight claim is never read or resumed by another.

**Decide explicitly what this does to the known stuck-claim bug.** `claim.ts`'s docblock (lines ~48-52) documents that a scenario abandoned mid-claim becomes "permanently unresumable from any device (every future sign-in sees `existing.length > 0` and stops) — stuck but safe, not silently wrong ... with no self-service recovery yet." Per-user scoping of `PENDING_CLAIM_KEY` changes that bug's blast radius. Either fix it in this task or record in the docblock that it is knowingly out of scope — do not leave it ambiguous.

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
- Modify: `e2e/helpers/state-manager.ts` (scoped keys, clear both stores, real hydration wait, `version` alignment)
- Modify: `components/layout/app-shell.tsx` (expose `data-bootstrap-phase` for the readiness wait)
- Modify: the seven state-using journeys — `01-first-time-user`, `02-multi-account-setup`, `03-personal-goals`, `04-insights-exploration`, `05-display-modes`, `06-calculations-review`, `07-responsive-layouts`
- Modify: `lib/store/persist-gate.ts`
- Modify: `components/supabase-provider.tsx`

- [ ] **Step 1 (prerequisite): Replace `waitForHydration()` with a real readiness signal.**

`state-manager.ts:77-79` is currently `await this.page.waitForTimeout(timeoutMs)` — a blind 1s sleep that checks nothing, used **11 times across all seven state-using journeys**. Step 2's "slow localStorage hydration plus auth initialization" regression is untestable against a fixed sleep, and two-phase hydration (guest, then user-scoped) makes the sleep strictly more fragile than it is today.

Replace it with a wait on the coordinator actually reaching `ready` — expose the bootstrap phase on the DOM (e.g. `data-bootstrap-phase` on the app shell, written from `useAuth().phase`) and have `waitForHydration` poll that via `page.waitForSelector`. Do this **before** writing the Step 2 regressions; they depend on it.

- [ ] **Step 2: Fix state-manager for scoped storage and full clearing.**

Three separate problems in `e2e/helpers/state-manager.ts`:

1. **Scoping.** It hardcodes `'retirement-calculator-storage'` in `clearState` (`:38`), `seedState` (`:48`), and `getState` (`:68`). All three must take/derive a scope and use the scoped key.
2. **`clearState` never clears the expenses store.** It removes only the calculator key — nothing anywhere in `e2e/` references `expenses-store-v2` (verified by grep). Every journey's "fresh start" therefore leaks expenses state between tests today, and scoping multiplies the problem, since each store now has a guest key plus one key per user. `clearState` must enumerate and remove **all** scoped keys for **both** stores, not a single hardcoded name.
3. **`seedState` writes `version: 0`** (`:57`) while both stores are at `version: 2`, so every seeded payload runs the monetary-clamp `migrate` on rehydrate rather than the normal path. Align this with whatever versioning decision Task 3 Step 3 reaches, and make it deliberate.

Then audit the **seven** journeys that call `clearState`/`seedState`/`getState` — `01-first-time-user`, `02-multi-account-setup`, `03-personal-goals`, `04-insights-exploration`, `05-display-modes`, `06-calculations-review`, `07-responsive-layouts` — so they keep working against scoped storage. (`02-password-reset` and `08-two-factor` do not use state-manager. An earlier draft of this plan said "eight", counting journey *files* rather than state-using ones.)

- [ ] **Step 3: Add browser regressions.**

Cover slow localStorage hydration plus auth initialization, signed-out reload, signed-in reload, user A to user B switching, sign-out followed by local edits, MFA sign-in, and `/print` loading through the root bootstrap.

Add two cases the earlier draft omitted: **a signed-out reload leaves no `…:user:<userId>` key behind** (the eviction criterion from Task 4 Step 2b), and **cross-tab sign-out** — supabase-js broadcasts auth changes across tabs, so a second tab must process `SIGNED_OUT` through the normal coordinator path rather than keeping a live user-scoped store.

- [ ] **Step 4: Run the focused browser journeys.**

Run: `npm run ui:doc -- e2e/journeys/08-two-factor.spec.ts e2e/journeys/09-bootstrap-data-ownership.spec.ts`

Then run the full suite, since Step 2 changes a helper all seven state-using journeys depend on:

Run: `npm run ui:doc`

Expected: no plan wipe, no cross-account claim, no stale remote mutation, no pre-MFA RLS request, and no route-specific hydration workaround.

- [ ] **Step 5: Remove obsolete timing workarounds only after the regressions pass.**

Remove duplicate rehydrate calls and the route-specific hydration workaround. Replace the single-boolean `dbSyncInProgress`/`syncInProgress` locks with the per-(`userId`, `generation`) in-flight map from Task 4 (generation checks prevent stale commits, not duplicate concurrent fetches). Keep the persist gate as defense-in-depth. Verify `/print` renders its error and `mfa-required` states (not just the loading state) so a failed bootstrap does not hang the print route.

- [ ] **Step 6: Run the complete verification gate.**

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
- Each store hydrates exactly once per scope, with never more than one hydration in flight.
- A bootstrap error leaves the coordinator able to process later auth events (the `error` state is not final).
- Every dependency in `BootstrapDependencies` is invoked by some machine state.
- Sign-out removes the signed-out user's scoped storage keys.
- AAL1 sessions with a verified factor perform no protected sync.
- Token-refresh and user-update events do not re-claim or re-sync.
- Guest, user A, and user B persistence scopes are distinct.
- `setScope()` re-closes the write gate on every registered store instance, and no write lands in a scope's key before that scope's own hydration settles.
- The existing R1 trillion monetary clamp still applies to a v1 payload after it is migrated into a scoped key.
- Every `claimLocalData` call site passes a `ClaimSource` it can justify.
- The legacy un-scoped storage keys are migrated once and removed.
- `PENDING_CLAIM_KEY` is scoped per user.
- Sign-out clears remote identity and invalidates pending remote writes (including the expenses debounce timers).
- `/print` renders distinct loading, error, and `mfa-required` states.
- Existing plan reload, claim, MFA, print, and account-switch journeys pass.
- `waitForHydration()` waits on an observable readiness signal, not a fixed timeout.
- `clearState()` clears every scoped key for both stores, so journeys cannot leak state into each other.
- A signed-out reload leaves no `…:user:<userId>` key in localStorage.
- The dated history record and all linked phase documents reflect the completed implementation.
