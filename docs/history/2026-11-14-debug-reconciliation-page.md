---
type: History Entry
title: "2026-11-14 — Debug window becomes a reconciliation page at /calculator/debug"
description: "The floating debug dialog scored 18/40 in a design critique: it could show a wrong number (false 'Never', swallowed zeros, hardcoded tax figures), had no structure, and was unreachable on mobile. It is now a route driven by one tested data model, with four independent reconciliation checks against the engine."
date: 2026-11-14
tags: [debug, ux, accessibility, tax, bug]
---

# 2026-11-14 — Debug window → reconciliation page

## Why

An `/impeccable critique` of `components/debug/debug-window.tsx` scored it 18/40. The substantive findings:

- **Wrong-number states.** "Years to Depletion" read "Never" while the projection was still null; `{x && …}` rendered a literal `0` for a configured 0 guardrail; `||` swallowed genuine zeros; `27.5%`, `R430k`, `45%`, age `55` and `1,000 runs` were literals that would silently diverge from `lib/constants` and the engine at the next tax-year change; a `Math.pow` fallback disagreed with the engine's monthly compounding.
- **Structure.** About 70 rows in one scroll, ~30 emphasised in teal, repeated aggregates, side-stripe borders and nested tonal surfaces.
- **Access.** The trigger was `hidden md:flex` (unreachable on mobile), icon buttons had `title` only, "Copied!" was silent, and a clipboard failure only reached `console.error`.
- **Drift.** The Copy export was a hand-built second copy of every section.

## What changed

- `lib/debug/debug-model.ts` — one `DebugModel` feeds both the page and the clipboard text (`toDebugText`). No calculation logic: it calls the shared engine functions and reads `ProjectionResult`. Engine rows read `—` until a projection exists; optional config uses `!== undefined`; tax figures come from `lib/constants`.
- **Reconciliation.** Four checks recompute a headline number a second way: portfolio at retirement vs Σ `projectFinalSavings`; initial income vs `calculateInitialWithdrawal` on the post-lump-sum balance; year-1 net income identity; per-account balances vs remaining portfolio. The first is skipped (and says why) when a TFSA limit binds, since the engine clips contributions and a plain future-value sum cannot.
- `lib/debug/copy.ts` — `copyText` returns `copied | failed`, announced in an `aria-live` region.
- `components/pages/debug-page.tsx` + `app/calculator/debug/page.tsx` — flat `PageCard` sections, `<dl>` rows, mono + tabular-nums for figures only, tabbed sections, row filter, no side stripes or nested cards, teal not used as a signal.
- Entry points: command palette (`⌘K`) and the account menu (works on mobile). The floating dialog and `components/debug/debug-window.tsx` are deleted.
- Monte Carlo still runs only on Risk; the debug page shows its results only if present and otherwise says to open Risk.

## Verification

- `lib/debug/*.test.ts`: 39 tests against the real engine, nominal and compound, with a 30% lump sum. Mutation-checked: truthy guardrail guard, `|| "Never"` depletion, a huge match tolerance and a hardcoded marginal rate each fail a test.
- Browser at 1440 and 390 px: no horizontal overflow, one `h1`, h2 per group, 0 console errors; detector reports no findings.
- The populated reconciliation table was not viewed live (the guest session has no accounts); it is covered by the engine-backed tests.

## Follow-up: critique pass (28/40 → fixes)

A second `/impeccable critique` of the new page scored 28/40. Its P1s and the mismatch finding were fixed the same day:

- **Verdict first.** `summarizeChecks` (tested) feeds a status line above the filter: "All N checks match", "K of N checks disagree" or "M of N checks match · X not compared". Skipped and pending checks are never folded into a green. Match now reads in foreground weight with a teal check; it is the page's single teal signal.
- **Tabs, not sticky anchors.** The sticky anchor bar overlapped content on scroll (it ignored the real top-bar height) and left dead links when the filter hid a group. It is now the shadcn `Tabs` (Reconciliation / Inputs / Results / Reference). Nothing is sticky, Reference is no longer on the same scroll as the evidence, and while filtering each tab shows its match count.
- **Mobile.** The five-column table renders from `md`; below it each check is a stacked block with Engine / Independent / Difference as a 3-up.
- **Mismatch help.** Compared checks carry the `tolerance` they were held to (`MATCH_TOLERANCE_*`); a mismatch row is tinted `bg-destructive/5` and says it is outside the tolerance and to check for a stale projection first. Every check has a Copy button (`checkToText`, shared with the whole-page export).
- Small: the hardcoded "four of them" now derives from `model.checks.length`; the duplicate `sr-only` h2 and second section id are gone; the filter input has an id and name; the `—` in Difference has an accessible label.

Verification: `lib/debug` tests 43 → added `summarizeChecks`, tolerance and `checkToText` cases; `typecheck`, `vp check` and `docs:check` clean; the detector reports no findings on the page; browser at 1905 and 390 px shows the empty state with no overflow. The populated Match and Mismatch states were not viewed live (guest session has no accounts).

## Follow-up: second critique pass (26/40 → fixes)

A third `/impeccable critique` (dual-agent, detector clean) scored 26/40. Fixed:

- **Filter now covers Reconciliation.** `filterChecks` (tested, in `debug-model.ts`) matches label, note, figures and the status word shown on the page; the input reads "Filter all tabs", the Reconciliation tab shows its match count, and a no-match state offers "Clear filter".
- **Empty state said once.** One "Nothing to compare yet" line with the Add-an-account link; pending rows no longer repeat their note. Pending uses `CircleDashed` so it differs from Not comparable.
- **Tolerance on every compared check.** A Match shows "Within R 0,05"; a Mismatch's note is foreground text with only the icon red.
- **Accessibility and mobile.** The dash has sr-only "Not applicable" text (an `aria-label` on a span is ignored); copy buttons are 44px below `md`; the tab list wraps instead of clipping "Reference"; the mobile figures are a 2-up with Difference below, no mid-number wrapping; notes are `text-sm`; the verdict is `text-xl`.
- **Not changed:** the critique's contrast P1 was an estimate. Measured in the browser, muted text is 5.05–5.28:1 (light) and 5.09:1 (dark), so it passes AA. A near-miss band was dropped: deltas are float rounding, so "within 2× tolerance" carries no information.

Verification: `lib/debug` tests (4 added for `filterChecks`); populated Match state viewed at 1440 and 390 px in light and dark; filter "net" leaves one Reconciliation row. The Mismatch state is covered by tests but not viewed live.
