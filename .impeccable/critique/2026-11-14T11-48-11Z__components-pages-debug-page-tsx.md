---
target: debug page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-11-14T11-48-11Z
slug: components-pages-debug-page-tsx
---
Method: dual-agent (A: a6ef4d0917b009092 · B: a96c38d80c56426ae). A was source-only (no screenshots, Playwright browser not installed); B used chrome-devtools MCP.

## Design Health Score: 28/40 (Good, low band)

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | No page-level verdict; "N checks match" is a small card description |
| 2 | Match System / Real World | 3 | Engine / Independent / Difference suits the audience |
| 3 | User Control and Freedom | 3 | Filter clear button only in the zero-results state |
| 4 | Consistency and Standards | 3 | text-base h2 group headings compete with SectionLabel |
| 5 | Error Prevention | 3 | Filter hides sections but nav still links to them |
| 6 | Recognition Rather Than Recall | 3 | Sticky nav has no active-section indicator |
| 7 | Flexibility and Efficiency | 3 | No filter shortcut, no per-check copy, no collapsing |
| 8 | Aesthetic and Minimalist Design | 2 | ~13 equal-weight cards flatten hierarchy |
| 9 | Error Recovery | 3 | Mismatch row has no tolerance, cause or next step |
| 10 | Help and Documentation | 2 | Notes explain the route, not what a mismatch means |

## Design Specificity Verdict
Mostly authored (reconciliation table is a real instrument pattern) but visual layer is generic shadcn; Match renders as muted grey, the same as "Not comparable", and no verdict is stated.
Detector: CLI 0 findings on debug-page.tsx and app/calculator/debug/page.tsx. Browser overlay 28 hits, 18 from the app shell (brand mark, ⌘K, hidden mobile tab bar); 10 on the page: 11 SectionLabel 10px (design-system pattern), intro line ~108ch, all-caps-body (false positive), em-dash-overuse (33, mostly placeholder dashes), 1 unpinned cramped-padding.

## Priority Issues
- [P1] No verdict; Match visually silent (debug-page.tsx:284-294, :180-186). Fix: one status line at top ("All 8 checks match" / "2 of 8 disagree"), Match gets foreground weight/teal, skipped and pending subordinate. Command: clarify.
- [P1] Five-column table on mobile (:251-301). No page overflow at 390px but the table extends past the right edge (scroll container unverified). Fix: stack rows below md or wrap in overflow-x-auto. Command: adapt.
- [P2] Flat hierarchy and long scroll (:209-229). Fix: collapse Reference by default, h2 group titles to SectionLabels or drop. Command: distill, layout.
- [P2] Mismatch has no next step (:284-294). Fix: show tolerance used, "Copy this check", row tint bg-destructive/5 (no side stripe). Command: harden.
- [P3] Filter/nav/copy gaps (:161-207). Dead anchors when filtered, no aria-current, hardcoded top-12, "Recalculating…" inside intro paragraph. Command: polish.

## Persona Red Flags
Alex: no filter shortcut; copy is all-or-nothing; sections not collapsible/deep-linkable.
Sam: duplicate sr-only h2 plus visible label; muted result text contrast borderline in light mode; bare — in Difference column needs an accessible label.
SA verifier: tolerance and nominal/real basis not shown by checks; tax year far from tax checks; Match looks like Not comparable.

## Minor Observations
- :107-109 "four of them" hardcoded; derive from model.checks.length.
- :176-195 two ids (reconciliation, reconciliation-card) plus duplicate sr-only h2.
- :163 bg-background/95 on sticky nav lets content ghost through.
- Intro ~108ch exceeds the 65-75 cap.
- One console issue: a form field with no id or name (likely the filter input).
- 10px SectionLabel is a system-wide choice; decide separately.

## Questions to Consider
- If the page's one job is "does everything match?", why does its first line describe the compounding method?
- Is Reference debug evidence, or documentation?
- What would the page look like if a mismatch were the normal case?
