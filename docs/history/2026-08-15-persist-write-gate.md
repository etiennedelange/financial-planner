# Persisted plan wiped on reload — pre-hydration writes clobber localStorage

## The bug

Two user reports, one root cause:

1. **Signed out:** data saved to localStorage survived the current session, but a
   page reload wiped everything.
2. **Signed in:** adding accounts (etc.) then reloading cleared the plan too.

Reproduced live with seeded localStorage: an age-45 plan with one account
("Seed Pension", R 123 456) came back as age-35 defaults with zero accounts after
a single reload. Instrumenting `Storage.prototype.setItem/getItem` for the
`retirement-calculator-storage` key showed why:

```
t=988   SET defaults (acctCount 0, age 35, sessionId null)   ← 3 writes
t=1041  GET (rehydrate read — 53 ms too late)
t=1339  SET defaults                                          ← another 3 writes
```

All three early writes carried a stack trace into `setSessionId` called from
`SupabaseProvider` (both `init()` and the supabase-js `onAuthStateChange`
callback that fires during client `_initialize`).

### Root cause

Both stores use zustand `persist` with `skipHydration: true` and rely on the
calculator layout to call `useCalculatorStore.persist.rehydrate()` in an effect.
Until that rehydrate's read settles, the store holds its pre-hydration
**defaults**. zustand's persist middleware writes to storage on **every** `set()`
— including the auth-driven `setSessionId()` calls `SupabaseProvider` fires on
mount, which raced the layout's async rehydrate read:

1. `setSessionId(null|user.id)` runs before rehydrate has read localStorage.
2. Persist writes the store's *default* state over the user's saved plan.
3. Rehydrate's read then returns the just-overwritten defaults.

Signed in, `syncFromDb()` later rescued the data from Supabase, which masked the
bug. Signed out there is no database, so the plan was gone for good.

## The fix

Two layers.

### 1. Write-gate before hydration (`lib/store/persist-gate.ts`)

New `createGatedPersistStorage<S>()` wraps `createJSONStorage(() => window.localStorage)`.
Its `setItem` is a no-op until `release()` is called, which each store wires to
persist's `onRehydrateStorage` — i.e. until the first `rehydrate()` has actually
settled. Pre-hydration writes of default state are now dropped, so localStorage
can never be clobbered before it is read, regardless of how `SupabaseProvider`'s
timing interleaves with the layout's rehydrate. The gate degrades to `undefined`
(no persistence) when `window.localStorage` is unavailable, mirroring zustand's
own SSR behaviour.

Applied to both stores:

- `calculator-store.ts` — `storage` + `onRehydrateStorage` (persisted shape
  extracted as `PersistedCalculatorState` so the gate's `PersistStorage` generic
  matches `partialize`).
- `expenses-store.ts` — same wiring (`PersistedExpensesState`).

### 2. Hydrate before auth writes (`components/supabase-provider.tsx`)

`init()` now `await`s both stores' `rehydrate()` before calling `getUser()`, so
`setSessionId` never runs against an un-hydrated store. This also fixes the
multi-user-same-browser edge where a stale persisted `sessionId` could otherwise
survive and `syncFromDb` would fetch the previous user's scenarios.

## Verification

- New `lib/store/persist-gate.test.ts` — gate drops writes until released, reads
  regardless of gate state, supports `removeItem`, returns `undefined` when
  localStorage is missing.
- New regression test in `calculator-store.test.ts` (`vi.resetModules()` gives a
  fresh store with a closed gate): seed a plan, call `setSessionId(null)` *before*
  `rehydrate()`, assert the plan survives in memory and in localStorage. Confirmed
  it **fails** (age 35 instead of 45) with the gate reverted, proving it catches
  the exact bug.
- New rehydrate/persist test in `expenses-store.test.ts`.
- Live browser check: signed-out reload keeps the seeded plan (R 123 456 account
  + age 45 in storage and UI); signed-in add-account → reload keeps both accounts.
- 926/926 tests; `test:coverage` thresholds met (all files 93.94% lines, 85.58%
  branches); `typecheck`, `lint`, and `next build` clean.
