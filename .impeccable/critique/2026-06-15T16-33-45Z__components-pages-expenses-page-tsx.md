---
target: expenses page
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-06-15T16-33-45Z
slug: components-pages-expenses-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No confirmation after expense edits or additions; deletion feedback only on groups |
| 2 | Match System / Real World | 3 | Domain language correct; "not in retirement" double-negative is verbose |
| 3 | User Control and Freedom | 3 | Cancel everywhere, AlertDialog for group delete, but no undo after saves |
| 4 | Consistency and Standards | 2 | Group deletion is guarded with confirm dialog; individual expense deletion in EditRow is not |
| 5 | Error Prevention | 2 | Expense delete has no confirmation; no amount validation; negative amounts allowed |
| 6 | Recognition Rather Than Recall | 2 | Edit pencil is opacity-0 until hover; income click-to-edit is visually invisible |
| 7 | Flexibility and Efficiency | 3 | Enter/Escape in all inline edit forms is good; no drag-to-reorder despite sortOrder field |
| 8 | Aesthetic and Minimalist Design | 3 | Mostly clean; per-row retirement badge creates noise at scale |
| 9 | Error Recovery | 2 | Group deletion guarded; expense deletion unguarded and unrecoverable |
| 10 | Help and Documentation | 3 | Good tooltips on Income and 4% Rule; missing one on the retirement toggle |
| **Total** | | **25/40** | **Acceptable — targeted fixes needed** |

---

## Anti-Patterns Verdict

**LLM assessment**: Not obviously AI-generated. The edit-in-place interaction, group color identity system, and PageCard/SectionLabel discipline are all above average. The 4% Rule card with its gold tint and InfoTooltip shows design intent. No hero metrics, no gradient text, no tracked uppercase eyebrows. The main anti-pattern risk is the verbose `"in retirement"` / `"not in retirement"` pill label repeating on every row — it creates visual stutter in a list of 10+ expenses that begins to feel like a data entry form from a previous era.

**Deterministic scan**: The detector returned zero findings — no banned patterns (side-stripe borders, gradient text, glassmorphism, identical card grids) detected in the file. Clean.

**Visual overlays**: Browser automation not invoked for this run; critique is source-only.

---

## Overall Impression

The bones are solid: the two-column layout, the inline editing pattern, and the group color identity system are all well-considered. The page earns the "tool-like" register it's aiming for. The single biggest opportunity is fixing the **asymmetric deletion protection** (group delete has a confirm dialog, expense delete does not) which is a real data-loss risk, and the **hover-only affordances** that make the primary edit interaction invisible on touch devices and for first-time users.

---

## What's Working

1. **Keyboard-first inline editing.** Enter to save, Escape to cancel in every form row. This is the right call for a data-dense financial tool — it stays out of the way of fast users.
2. **Group color identity.** The 3px top bar + colored dot pairing gives each group a visual anchor without overusing the gold accent. The "By Group" breakdown bars in the summary panel reuse the same colors, which is good visual consistency.
3. **4% Rule card.** The `bg-primary/5 border-primary/20` card with the InfoTooltip tooltip explanation is one of the best-designed cards on the page — it surfaces a derived insight with clear hierarchy: description → target number → breakdown.

---

## Priority Issues

**[P0] Expense deletion is unguarded**
- **What**: The Trash2 button inside `EditRow` calls `onDelete()` immediately with no confirmation. Only group deletion has an `AlertDialog`. A single misclick while editing permanently destroys an expense with no undo.
- **Why it matters**: Financial data entry. Users who accidentally tab/click to the trash button lose work silently. The asymmetry with group deletion also violates Heuristic 4 — same action, different protection level.
- **Fix**: Wrap the `onDelete` call in the same `AlertDialog` pattern already used for group deletion, or at minimum add `window.confirm()` as a fallback. Ideally, mirror the AlertDialog pattern for consistency.
- **Suggested command**: `/impeccable harden`

**[P1] Edit affordances are invisible to touch and keyboard users**
- **What**: The edit pencil (`Pencil` icon) on each expense row is `opacity-0` until hover (`group-hover/row:opacity-60`). On touch devices, there is no hover state, making expenses appear un-editable. The income amount in the Summary panel is similarly hidden behind a hover-only pencil. There's no affordance that these values are interactive.
- **Why it matters**: Touch is the only interaction model on mobile. A user on a phone will see a list of expenses with no visible way to edit them — they may not know the feature exists. The Income tooltip says "Click the amount to edit" which helps discoverability, but the interaction itself has no affordance.
- **Fix**: Show the pencil icon at reduced but non-zero opacity always (e.g. `opacity-30`) on touch breakpoints, or replace the hover-reveal pattern with a persistent action row that appears when a row is tapped. At minimum, make the income value have a subtle underline or `cursor-pointer` that signals editability.
- **Suggested command**: `/impeccable adapt`

**[P1] "In retirement" / "not in retirement" toggle is verbose and causes visual noise at scale**
- **What**: Each expense row carries a full-text pill badge — 10px text, two distinct labels ("in retirement" vs "not in retirement"). With a typical budget of 15–20 expenses, you're scanning "not in retirement" 12 times in a list. The double-negative reads slowly. At `text-[10px]` this text is also below recommended minimum size.
- **Why it matters**: This is the most important binary decision per expense (it directly drives the 4% rule target), but it's rendered as the smallest, noisiest element. The decision deserves a cleaner, faster affordance.
- **Fix**: Replace the text badge with a toggle switch or a simple icon (e.g. a filled/outlined `Sunset` or `TrendingDown` icon with an aria-label). This reduces the visual noise from 2 words × N expenses to a single glyph per row. Add a column header or SectionLabel above the list to label what the toggle means, so it doesn't need to be spelled out per-row.
- **Suggested command**: `/impeccable distill`

**[P2] Group color palette is mismatched for dark theme**
- **What**: `GROUP_COLOR_OPTIONS` are all Tailwind 300-tier pastels (`#fca5a5`, `#7dd3fc`, etc.) — light colors designed for white backgrounds. On `bg-muted/30` header background in dark mode, these colors render as low-saturation washes. The 3px top bar barely registers. The colored dots are visible but look desaturated against dark surfaces.
- **Why it matters**: The color system is a core part of the group identity pattern. If the colors don't pop on dark, the visual differentiation between groups weakens and the "By Group" summary bars look pale and unconfident.
- **Fix**: Either swap in 400-500 tier Tailwind colors (more saturated, still readable on dark), or maintain the 300 pastels but increase the top bar height to 4px and the dot to 10×10 to compensate. Better: offer two palettes (light/dark) selected by theme, or use 500-tier colors as defaults in the color picker.
- **Suggested command**: `/impeccable colorize`

**[P2] No feedback after add/edit actions**
- **What**: Adding an expense causes the row to instantly appear. Saving an edit causes the EditRow to vanish and the display row to reappear. No animation, no success state, no transient highlight. The transition is abrupt.
- **Why it matters**: In a financial planning tool, feedback that "your change was saved" builds trust. Without it, users may click save multiple times or doubt whether the action registered.
- **Fix**: A 400ms background highlight on the newly saved row (e.g. `bg-primary/10` fading to transparent) is enough. This is a standard pattern for table row updates and doesn't require a toast library.
- **Suggested command**: `/impeccable animate`

---

## Persona Red Flags

**Alex (Power User — financially literate SA user running projections)**
- No drag-to-reorder despite `sortOrder` field on both groups and expenses. Alex will want to order groups by priority (housing first, then discretionary), currently can't.
- Expense row actions are hidden behind hover. Alex working fast will tab into an edit row, then find no obvious delete confirmation mismatch (versus the group confirm dialog).
- No batch "mark all as in retirement" or "mark all as not" action. With 20+ expenses, toggling one by one is friction.

**Sam (Accessibility-dependent user)**
- The color picker in `AddGroupRow` uses 16×16px color swatch buttons — below the 44×44px minimum touch target. Keyboard selection of colors requires tabbing through each swatch with only a `border-foreground` ring on selected.
- `opacity-0` edit affordances require hover. Screen reader and keyboard users discover the button only by tabbing to it — no label context visible that this element exists.
- The retirement toggle badge is `text-[10px]` — below WCAG minimum size recommendations. At small viewport zoom levels this becomes illegible.

**Casey (Mobile user with one hand)**
- Edit affordances are hover-only — no path to edit on mobile except direct tap on the pencil which doesn't exist in a visible state.
- Color swatches are 16px — significantly below 44px touch target minimum.
- The "Add expense" button at the bottom of each group is `py-2` with `text-xs` — near the minimum but tight.
- Primary action (New Group) is top-right in the header — in the thumb-dead zone on a tall phone.

---

## Minor Observations

- `SectionLabel` is used inside the `4% Rule Target` card for "In retirement" and "Not in retirement" sub-labels. These carry the gold left-border style which visually competes with the section identity. Consider `text-xs text-muted-foreground uppercase tracking-wide` for sub-metric labels within a card to avoid ambiguity.
- The `h-1 rounded-full bg-muted` progress bar in Monthly Summary has no axis (no "0%" or "100%" labels) and no threshold marker for "healthy" spending ratio. A subtle dashed marker at 80% income would add financial context.
- `ChevronRight`/`ChevronDown` collapse indicators are `h-3.5 w-3.5` — small but acceptable. The collapsed state remembers position but resets on re-mount (local `useState` in `GroupSection`), so collapsing a group and navigating away loses the state.
- The `AddGroupRow` inline form appears at the top of the groups list when active. But if there are 5+ groups, this means the user adds a group at the top and must scroll down to find it (groups are rendered in `sortOrder` order). Consider scrolling the new group into view after creation.

---

## Questions to Consider

- The `sortOrder` field exists on both groups and expenses — why not expose drag-to-reorder? Was this deferred intentionally, and if so, is there a lighter-weight "move up/down" alternative that would unblock it?
- Should the retirement toggle be a column-level concept rather than per-row? For example: each group could default to "all in retirement" or "all not in retirement," with per-expense overrides. This would reduce the number of decisions required.
- The income field in the Summary panel is the only input that doesn't follow the inline edit form pattern of the expense rows — it's a click-to-expand pattern. Should income be a proper `PageCard`-style field in the main content area instead of buried in the sidebar?
