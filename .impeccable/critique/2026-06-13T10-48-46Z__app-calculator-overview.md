---
target: app/calculator/overview
total_score: 23
p0_count: 0
p1_count: 0
timestamp: 2026-06-13T10-48-46Z
slug: app-calculator-overview
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | +1 | Banner + ghost cards communicate not-yet-set-up clearly |
| 2 | Match System / Real World | 3 | — | SA terminology precise; CTAs are plain English |
| 3 | User Control and Freedom | 2 | — | No undo; keyboard efficiency still absent |
| 4 | Consistency and Standards | 3 | +1 | Badge text fixed; metric colors now use CSS vars / respect theme switching |
| 5 | Error Prevention | 2 | — | Empty state explains what to do but not why |
| 6 | Recognition Rather Than Recall | 2 | — | Ghost cards help; chart empty states still bare text |
| 7 | Flexibility and Efficiency | 1 | — | Still zero keyboard shortcuts or power-user path |
| 8 | Aesthetic and Minimalist Design | 3 | — | Ghost cards at 40% opacity are clean; large void below Key Insights persists |
| 9 | Error Recovery | 2 | — | Status states will be clearer when populated (badge fix applied) |
| 10 | Help and Documentation | 2 | — | CTAs present; still no contextual onboarding sequence |
| **Total** | | **23/40** | **+2** | **Acceptable — targeted improvements visible** |

## Anti-Patterns Verdict

LLM assessment: Not AI-generic. Dark system is holding. Empty state is now structured and intentional. Detector clean again.

## Overall Impression

Both P1s and the P0 are resolved. Ghost metric cards preview the structure. Keyboard gap and dashboard-card spec violation remain.

## What's Working

1. Ghost metric cards at 40% opacity preview populated structure correctly.
2. Banner placement above the grid — CTA is first thing after top bar.
3. Metric card colors now theme-safe via CSS variable arbitrary values.

## Remaining Issues

**[P2] dashboard-card violates card spec**
- rounded-2xl shadow-lg hover:shadow-xl vs spec rounded-lg shadow-sm. Key Insights card has visibly larger corner radius. Hover shadow is a Product ban.
- Fix: .dashboard-card { @apply rounded-lg shadow-sm; }
- Suggested command: /impeccable polish

**[P2] Zero keyboard efficiency**
- No command palette, no keyboard shortcuts, no shortcut to run simulation.
- Suggested command: /impeccable shape

**[P3] Large void below Key Insights in empty state**
- ~550px of empty background when content is short. Not broken but reads as unfinished.
- Suggested command: /impeccable layout

**[P3] Chart empty states are bare text**
- Centered text with no icon or SVG preview in a 220px dark card.
- Suggested command: /impeccable onboard

## Persona Red Flags

Etienne: Empty state now has clear path. Ghosted "30" years to retirement is specific and correct. Charts still give no visual preview of populated state.

Alex: No keyboard shortcuts after fixes. Largest remaining open issue.
