---
target: app/calculator/overview
total_score: 21
p0_count: 1
p1_count: 2
timestamp: 2026-06-13T10-30-17Z
slug: app-calculator-overview
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Empty state gives no signal — dark void, no loading, no "get started" indicator |
| 2 | Match System / Real World | 3 | SA terminology (RA, TFSA) is precise; minor technical language in chart subtitles |
| 3 | User Control and Freedom | 2 | No undo; empty state traps new users with no exit path |
| 4 | Consistency and Standards | 2 | Metric cards use raw Tailwind colors; dashboard-card breaks card spec; badge text leaks impl strings |
| 5 | Error Prevention | 2 | Metrics grid silently vanishes when no projection — no guardrail or explanation |
| 6 | Recognition Rather Than Recall | 2 | Tooltips are good; empty state charts give no visual preview of what will appear |
| 7 | Flexibility and Efficiency | 1 | Zero keyboard shortcuts; no command palette; PRODUCT.md promises Linear/Raycast speed |
| 8 | Aesthetic and Minimalist Design | 3 | Dark system is clean and restrained when populated; empty state breaks the composition |
| 9 | Error Recovery | 2 | No error states visible; badge text issue would confuse users trying to understand status |
| 10 | Help and Documentation | 2 | InfoTooltip on metrics is good; no contextual onboarding for new users |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** The interface does NOT immediately read as AI-generated. The dark navy + gold language, IBM Plex pairing, sidebar structure, and monospace logotype feel deliberate and coherent. Where it breaks down: the empty state looks like a loading failure rather than a first-use state.

**Deterministic scan:** Clean — detect.mjs returned no findings across the component tree. No gradient text, no side-stripe borders, no glassmorphism, no numbered eyebrows detected.

## Overall Impression

The design system is strong — the token discipline, the tonal stack, the accent scarcity — and the populated state will be clean and dense in the right way. The critical failure is first-use: a new user opens the app and gets two empty chart cards and nothing else. Fix that and the score jumps significantly.

## What's Working

1. The sidebar is precisely executed — gold active indicator, ghost nav items, monospace wordmark.
2. InfoTooltip on every metric card — right call for a financially literate audience.
3. Conditional depletion messaging logic (successRate >= 50 → "Never" vs median depletion age) is genuinely user-correct.

## Priority Issues

**[P0] Empty state is a 600px dark void with no onboarding path**
- Why it matters: Every new user hits this first. DashboardMetricsGrid returns null, KeyInsightsSummary returns null, chart cards show 7-word messages with no action. No CTA, no link to Accounts, no preview of populated state. Reads as a crash.
- Fix: Replace null returns with skeleton/empty-state component. Add "Add your first account →" CTA. Show placeholder metric cards with "--" values rather than hiding the grid.
- Suggested command: /impeccable onboard

**[P1] Metric card colors break the design system**
- Why it matters: DashboardMetricCard uses hardcoded border-green-500, text-green-600, border-cyan-500, border-orange-500 — not semantic tokens. Breaks One Signal Rule. Fails to adapt to color themes. Potentially fails AA contrast in light mode (green-600 on white).
- Fix: Replace raw Tailwind color classes with semantic design system variables. Use chart-2 (Teal) for success, destructive for failure.
- Suggested command: /impeccable colorize

**[P1] Badge labels render implementation strings as user-visible text**
- Why it matters: In KeyInsightsSummary, {insight.badge} renders "success", "warning", "info" as badge label text. Users see "On Track Status → Yes [success]".
- Fix: Change badge field to user-facing text: "On Track", "At Risk", "Tip". One line fix.
- Suggested command: /impeccable clarify

**[P2] dashboard-card class violates the card spec**
- Why it matters: .dashboard-card applies rounded-2xl shadow-lg hover:shadow-xl — spec says rounded-lg shadow-sm, no hover shadow. Key Insights card looks inconsistent with metric and chart cards.
- Fix: Change .dashboard-card to @apply rounded-lg shadow-sm; — remove hover animation.
- Suggested command: /impeccable polish

**[P2] Zero keyboard efficiency for a power-user tool**
- Why it matters: PRODUCT.md promises Linear/Raycast speed-of-thought. No keyboard shortcuts, no command palette, no shortcut to run simulation.
- Fix: Add a command palette (Cmd+K) with navigate, run simulation, toggle display mode, add account.
- Suggested command: /impeccable shape

## Persona Red Flags

**Etienne (SA Tool User):** Hits empty state with no path forward. Switching color themes reveals metric card status colors are immune to theming (hardcoded green/cyan).

**Alex (Power User):** No keyboard shortcut to run simulation. No batch-change for assumptions. Floating action bar helps but affordances aren't visible at load.

**Sam (Accessibility):** text-xs text-muted-foreground labels on metric cards land at ~4.6:1 contrast — razor-thin above the 4.5:1 AA floor. Design system itself warned: "must pass 4.5:1 against Surface Dark; test before use."

## Minor Observations

- dashboard-section-title class defined in globals.css but never used on the overview page — likely orphaned.
- grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 with dynamic metric count (5 without Monte Carlo, 7 with) creates misalignment at lg breakpoint.
- Empty chart cards have no explicit min-height — visual jump between empty→populated states will be jarring.
- KeyInsightsSummary uses text-lg font-bold for values — doesn't map to any defined typography step in the system.

## Questions to Consider

- "What would a new user's first 60 seconds look like if you shadowed them?"
- "Does the Key Insights card need to be a card?"
- "What if the success rate was a visual indicator (arc/bar), not just a colored border?"
