---
target: plan page
total_score: 26
p0_count: 0
p1_count: 0
p2_count: 2
p3_count: 2
timestamp: 2026-06-14T20-06-36Z
slug: app-calculator-plan
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live feedback throughout (years, inflation-adjusted income, formatted monetary hints); still no autosave or calculation-in-progress indicator |
| 2 | Match System / Real World | 3 | Monetary hints ("R 600 000 / year", "R 18 756 / month today") close the register gap; inputs still show raw integers |
| 3 | User Control and Freedom | 2 | No undo; no reset-to-SA-defaults; instant state commits on every keystroke |
| 4 | Consistency and Standards | 3 | Four cards with distinct conceptual scopes; each card description now accurately reflects its contents |
| 5 | Error Prevention | 3 | Cross-field validation (retirementAge > currentAge, lifeExpectancy > retirementAge) now catches the silent projection failures |
| 6 | Recognition Rather Than Recall | 3 | Medical Aid & Tax Credits sub-label contextualises the inputs; Strategy label properly linked via htmlFor |
| 7 | Flexibility and Efficiency | 2 | Tab order works; no keyboard shortcuts, no "reset to SA defaults" quick action, no power-user shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | 10-input Market Assumptions card split into focused 6-input + 5-control cards; Expected Inflation field orphaned in half-width grid |
| 9 | Error Recovery | 2 | Inline Zod error messages; still mechanical (no plain-language recovery copy with next-step suggestions) |
| 10 | Help and Documentation | 2 | InfoTooltips substantive and SA-specific; no searchable docs, no first-run guidance |
| **Total** | | **26/40** | **Acceptable — structural improvements from 25 → 26; ceiling blocked by missing control/efficiency features** |

---

## Anti-Patterns Verdict

**LLM assessment**: No AI-slop signals. The card split has clarified the information architecture without introducing decorative clutter. The four-card sequence now reads as a logical planning progression: who you are → what you want → what the market does → how you withdraw. That's a meaningful narrative structure, not cards for cards' sake.

**Deterministic scan**: Clean. Zero findings. All five source files pass.

---

## Overall Impression

The structural issues from the first critique are resolved. The page now has four conceptually coherent cards instead of a 10-input catch-all. Cross-field validation prevents the silent retirement-age corruption. The biggest remaining friction: the Expected Inflation field sits alone in the left half of a two-column grid with nothing on the right — a layout scar from the refactoring. Everything else is P3.

---

## What's Working

1. **Card sequence is now a planning narrative.** Personal facts → income goal → market model → withdrawal plan. A user can read down the page and understand the order of decisions.
2. **Monetary hints close the register gap.** "R 18 756 / month today — at retirement (30 years) this equals R 93 479 / month" is precise, SA-specific, and shows the consequence of both the raw input and the inflation assumption simultaneously. This is the right pattern for a calculation instrument.
3. **Medical Aid & Tax Credits now has a label.** The s6A credit inputs are no longer orphaned after the sliders — their purpose is clear at a glance.

---

## Priority Issues

### [P2] Expected Inflation field uses half-width 2-column grid with empty right cell

**What**: In Market Assumptions, the Expected Inflation field sits in the left cell of a `grid-cols-2` wrapper. The right cell is empty — a layout artefact from placing a single field in a grid sized for two.

**Why it matters**: Empty grid cells signal unfinished UI. Users scanning the card may pause expecting a second field that isn't there.

**Fix**: Drop the grid wrapper. Use a simple full-width `<div className="space-y-2">` for the single inflation field, matching how a standalone field is treated elsewhere. If a second field feels warranted (e.g. a "Real return preview" read-only display showing equityReturn − inflation), add it — that would genuinely fill the slot and add useful derived context.

**Command**: `/impeccable layout plan page`

---

### [P2] Retirement Goals card has no description and feels sparse with 2 fields

**What**: The card has two fields (Desired Monthly Income, Legacy Goal) and no description text. After removing the inflation rate field, the card is notably lighter than the others.

**Why it matters**: A new user landing here doesn't immediately know what "today's Rands" means or why these two fields together define their retirement target. The card also feels visually imbalanced against the longer Market Assumptions and Drawdown Strategy cards.

**Fix**: Add a `description` prop to the `<PageCard>`: something like `"Your target income and estate goal, expressed in today's purchasing power. The calculator inflates both to your retirement date."` This orients the user without over-explaining.

**Command**: `/impeccable clarify plan page`

---

### [P3] Redundant "PLAN" label in content area

**What**: The content area renders "PLAN" (via `PageHeader`) beneath the topbar which already shows "PLAN". Two identical labels for the same context.

**Why it matters**: Minor visual noise; cosmetic only.

**Fix**: Remove or reuse the `PageHeader` component's label slot for something more descriptive — e.g. "Retirement Plan" or a breadcrumb path showing scenario context.

**Command**: `/impeccable clarify plan page`

---

### [P3] No "reset to SA defaults" action for market parameters

**What**: If a user experiments with aggressive equity return assumptions (e.g. 20%) and wants to restore SA defaults (11%), there's no quick-reset action. They must remember and manually retype defaults.

**Why it matters**: For financially literate users running sensitivity analyses, being unable to snap back to defaults adds friction and introduces recall load.

**Fix**: Add a "Reset to defaults" ghost button in the Market Assumptions card header (via the `trailing` prop on `PageCard`). On click, call `setAssumptions(defaultAssumptions)` and `setRetirementGoals({ inflationRate: SA_DEFAULTS_DISPLAY.inflation })`.

**Command**: `/impeccable harden plan page`

---

## Persona Red Flags

**Piet (SA Financially Literate Planner)** *(target user)*

- Inputs "18756" and sees "R 18 756 / month today" — good. Still has to mentally parse the raw number in the input itself.
- Sets retirementAge=60, currentAge=62 → now gets "Retirement age must be after current age" error on the Retirement Age field. Fixed.
- Wants to reset equity return from 20% back to default: no reset button, must recall 11%.
- Tabs through Market Assumptions: Equity → Bonds → Cash → Equity Volatility → Bond Volatility → Inflation. Tab order is logical and correct.

**Riley (Stress Tester)**

- currentAge=40, retirementAge=38: Zod catches it, error appears on Retirement Age. ✅
- currentAge=40, retirementAge=90, lifeExpectancy=85: Zod catches it, error appears on Life Expectancy. ✅
- Changes inflation from 5.5 to 15: Retirement Goals card live-updates the inflation-adjusted income hint. ✅
- Types "abc" in Equity Return input: silently rejected (number input), no visible error. Minor gap remains.

---

## Minor Observations

- The "R 600 000 / year" formatted hint appears only when value > 0. If someone clears the field to 0, no hint appears, which is correct. But for Annual Income specifically, 0 is not a realistic value — consider always showing the hint (even for 0) to reduce the "did my hint disappear?" confusion.
- The Drawdown Strategy card description text ("How you plan to withdraw from your portfolio during retirement.") is accurate but generic. "Your withdrawal rate, lump-sum election, and retirement healthcare costs." would be more scannable.
- The four-card scroll distance is now longer than before. On a 768px viewport the user must scroll through 4 cards to reach Drawdown Strategy. Consider whether the "30 years until retirement" summary panel in Personal Information should persist as a sticky element so users always see their planning horizon.

---

## Questions to Consider

- "Now that inflation is in Market Assumptions, does the 'today's Rands' phrasing in the Desired Monthly Income label still make sense to users who haven't yet scrolled to the inflation field?"
- "The formatted monetary hint in Desired Monthly Income combines two pieces of information in one line. Should these be two separate lines — current value on one, projected value on another — for faster scanning?"
- "Would a 'reset card' ghost button on Market Assumptions create confusion (users might not know what the defaults are), or would it build confidence?"
