# Auth & Guest UX Fixes — Login feedback, guest-data ownership, sign-out reset, reload feedback

## What changed

Four reported login/guest-flow bugs in the bootstrap/data-ownership system (Phase 9.4).

### 1. Live sign-in no longer leaves guest data stranded (guest-data ownership)

`claimAndSync` only claimed guest-owned data on the startup path (the synthetic
`INITIAL_SESSION`). A guest who added accounts in localStorage and then signed in
**via the modal** fires `SIGNED_IN`, which skipped the claim entirely. A brand-new
user (no server data) was left staring at their guest accounts that were neither
claimed into their account nor replaced by anything — and were never persisted
server-side.

Fix (`lib/auth/bootstrap-coordinator.ts`): the claim now runs whenever the store
holds guest-owned data — i.e. `prevUserId === null` with an `INITIAL_SESSION` or
`SIGNED_IN` event. The machine already guards this precisely: a same-user re-auth
(`event.userId === prevUserId`) never reaches `syncing`, and an A→B user switch
(`prevUserId` set) skips the claim because the store holds A's data, not a guest's.
`claimLocalData`'s `server-has-data` rule still prevents any overwrite of a user
who already has scenarios.

### 2. Signed-in user with zero scenarios sees a clean slate, not a previous scope's data

`syncFromDb` set `activeScenarioId: null` and `scenarioList: []` when the account
had no scenarios but left `accounts`/`personalInfo` untouched — so a previous
scope's (guest or another user's) data stayed on screen.

Fix (`lib/store/calculator-store.ts`): the zero-scenarios branch now resets the
whole plan to defaults (`defaultSettings` + empty accounts + null scenario).

### 3. Sign-out leaked the previous user's data into the guest session

`setIdentity({ kind: "guest" })` cleared scenario metadata but left the previous
user's `accounts`/`personalInfo` in memory. After sign-out the sidebar showed
"Sign in" while the screen still showed the former user's portfolio — and a
later guest→new-user claim would have captured that stale data and written it
into the new account.

Fix:
- `lib/store/calculator-store.ts` / `lib/store/expenses-store.ts` — the guest
  transition now resets the full in-memory state to defaults (on top of the
  existing timer cancellation + scoped-key eviction).
- `components/supabase-provider.tsx` — the sign-out branch now also runs
  `setIdentity(guest)` on the expenses store (it only ran on the calculator
  store before) and re-hydrates the guest scope, so the signed-out user sees
  their own local plan (or a clean empty plan) and the write gate is
  re-released for guest edits.

### 4. No visible login feedback

`AuthModal` closed on successful sign-in with the only change being the email in
the desktop sidebar's bottom account button. On mobile there was **no sign-in
affordance at all** — the sidebar (which owns both the sign-in button and the
account menu) is `hidden md:flex`.

Fix:
- `components/auth/auth-modal.tsx` — fires a `Signed in — <email>` toast on
  success (the toast channel already exists at the root layout).
- `components/layout/top-bar.tsx` — the top bar (visible on every screen size)
  now carries a mobile-only account control: a "Sign in" button that opens the
  `AuthModal` when signed out, and an account menu (Manage Account / Sign Out)
  when signed in.

### 5. Reload shows only the sidebar — blank content area

Reported as "hard reload after login shows only the side menu; it takes one or
two reloads for pages to show". The content div is `opacity: 0` until the
bootstrap coordinator reaches `ready` AND the deferred store values catch up, so
a slow or failing bootstrap left the content area silently blank with no
feedback.

Could not be reproduced against the local stack (5+ reload loops all reached
`ready` and revealed content), so the fix here is defensive hardening plus the
confirmed root-cause fixes above:
- `app/calculator/layout.tsx` — the shell now renders a visible loading state
  (`role="status"`, spinner + "Loading your plan…") while the bootstrap is in
  flight instead of a blank area, and an error state (`role="alert"` + Reload
  button) if the bootstrap enters `error`, so the page can never appear
  unresponsive with no explanation.

## Verification

- 6 new/updated unit tests: coordinator claims on live `SIGNED_IN` from a
  signed-out state; no re-claim on re-auth of the active user; stale-transition
  contract updated (A's guest→A claim is legitimate, A's sync still never
  commits, B's A→B transition must not claim); calculator store zero-scenarios
  clears accounts + plan; sign-out resets both stores to defaults.
- `npm run test` — 994/994 pass. `npm run typecheck`, `npm run lint` — clean
  (0 errors; the 10 warnings are pre-existing react-hooks advisories in files
  untouched here). `npm run build` — clean. `npm run test:coverage` — branches
  85.2% (≥85%). `npm run shadscan` — 98/100 (A), unchanged.
- Browser-verified against local Supabase: sign-in as a brand-new user with
  guest accounts claims them into a new "My Plan" (scenario row + cloned
  accounts confirmed in Postgres) and shows the toast; sign-in as a user with
  existing data replaces the guest data with theirs; sign-out resets the store
  (previous user's accounts disappear, "No accounts yet" returns); the mobile
  account menu and sign-in modal work at 390px.
- `e2e/journeys/09-bootstrap-data-ownership.spec.ts` — 4/4 pass. Journey 07's
  single failure is the pre-existing "waits for a recharts surface on Overview"
  staleness (charts moved to `/charts` in 2026-08-09), reproduced on clean main.