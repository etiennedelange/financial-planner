---
type: History Entry
title: "2026-11-14 — Bug and performance audit: worker recovery, sync races, shortfall amount"
description: "An audit of the Risk worker, freezes, stores and calculations found a dead worker that was never replaced and reported as 'Waiting for simulation', stacked simulation runs, sync races that resurrected deleted expenses or silenced cloud sync, an overstated shortfall amount, and several render-cost issues. All fixed with regression tests; items deliberately left are listed."
date: 2026-11-14
tags: [bug, performance, monte-carlo, stores, audit]
---

# 2026-11-14 — Bug and performance audit

Triggered by two reports: the Risk simulation sometimes did not run on the Vercel deploy, and the
site sometimes froze when editing inputs and switching tabs. Neither reproduced on production in a
fresh Chromium profile (8 reloads, 36 tab switches, 4x CPU throttling with 10 accounts), so the
work targeted what makes those symptoms possible and invisible. Findings came from three Haiku
subagents (worker/deploy, freezes, calculation and store bugs); every fix below was confirmed in
code or by a failing test first. One subagent claim (production serves the worker as raw
TypeScript with a video MIME type) was disproved against the live site and discarded.

## Risk worker

- **A dead worker was never replaced.** `range-worker-client.ts` and `scenario-worker-client.ts`
  kept an errored worker and kept posting to it, so a worker that failed to load left the page
  waiting until reload. An errored worker is now terminated and the next run builds a fresh one.
- **Superseded runs kept running.** One worker handles messages in order, so ten quick edits
  queued ten full simulations (measured: 12 posts, last reply 1.8 s after the final edit). A busy
  worker is now terminated when a newer run supersedes it.
- **A failure read as "Waiting for simulation".** `noRangeCaption` (`lib/utils/simulation-status.ts`)
  now says the simulation failed to run. Verified in a production build with the worker script
  blocked.
- **CSP had no `worker-src`.** Under `script-src ... 'strict-dynamic'` workers fall back to
  `script-src`, where `'self'` is ignored. Added `worker-src 'self' blob:`. Chromium was not
  affected; Firefox and Safari were not available to test, so this is a precaution, not a
  confirmed cause.

## Stores

- **Deleted expenses and groups came back.** Pending 800 ms sync timers were not cancelled by
  `removeExpense`, `removeGroup`, `clearAll` or `loadSampleData`, and wrote the captured copy at
  fire time. Timers are cancelled, and the fire-time write uses the live row and is skipped if it
  is gone.
- **"Reset to defaults" while signed in disabled cloud sync.** `set(initialState)` reset identity
  and the active scenario. The reset now keeps both, deletes the cleared accounts remotely and
  syncs the scenario.
- **`switchScenario` had no ordering or owner guard.** The last call wins, and a sign-out
  mid-fetch no longer loads the previous user's scenario.
- **`createNewScenario`** clones the accounts as they are after the scenario row exists and
  re-checks the owner after its awaits.
- **`syncFromDb`** falls back to the first scenario's own data when the remembered scenario has
  none, so the active id and the loaded plan agree.
- **Legacy key migration overwrote a newer scoped plan.** The legacy payload is now kept under
  `<key>:legacy-backup:<userId>` instead.
- **Expenses store persisted `identity`**, contradicting its own comment. It now has a
  `partialize`.

## Calculation

- **`selectRawIncomeGap` ignored the spending-phase multiplier**, so the shortfall amount counted
  the 20% slow-go reduction as shortfall. It now uses `incomeGoalForDrawdownYear`, like the
  shortfall age. The golden file was regenerated: only `shortfallAmount` changed, in 26 scenarios
  (for example 40,437,172 to 31,944,894 for `mid-career|variable_percentage|below-min|lump0`).

## Render cost and markup

- `formatCurrency` reuses one `Intl.NumberFormat` per decimals value (it built one per call, about
  500 calls per breakdown render).
- Projections page and summary select the store fields they read instead of the whole store.
- The calculator context value is memoized.
- The calculator shell rendered a `<main>` inside the root layout's `<main>`. The shell is now a
  `div[data-app-scroller]`. `FloatingActionBar` used `querySelector("main")`, which found the
  non-scrolling outer element, so hide-on-scroll never ran; it now uses the scroller attribute.

## Tests and verification

- 31 new tests; 24 fail with the source fixes reverted (mutation check). Full suite 1,408 passing,
  `typecheck` clean, `vp check` 0 errors, `build` passes, shadscan 90/100.
- Production build run locally: result shown normally; failure message shown with the worker
  blocked; one `<main>` on the page.

## Not changed

- Worker results still carry the `runs` array (about 1 MB per profile; structured clone about 2 ms).
  Dropping it touches the type, engine, UI and many tests for little gain.
- Deterministic work on hidden routes (sensitivity tornado, stress test, what-if) is 0.5-1.5 ms
  each; left alone.
- `CalculationsBreakdown` and the debug window each compute weighted return/fees themselves. When
  the total balance is R0 the debug window weights by contribution and the breakdown (and
  `computePortfolioTotals`) falls back to 10% / 1%. Unifying them changes numbers on other pages,
  so it needs a decision first.
- No debounce was added in the worker hooks; cancelling the superseded worker removed the queue.
- Cross-browser (Firefox, Safari) behaviour of the worker under the CSP is untested.
