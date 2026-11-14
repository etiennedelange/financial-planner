---
target: debug window
total_score: 18
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-11-14T11-34-31Z
slug: components-debug-debug-window-tsx
---
# Critique: Debug Window (components/debug/debug-window.tsx)
Method: dual-agent. Score 18/40 (Poor). A reviewed from source only (no browser).

Priority issues
- [P1] No IA; teal everywhere (515-1022, 1038, 1086) -> distill, layout
- [P1] Side-stripe borders + nested tonal surfaces (1070-1086, 664) -> quieter
- [P1] False-zero / false-reassurance states (586, 711-717, 224-225, 868) -> harden (needs regression test)
- [P2] Mono and typography misuse (1052-1060) -> typeset
- [P2] Access/responsiveness: trigger hidden < md (layout.tsx:72), no aria-labels, contrast 3.8-4.4:1 -> adapt

Detector: side-tab (1085) static; live: 5 side-tab, 4 nested-cards, 16 low-contrast, 1 line-length (page-wide).
