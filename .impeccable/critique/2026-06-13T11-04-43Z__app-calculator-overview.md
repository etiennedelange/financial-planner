---
target: app/calculator/overview
total_score: 25
p0_count: 0
p1_count: 0
timestamp: 2026-06-13T11-04-43Z
slug: app-calculator-overview
---
## Design Health Score

| # | Heuristic | Score | Change | Key Issue |
|---|-----------|-------|--------|-----------|
| 1 | Visibility of System Status | 3 | — | Loader2 spinner wired; no explicit save confirmation |
| 2 | Match System / Real World | 3 | — | SA terminology precise, CTAs plain English |
| 3 | User Control and Freedom | 2 | — | No undo; banner undismissable if user isn't ready to act |
| 4 | Consistency and Standards | 4 | +1 | Card spec now matches: rounded-lg shadow-sm across all cards |
| 5 | Error Prevention | 2 | — | Empty state CTA present; no explanation of consequences |
| 6 | Recognition Rather Than Recall | 3 | +1 | Icons in chart empty states (TrendingUp, Activity) signal what each card becomes |
| 7 | Flexibility and Efficiency | 1 | — | Zero keyboard shortcuts; no command palette; no simulation hotkey |
| 8 | Aesthetic and Minimalist Design | 3 | — | Cleaner card spec; ~500px void below Key Insights persists |
| 9 | Error Recovery | 2 | — | Badge system fixed; no user-visible error messages on this view |
| 10 | Help and Documentation | 2 | — | InfoTooltips on metric cards; no guided first-run sequence |
| **Total** | | **25/40** | **+2** | **Acceptable — consistent improvement across three runs** |

## Anti-Patterns Verdict

LLM assessment: Not AI-generic. Dark navy + gold holding identity. Empty state is structured and visually intentional. Ghost metric cards at 40% opacity preview real data structure. Card corners and shadows are now cohesive after polish. Detector: [] — clean for third consecutive run.

## Overall Impression

Three runs, three clean gains. P0 resolved, P1×2 resolved, two P2s resolved (card spec, colors). Page is functionally correct and visually consistent. Remaining gap: one structural usability hole (keyboard efficiency, H7=1) and one layout cosmetic (the ~500px void below Key Insights).

## What's Working

1. Ghost card pattern: 40% opacity metric cards with real labels preview the populated state precisely.
2. Icon-keyed chart empty states: TrendingUp and Activity icons correctly signal chart type; heights are consistent (h-[260px]).
3. Consistent card system: dashboard-card (rounded-lg, shadow-sm) applies uniformly after polish spec fix.

## Priority Issues

**[P2] Zero keyboard efficiency**
- No keyboard shortcuts anywhere. No command palette. No hotkey to trigger Monte Carlo simulation.
- Fix: Add Cmd/Ctrl+K command palette, Cmd+Enter to run simulation, Cmd+[1-6] section switching.
- Suggested command: /impeccable shape keyboard-efficiency

**[P3] Large void below Key Insights**
- ~500px of empty dark background below Key Insights in empty state.
- Fix: Add contextual tip section or progress checklist, or vertically constrain empty state layout.
- Suggested command: /impeccable layout overview empty-state

**[P3] Chart empty states: icon only, no shape preview**
- Icons signal chart type but no visual hint of what a populated chart looks like.
- Fix: Add very-low-opacity SVG polyline behind the icon tracing a retirement growth curve / fan shape.
- Suggested command: /impeccable onboard charts

## Persona Red Flags

Alex (Power User): No keyboard shortcuts. Re-running simulation requires 8+ clicks. High friction for daily-use workflow.

Jordan (First-Timer): Key Insights mentions "plan" without context. Minor friction for users who haven't seen the Plan tab yet.

Sam (Accessibility): Tab order linear and sensible. InfoTooltip keyboard accessibility unverified.

## Minor Observations

- "Add accounts and run simulation" vs "Add accounts to see your projections" — slightly inconsistent phrasing for same action.
- Key Insights CTA mentions "plan" — first-timers may not know what that means in this context.
- "Years to Retirement: 30" showing real data in ghosted empty state is a good UX moment.

## Questions to Consider

- What if the Overview page had a progress indicator showing setup completeness?
- Does a first-run user want charts, or just their next step?
- Should keyboard shortcut for simulation queue immediately with visual feedback?
