---
target: calculator/expenses
total_score: 22
p0_count: 2
p1_count: 2
timestamp: 2026-06-14T20-52-20Z
slug: app-calculator-expenses
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No save/sync indicator; Supabase debounce fires silently; no loading state when syncFromDb runs |
| 2 | Match System / Real World | 3 | "In retirement" toggle is clear; "Monthly income" ambiguous (gross vs net vs take-home) |
| 3 | User Control and Freedom | 2 | Group delete is instant and irreversible; no undo; single-click trash on hover is low friction for a destructive action |
| 4 | Consistency and Standards | 2 | Three different save patterns (Check icon, click-to-edit inline, Button component); raw `<button>` vs `<Button>` mix loses focus ring consistency |
| 5 | Error Prevention | 1 | Removing a group silently deletes all child expenses; no confirm dialog; no cap or validation on income input |
| 6 | Recognition Rather Than Recall | 3 | Color picker in AddGroupRow uses visual dots (recognition-based); "in retirement" pill is discoverable |
| 7 | Flexibility and Efficiency | 2 | Enter/Escape work in edit rows but Tab focus drops after confirm; no keyboard shortcut for New Group; `inRetirement` toggle has no keyboard hint |
| 8 | Aesthetic and Minimalist Design | 3 | Layout is clean and proportioned; 4% Rule card `bg-primary/5` tint slightly breaks visual rhythm |
| 9 | Error Recovery | 1 | No error states at all; syncFromDb failure is silent; deleteGroup errors swallowed via .catch(console.error) |
| 10 | Help and Documentation | 3 | PageHeader description is useful; 4% Rule has inline "× 300" explanation but no tooltip explaining the 4% SWR assumption |
| **Total** | | **22/40** | **Needs Work** |

---

## Anti-Patterns Verdict

**LLM assessment**: The expenses page largely avoids AI slop at the macro level — no hero metrics with gradient accents, no identical icon-card grids, no tracked-uppercase eyebrows on every section header. The inline editing UX feels intentional and power-user appropriate. The group-card pattern with collapsible sections is correct for this product. Where the page slips is at the detail level: raw `text-[10px] uppercase tracking-wide` strings appear in the 4% Rule Target card's two-column grid, bypassing the `<SectionLabel>` component that exists for exactly this pattern. The total expenses figure is always `text-destructive` (red), which imports consumer-fintech alarm signaling into a context where having expenses isn't inherently a problem. The "By Group" progress bars using arbitrary user-chosen colors create a multi-hue sidebar that fractures the gold-only accent system.

**Deterministic scan**: Detector returned 0 findings (clean). The automated scanner did not flag the `text-[10px] uppercase tracking-wide` pattern — this is a false negative because the pattern exists in JSX className strings rather than a CSS file the detector was scanning. The P1 violation is confirmed by manual review.

**Browser visualization**: Attempted but unavailable — browser tooling reports a single running instance with no isolation. No overlay evidence available for this run. Source-only assessment.

---

## Overall Impression

The expenses page has the right bones: inline editing is fast, group organization is sensible, and the 4% Rule target is a genuinely useful output that makes the abstract retirement goal concrete. What hurts it is a cluster of safety-net omissions (no delete confirm, no undo, no error states, no sync indicator) and two semantic color errors that undermine user trust. The page feels 80% done — the UX model is right but the defensive layer is absent.

---

## What's Working

**1. Inline editing is correct for this product.** Full-page modals for expense rows would be overkill. Edit-in-place with Enter/Escape keyboard flow is exactly the right choice for a tool that targets financially literate power users. The interaction model matches the "Speed of thought" design principle.

**2. The 4% Rule target surfaces a concrete, actionable number.** Linking "in retirement" expenses directly to the SWR portfolio target (and auto-syncing it to `desiredMonthlyIncome`) closes a loop the user would otherwise have to close mentally. The `PageHeader` description explains the mechanic. This is the emotional high point of the page.

**3. Collapsible group sections scale to real use.** A user with 20+ expenses across 5-6 categories can scan group totals in the header without expanding. Color-coded group identity (dot + top bar) gives quick visual grouping. The architecture handles density without feeling cluttered.

---

## Priority Issues

### [P0] Destructive group delete with no confirmation
**What**: `removeGroup()` deletes the group and all child expenses atomically with a single hover-click on a `<Trash2>` icon in the group header.
**Why it matters**: A user with 10+ expenses in a group loses all of them instantly. There is no undo. The trigger is low-contrast (opacity-0, hover reveal) inside a clickable header that also collapses the group — small miss-click radius. Data loss risk is real, especially on touch targets.
**Fix**: Add a confirm dialog before `removeGroup`. At minimum: "Delete [Housing]? This will remove X expenses." with a destructive-styled confirm button. Consider a toast with a 5-second undo window.
**Suggested command**: `/impeccable harden calculator/expenses`

### [P0] Total expenses always shown in red (`text-destructive`)
**What**: Line 309 renders total expenses in `text-destructive` (Signal Red) unconditionally, regardless of whether they exceed income.
**Why it matters**: Red means danger in this design system. A user with R8,000/month in expenses against R56,500 income sees a false alarm on a well-managed budget. This is semantic color misuse that erodes trust in the numbers. Red should be reserved for the surplus line (which correctly toggles by sign) — not the absolute expenses total.
**Fix**: Change `text-destructive` to `text-foreground` on the total expenses value. The surplus row already handles the income-vs-expense comparison correctly with conditional coloring. Remove the redundant alarm signal.
**Suggested command**: `/impeccable polish calculator/expenses`

### [P1] Raw `text-[10px] uppercase tracking-wide` bypasses `<SectionLabel>`
**What**: Lines 352 and 356 in the "4% Rule Target" card's two-column grid use raw Tailwind strings (`text-[10px] uppercase tracking-wide text-muted-foreground`) instead of the `<SectionLabel>` component. CLAUDE.md explicitly bans this pattern.
**Why it matters**: Breaks the design system's canonical label pattern; makes future style updates require hunting for inline strings rather than updating one component. Also violates the project's own coded rules.
**Fix**: Replace both raw `<p>` labels with `<SectionLabel>In retirement</SectionLabel>` and `<SectionLabel>Not in retirement</SectionLabel>`. The SectionLabel component renders the correct monospace label style without inline Tailwind noise.
**Suggested command**: `/impeccable polish calculator/expenses`

### [P1] "Monthly income" is semantically ambiguous for SA tax context
**What**: The editable income field has no indication of whether it expects gross salary, net take-home, or some other income definition. No tooltip, no label subtext.
**Why it matters**: For SA users doing retirement planning, the difference between gross (R56,500) and net take-home (R38,000–R44,000 at typical marginal rates) changes the surplus calculation by 25–35%. A surplus that shows green on gross income may be negative on take-home. This is a trust/accuracy failure on the most financially sensitive page in the app.
**Fix**: Add a tooltip or sub-label clarifying "after-tax monthly take-home" (or whichever the store expects). Update the PageHeader description or add an `InfoTooltip` component to the income row.
**Suggested command**: `/impeccable clarify calculator/expenses`

### [P2] No empty state for zero groups
**What**: When `groups.length === 0` (before default seeding fires, or if a user deletes all groups), the main column renders nothing — blank space under the PageHeader.
**Why it matters**: Jordan (first-timer) may arrive to a blank column with no guidance. The only CTA is the "New Group" button in the header, which is easily missed. A blank screen communicates that something is broken, not that something is pending.
**Fix**: Render an empty state inside the groups column when `groups.length === 0`: a short label ("No expense groups yet") and a primary "Create your first group" button that triggers the same `addingGroup` state as the header button. This is the right place for teaching through action.
**Suggested command**: `/impeccable onboard calculator/expenses`

---

## Persona Red Flags

**Alex (Power User)**:
- After confirming an edit row with Enter, focus drops to the document root — no `focusNext` behavior. Alex expects to tab through expenses without reaching for the mouse.
- The `inRetirement` toggle is a `<button>` with no visible keyboard shortcut or hint. Alex can tab to it (Enter activates it), but there's no affordance to suggest this.
- No hotkey for "New Group." In a tool modeled on Linear/Raycast, the obvious expectation is `n` or `g` to open a group creation row without touching the mouse.
- The `<Pencil>` edit button has no `aria-label` — screen reader announces it as an unlabeled button.

**Jordan (First-Timer)**:
- Income field default (R56,500) is click-to-edit with no visual affordance. It looks like a static label. Jordan won't know it's editable until hovering. Should render with a subtle edit icon or underline treatment.
- The 4% Rule explanation ("Monthly retirement expenses × 300") is accurate but opaque to a newcomer. Jordan doesn't know where the 300 comes from or what to do with the resulting number. A one-line tooltip explaining "covers 25 years at 4% annual withdrawal" would close this gap.
- Empty state risk: if Jordan arrives before default seeding and sees a blank page, they may conclude the app isn't working.

**Marcus (SA-specific power user)**:
- No monthly vs annual entry mode. Marcus likely pays some expenses annually (insurance premiums, levies, school fees) and would need to mentally divide by 12 before entry. This is SA-specific friction — annual billing cycles are common.
- The 4% SWR multiplier (300) is hardcoded. Marcus doing a conservative SA plan (high inflation, CPI 6%+) may want to model 3% or 3.5% SWR, which is 400x or ~343x. No customization exposed.
- No inflation adjustment flag. The target is shown in today's Rands. Marcus knows that R30,000/month today is not R30,000/month in 20 years. The absence of a "real vs nominal" indicator is a trust issue for a serious projector.
- Default income of R56,500 reads as calibrated for a sub-median SA professional. Marcus earning R150,000+/month will distrust tool defaults as soon as he opens the page.

---

## Minor Observations

- `AddGroupRow` uses `mb-3` on its container while the parent wraps `GroupSection` items in `space-y-3`. The add-row will render with ~12px more bottom margin than expected — visual inconsistency when the row transitions to a group card.
- The "By Group" sidebar card hides groups with zero expenses (`.filter(x => x.total > 0)`). A newly-created group never appears until an expense is added. This is correct behavior but creates a micro-confusion moment right after group creation.
- `formatCurrency(expense.amount)` inside a fixed `w-20` span will overflow or truncate for amounts ≥ R100,000 without visual warning.
- `Trash2` on the group header uses `title="Delete group"` but no `aria-label`. `Pencil` on expense rows has neither. Screen readers will announce "button" with no context.
- The 3px top color bar on `GroupSection` is a horizontal top-strip accent that mirrors the semantics of a left-stripe border (visual encoding of group identity through a color bar). While not technically the banned `border-left`, it's in the same pattern family. Worth reviewing: consider using only the color dot in the header, and let the border/background be the visual container.
