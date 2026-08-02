---
target: calculator/expenses
total_score: 25
p0_count: 0
p1_count: 2
timestamp: 2026-06-14T20-42-46Z
slug: calculator-expenses
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good inline edit feedback; Supabase sync is silent |
| 2 | Match System / Real World | 3 | Plain language; "4% Rule" explained inline |
| 3 | User Control and Freedom | 2 | No undo or confirmation for destructive group deletion |
| 4 | Consistency and Standards | 3 | Consistent hover-reveal + inline edit UX |
| 5 | Error Prevention | 1 | Group deletion is instant, zero-confirmation |
| 6 | Recognition Rather Than Recall | 3 | "in retirement" causal link easy to miss |
| 7 | Flexibility and Efficiency | 3 | Enter/Escape shortcuts; no drag-to-reorder |
| 8 | Aesthetic and Minimalist Design | 3 | Clean and dense; 4% card slightly hero-metric-adjacent |
| 9 | Error Recovery | 2 | Supabase errors silently suppressed |
| 10 | Help and Documentation | 2 | No empty-state onboarding |
| **Total** | | **25/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment**: No gradient text, no icon-card grids, no glassmorphism. The biggest tell is PageHeader using `text-[10px] uppercase tracking-[0.2em]` for the page title — the absolute-banned eyebrow pattern on every page.

**Deterministic scan**: detect.mjs returned 0 findings. Clean at the CSS level.

**Browser**: Unavailable (session conflict). Source analysis only.

## Priority Issues

**[P1] No delete confirmation for group deletion** — Group trash icon at h-3 w-3, adjacent to collapse chevron, instant delete with no undo. Data-loss risk. Fix: AlertDialog confirmation or undo toast.

**[P1] No empty state** — `groups.length === 0` shows blank main column. Summary cards show zeros. Fix: Centered empty-state with CTA.

**[P2] "In retirement" toggle under-weighted** — 10px pill drives 4% Rule Target (six-figure planning number). Fix: Tooltip + causal animation on the target card.

**[P2] PageHeader eyebrow pattern banned** — `page-header.tsx:11` uses `text-[10px] uppercase tracking-[0.2em]`. 4% sub-labels repeat at `text-[10px] uppercase tracking-wide`. Fix: `text-sm font-semibold` for header; `text-xs text-muted-foreground` for sub-labels.

**[P2] Hover-only interactive elements inaccessible** — Edit/delete buttons invisible on keyboard focus (`opacity-0` without `focus:opacity-100`). Color swatches have no `aria-label`. Icon-only buttons unnamed. Fix: `focus:opacity-100` + aria attributes.

## Persona Red Flags

**Alex**: No drag-to-reorder despite `sortOrder` fields in types. No keyboard shortcut for New Group.

**Riley**: Group deletion may orphan expenses in store (component never calls removeExpense for group children). Negative amounts allowed in expense inputs. Empty "By Group" card renders with no placeholder.

**Sam**: Spending progress bar (h-1) has no ARIA equivalent. Color swatches opaque to screen readers. Group color dot has no text alternative.

## Minor Observations

- By Group bars normalize to maxGroupTotal (relative, not absolute) — labeling would clarify
- AddGroupRow Enter only on name input, not color picker
- Income shows raw number in edit mode ("50000" not "50 000")
- 4% formula explanation ("× 300") could add "= 25 years of annual expenses" for clarity
- syncFromDb("") offline seed fires on every mount; may race with hydration
