---
target: debug page
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-11-14T11-55-49Z
slug: components-pages-debug-page-tsx
---
Method: dual-agent (A: aa37e0580ca7a1ef7 · B: ac688e0960c22a04f)

Score 26/40 (Acceptable). Detector: 0 findings. Browser overlay skipped (Chromium missing); populated state not rendered.

Priority issues:
- [P1] Filter does not apply to Reconciliation tab (debug-page.tsx:202-203) - clarify, harden
- [P1] Small text contrast likely fails AA (lines 326, 356, 413; estimated) - audit, colorize
- [P2] Mobile tab strip clips "Reference" at 390px (lines 176-188) - adapt
- [P2] aria-label on span (line 366) ignored; copy buttons ~28px (line 313) - harden
- [P2] Noisy, dead-end empty state - clarify, distill

Minor: Minus icon shared by Pending and Not comparable; verdict text-base vs 1.25rem token; no in-content page title; two live regions; check default theme is dark.
