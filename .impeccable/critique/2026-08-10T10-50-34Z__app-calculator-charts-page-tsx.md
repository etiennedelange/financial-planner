---
target: app/calculator/charts/page.tsx
total_score: 28
max_score: 36
na_heuristics: 9
p0_count: 0
p1_count: 2
timestamp: 2026-08-10T10-50-34Z
slug: app-calculator-charts-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Charts display data clearly; loading state exists for Monte Carlo, but other charts lack "waiting for simulation" guidance |
| 2 | Match System / Real World | 4 | Fluent SA financial language; retirement terminology, account types, income planning are precise |
| 3 | User Control and Freedom | 2 | Charts are view-only; no drill-down, export, or customization. No Escape from charts page (though not critical). |
| 4 | Consistency and Standards | 4 | Flawless; all charts follow identical pattern (SectionLabel, Card, responsive heights, semantic colors, shadow-none) |
| 5 | Error Prevention | 3 | Empty state prevents broken renders; conditional rendering for missing data is solid, but no validation messages if charts compute incorrectly |
| 6 | Recognition Rather Than Recall | 3 | Chart titles and descriptions are clear; users don't need to memorize chart names, but individual chart explanations vary in depth |
| 7 | Flexibility and Efficiency of Use | 2 | No keyboard shortcuts, no export, no bulk actions. Power users hit a wall. |
| 8 | Aesthetic and Minimalist Design | 4 | Excellent. Proper component usage, semantic colors, no decoration, clean grid layout, responsive mobile view. Data density is high without clutter. |
| 9 | Error Recovery | n/a | Charts are read-only display; error recovery not applicable |
| 10 | Help and Documentation | 2 | Page subtitle explains purpose ("curate which of these appear on main pages"), but individual charts lack inline help or context about what they measure |
| **Total** | | **28/36** | **Good — solid foundation, address control gaps** |

## Design Specificity Verdict

**LLM Assessment**: The charts page is highly product-specific and well-authored for this calculator. Every element reflects understanding of SA retirement planning: retirement age as a pivot, portfolio balance projections, Monte Carlo success rates, income sustainability modeling, and sensitivity analysis. The interface hierarchy and data density match the target audience (financially literate planners), not generic fintech consumers.

The design demonstrates mastery of the project's component system — proper SectionLabel/Card/shadow-none usage, semantic color tokens, responsive spacing patterns. Charts are not interchangeable; they're built for deterministic vs. probabilistic comparison and SA tax/account contexts.

**Detector Findings**: Zero issues. CLI scan found no markup, accessibility, or styling problems. The component follows best practices; no false positives to report.

## Overall Impression

**What works**: This is a clean, data-forward visualization hub. The 2-column grid on desktop, responsive mobile collapse, proper component reuse, and semantic styling all demonstrate craft. The empty state is helpful and guides users to add accounts. Charts load fast (no animations, direct data bind).

**What doesn't work**: Power users hit walls. Charts are display-only; there's no way to export, zoom, or customize the view. The page feels information-rich but interaction-poor.

**Single biggest opportunity**: Add lightweight power-user affordances—export to CSV, hide/show individual charts, or a simple "full-screen" view for any chart. This would unlock the next interaction level without adding clutter.

## What's Working

1. **Component consistency and reuse** — Every chart follows the same pattern: SectionLabel header, Card wrapper with shadow-none, responsive height (180px mobile → 260px desktop), semantic color tokens. Zero visual debt; team can ship new charts without style decisions.

2. **Empty state with navigation** — "Add your retirement accounts first" is not just helpful guidance; it's a soft landing that prevents users from seeing broken/empty charts. The button link to `/calculator/accounts` surfaces the path without friction.

3. **Responsive design** — Mobile (375px) and desktop (1440px) viewports both work. Grid collapses to single column, padding adjusts (px-4 → px-6), chart heights scale intelligently. No horizontal scrolling on mobile; no wasted space on desktop.

## Priority Issues

**[P1] Interaction-poor experience for power users**
- **Why it matters**: Financially literate planners want to export projections, zoom on specific years, or compare scenarios side-by-side. View-only charts feel limiting and undermine the tool's precision positioning.
- **Fix**: Add one export action (CSV for all chart data) and a "fullscreen" view per chart. No new complexity; use existing patterns (Button + modal or new route).
- **Suggested command**: `/impeccable shape` (UX design for export flow and full-screen modal)

**[P1] Individual chart explanations are thin**
- **Why it matters**: First-time users see "Portfolio Growth Over Time" and "Will It Last?" but don't understand what "Likely range" (75th percentile band) vs. "Possible range" (10th–90th) means. Jargon without context causes abandonment.
- **Fix**: Add a one-line explanation under each chart subtitle. Example: "Portfolio Growth Over Time — Deterministic projection; assumes fixed return and contributions." No modal, no fuss.
- **Suggested command**: `/impeccable clarify` (review and improve chart copy)

**[P2] Monte Carlo chart UX during simulation**
- **Why it matters**: When isRunning=true, the page shows "Running simulation…" but users don't see progress or estimated time. Unclear how long it takes or if the page is frozen.
- **Fix**: Add a progress indicator (e.g., "2,847 / 10,000 scenarios complete") or a subtle loading bar. Keep it minimal; this is not an onboarding flow.
- **Suggested command**: `/impeccable polish` (refine the in-progress UX)

**[P2] No help affordance for what each chart is for**
- **Why it matters**: Charts exist ("Cost of Delay," "Sensitivity Tornado") but lack context. Experienced users know; first-timers guess. Heuristic #10 (Help and Documentation) is weak.
- **Fix**: Add a `?` tooltip icon (InfoTooltip component) next to each chart title with a one-sentence definition. Not required for every chart, but critical for "Sensitivity Tornado" and "Cost of Delay."
- **Suggested command**: `/impeccable clarify` (add inline help tooltips)

**[P3] No "curate charts" UX yet**
- **Why it matters**: The page subtitle says "Curate which of these appear on the main pages," but there's no UI to do so. Users read a promise they can't act on.
- **Fix**: Either remove the subtitle (it's aspirational, not shipped) or add toggle buttons ("Show on dashboard") per chart. Current state is a broken contract.
- **Suggested command**: `/impeccable harden` (resolve the curate copy/feature mismatch)

## Persona Red Flags

**Alex (Power User)**: 
- "Export all charts to CSV" doesn't exist; I'm stuck copying numbers manually or taking screenshots.
- Fullscreen mode for any chart would help; 2-column grid is too cramped when I need to focus on one projection.
- Keyboard shortcuts to jump between charts would be nice, but I can live without them.
- **Impact**: Alex will copy manually or export data from the settings page instead. Low friction, but feature gaps are noticed.

**Jordan (First-Timer)**:
- "Sensitivity Tornado" — I have no idea what this is. The word "tornado" is not comforting. No tooltip or help text.
- "Will It Last?" is clear, but "Median" and "Likely range" vs. "Possible range" need definitions. I'm supposed to use this for planning, but I don't understand the bands.
- "Cost of Delay" — delaying what? Cost in what terms? The chart doesn't help without external knowledge.
- **Impact**: Jordan reads the page, feels lost, and closes the tab. High abandonment risk.

**Sam (Accessibility-Dependent)**:
- Charts use proper `role="figure"` and `aria-label` on portfolio growth; that's excellent.
- But tooltips on hover don't work with keyboard-only navigation. I can't access tooltip content without mouse/touch.
- Chart titles use SectionLabel (good contrast); axis labels are small (11px) but meet 4.5:1 on teal/dark. Likely passes WCAG AA at zoom.
- **Impact**: Sam can navigate and read chart summaries, but interactive tooltips are inaccessible. Partial experience.

## Minor Observations

- **Responsive padding**: Correct use of `px-4 md:px-6` and `pt-4 md:pt-6`. Adapts well to mobile.
- **Ghost placeholder charts**: Portfolio Growth and Monte Carlo show a faint curve and dashed retirement line when empty. Nice touch; users understand the shape before data loads.
- **Chart container scrolling**: `overflow-x-auto` on mobile prevents horizontal scroll; good mobile discipline.
- **isAnimationActive={false}**: Area chart disables animation; smart choice for a data-dense tool (no distraction, instant readability).
- **useMemo on totals**: Calculates weighted return, fees, escalation once per render; efficient.

## Questions to Consider

- **What if the primary action on this page were "Export all data"?** Right now, charts are the primary surface. For power users, export might be higher value. Where does that button live—top-right, or per-chart?
- **Should individual charts have their own settings modal?** (e.g., "Show/hide bands," "Toggle grid," "Change time range"). Or is that complexity you want to avoid?
- **How would a user know to hover for tooltips on desktop?** Could a `i` icon or inline hint improve discoverability?
- **Is the 2-column grid final, or should users be able to customize it later?** The page subtitle hints at curation; what's the actual intent?
