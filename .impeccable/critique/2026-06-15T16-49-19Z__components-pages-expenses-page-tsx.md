---
target: expenses page
total_score: 30
p0_count: 0
p1_count: 0
timestamp: 2026-06-15T16-49-19Z
slug: components-pages-expenses-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Flash animation on save ✓; still no flash on new expense add |
| 2 | Match System / Real World | 3 | "Ret." column abbreviation cryptic on mobile (title tooltip won't fire on touch) |
| 3 | User Control and Freedom | 3 | Cancel everywhere, AlertDialogs on both deletion paths — solid |
| 4 | Consistency and Standards | 3 | Expense and group deletion now symmetrically guarded ✓ |
| 5 | Error Prevention | 3 | Both deletion paths guarded ✓; amount validation still absent |
| 6 | Recognition Rather Than Recall | 3 | Pencil `opacity-20` on mobile ✓; income dashed underline ✓; circle icon column labeled ✓ |
| 7 | Flexibility and Efficiency | 3 | Enter/Escape in all forms; no drag-to-reorder (unchanged) |
| 8 | Aesthetic and Minimalist Design | 3 | CircleCheck/Circle icons clean up row noise; column header adds structure |
| 9 | Error Recovery | 3 | Both deletion paths confirmed; flash confirms edits ✓ |
| 10 | Help and Documentation | 3 | Column header labels the icon; tooltips on Income and 4% Rule |
| **Total** | | **30/40** | **Good — address remaining weak areas** |

---

## Anti-Patterns Verdict

**LLM assessment**: No AI slop tells. The icon-based retirement toggle is a significant improvement — the per-row text chatter is gone. The flash animation is subtle and purposeful (state feedback, not decoration). The 400-tier color palette is noticeably richer on dark surfaces. No new patterns introduced that break the design system.

**Deterministic scan**: Zero findings. Clean second run.

---

## Overall Impression

A meaningful jump from 25 → 30. The P0 (unguarded expense deletion) and both P1s (hover affordances, verbose retirement toggle) are resolved. The page now reads like a confident tool rather than a form. The remaining gaps are all P2/P3 — no blockers.

---

## What's Working

1. **Symmetric deletion protection.** Both the group and expense delete paths now use identical AlertDialog patterns. The mental model is consistent: destructive action → confirmation dialog → committed.
2. **CircleCheck / Circle toggle.** Replacing 15+ text badges with a single glyph per row removes visual stutter across the list. The column header `Ret.` + `title` tooltip does enough work for a financially literate audience on desktop.
3. **Flash on save + dashed income underline.** Both are restrained and purposeful — they signal editability and confirm writes without drawing attention away from the data.

---

## Priority Issues

**[P2] "Ret." is untranslatable on mobile**
- **What**: The `title="Include in retirement budget"` tooltip only fires on desktop hover. Touch users see a column labeled "Ret." with circle icons but no explanation. The full aria-label on each icon (`"In retirement — click to exclude"`) is accessible to screen readers but invisible in standard touch UI.
- **Why it matters**: On mobile, the user must guess what the column means before knowing what tapping the circle does.
- **Fix**: Replace the "Ret." column header with the full word "Retirement" (it fits — the column is 4ch wide), or add a persistent `InfoTooltip` icon next to the abbreviation that fires on tap. The latter is already a pattern used elsewhere on this page.
- **Suggested command**: `/impeccable clarify`

**[P2] Add-expense action produces no flash**
- **What**: The `flashId` state in `GroupSection` is only set when `onSave` fires inside `EditRow` (edit path). When a new expense is added via `AddExpenseRow`, no flash occurs — the row just appears silently.
- **Why it matters**: Editing gives visual confirmation; adding doesn't. Minor but inconsistent.
- **Fix**: After `onAddExpense(group.id, name, amount)` resolves, identify the newly added expense (either track its ID from the store's response, or use a `lastAddedAt` timestamp trick) and set `flashId`. Alternatively, flash the entire group body briefly rather than a specific row.
- **Suggested command**: `/impeccable animate`

**[P2] Color swatches remain below touch-target minimum**
- **What**: `w-5 h-5` (20px) is better than the previous 16px but still 2× below the 44px minimum recommended touch target. A user adding a group on mobile will struggle to tap a specific color.
- **Why it matters**: The color picker is only used occasionally (group creation), but it's the first decision made when creating a group — getting it wrong forces a workaround.
- **Fix**: Increase swatch size to `w-7 h-7` (28px) minimum, or better — `w-8 h-8` (32px) with a tap-expanding popover for fine selection. The row can hold 6 swatches at 32px in most viewports; overflow wraps gracefully.
- **Suggested command**: `/impeccable adapt`

---

## Persona Red Flags

**Alex (Power User)**
- Still no drag-to-reorder (unchanged). The `sortOrder` field remains exposed but unexploitable.
- The `CircleCheck` / `Circle` icons are faster to scan than text badges — this is a clear win for Alex working through a long expense list.

**Sam (Accessibility-dependent user)**
- `aria-label` on each retirement toggle icon is present and correct: `"In retirement — click to exclude"` / `"Not in retirement — click to include"`. Screen reader experience is improved.
- Color swatches in `AddGroupRow` are still `w-5 h-5` — keyboard selection requires tabbing through each; `aria-label` on each is correct.

**Casey (Mobile user)**
- Pencil icon at `opacity-20` on mobile is a meaningful improvement — expenses now appear editable at a glance.
- "Ret." column label requires a tap-and-hold (long press) to see the title tooltip on some mobile browsers — not reliable.

---

## Minor Observations

- The `transition-colors duration-700` flash is 700ms. For a "save confirmation" pattern, 700ms works, but the fade-out takes another 700ms after `flashId` clears — meaning the highlight lingers for ~1.4s total. Consider `duration-500` for the fade-out via `transition-colors` without setting `duration` on the row itself (let the browser's default transition handle the fade).
- The collapse state is still local `useState` in `GroupSection` — resets on re-mount. This is unchanged from the first critique. Consider `sessionStorage` keyed to group ID.
- `SectionLabel` used for "In retirement" / "Not in retirement" sub-labels inside the 4% Rule `PageCard` still carries the gold `border-l-2 border-primary` treatment. This gold left-border appears twice inside one card, competing with the card's own section identity. A plain `text-xs text-muted-foreground` label would be cleaner for sub-metric labels within a card.
- The `"Add expense"` button at the bottom of each group is visually light (`text-xs text-muted-foreground`). For a page centered on data entry, the primary action within a group deserves slightly more visual weight — perhaps `text-sm` and a `gap-2` to match the expense row height.

---

## Questions to Consider

- Is the "Ret." abbreviation the right pattern for this audience? SA retirement planning users are domain-fluent — "Ret." is legible to them on desktop. But "Retirement" spelled out takes the same horizontal space as the circle icon column. Worth revisiting.
- Should `AddGroupRow` color swatches be a separate step rather than inline? A "choose color" step post-creation would allow full-screen swatch selection on mobile without cramming 12 20px targets into one row.
- The flash on save is now the primary "write succeeded" signal. Does the app need this only here, or should it be extracted as a shared hook (`useFlash`) for use across other inline-edit patterns on other pages?
