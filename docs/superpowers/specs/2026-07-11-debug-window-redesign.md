# Debug Window Redesign Spec

**Date:** 2026-07-11  
**Status:** Design Approved  
**Scope:** Redesign the debug window from a side Sheet to a centered Dialog with color-coded section organization and improved visual hierarchy.

---

## Problem Statement

The current debug window (`components/debug/debug-window.tsx`) displays 100+ metrics across 20+ sections in a scrollable Sheet panel. This creates:

- **Cognitive overload** — no visual hierarchy, all sections look identical
- **Poor scanability** — hard to distinguish critical calculations from reference data
- **Verification difficulty** — users need to cross-reference calculations across scattered sections

The goal: same information, organized visually so verification is faster and more intuitive.

---

## Solution Overview

**Transform the debug window into a color-coded Dialog** that groups sections by category:

1. **Container:** Dialog (modal) instead of Sheet
   - Centered on screen, `max-w-4xl` (900px)
   - Larger viewing area, more intentional feel
   - Scrollable content, `max-h-[85vh]`

2. **Visual Organization:** Four color-coded categories
   - **Critical Metrics** (highlighted) — top section, most important values
   - **Calculation Inputs** (light teal/muted) — user inputs, assumptions
   - **Calculated Results** (bright accent) — derived values, outcomes
   - **Reference Data** (subtle gray) — constants, defaults, notes

3. **Copy Functionality:** Maintain existing copy-all button
   - Export all debug info as formatted text
   - Include category markers in export (`[CRITICAL]`, `[INPUTS]`, etc.)
   - Same format as current implementation for external verification

4. **Visual Language:** "Stats for nerds" aesthetic
   - Monospace values (precision instrument vibe)
   - Teal + gray palette (no warm colors, clinical/technical)
   - Left-border color coding on each section
   - Tight spacing for density, clear section separation

---

## Detailed Design

### 1. Container & Dialog Structure

**Component Replacement:**
- Replace `<Sheet>` with `<Dialog>` from `@/components/ui/dialog`
- Keep trigger button (Bug icon, bottom-right of screen)

**Dialog Styling:**
```
- max-w-4xl (900px) for comfortable multi-section scanning
- max-h-[85vh] for viewport respect
- Centered on screen
- Semi-transparent backdrop (default Dialog behavior)
- Rounded corners, subtle shadow
- Fade-in + slight scale animation on open
```

**Header:**
- Title: "Debug: Calculation Parameters"
- Subtitle (optional): "Verify all calculation inputs, assumptions, and results"
- Copy-all button (maintains current functionality)
- Close button (X)

**Content Area:**
- Scrollable (`<ScrollArea>`)
- Right padding for scroll gutter (`pr-4`)
- `space-y-6` for section separation (generous)

**Responsiveness:**
- Desktop: `max-w-4xl`
- Mobile: `max-w-[95vw]`
- Single column layout at all sizes

---

### 2. Color-Coded Section Categories

Each section gets a **left border + subtle background** based on its category.

#### Category 1: Critical Metrics (Highlighted)

**Visual Treatment:**
- Background: `bg-primary/15`
- Border-left: `border-l-4 border-primary` (full saturation)
- Subtle glow effect (optional): `shadow-sm shadow-primary/20`

**Content:**
- Calculation Method (already prominent, stays prominent)
- Portfolio at Retirement
- Success Rate
- Years to Depletion
- Replacement Ratio
- Below Tax Threshold (Yes/No)

**Purpose:** Top section, always visible. Answers "Is this scenario viable?" at a glance.

---

#### Category 2: Calculation Inputs (Light Teal/Muted)

**Visual Treatment:**
- Background: `bg-primary/5`
- Border-left: `border-l-4 border-primary/40`

**Sections:**
- Personal Information (Age, Retirement Age, Life Expectancy, Income)
- Retirement Goals (Desired Income, Inflation, Legacy)
- Accounts (List of all accounts with balances, contributions, returns, fees)
- Market Assumptions (Equity Return, Bond Return, Cash Return, Volatility, Inflation)
- Drawdown Configuration (Strategy, withdrawal rates, guardrails, medical aid)
- Retirement Eligibility & Tax Deductions (RA access, preservation fund, deductions, tax savings)

**Purpose:** What went in. Shows all user-configured values and defaults used.

---

#### Category 3: Calculated Results (Bright Accent)

**Visual Treatment:**
- Background: `bg-primary/10`
- Border-left: `border-l-4 border-primary` (full saturation)

**Sections:**
- Portfolio Aggregates (Calculated) (Weighting method, totals, weighted return/fees, net return, monthly return, escalation)
- Withdrawal Details (At Retirement) (Desired income, inflated income, initial withdrawal annual/monthly, strategy, replacement ratio)
- Tax Calculations (Retirement Phase) (Income tax, effective rates, rebates, thresholds, net income)
- Projection Results (Deterministic) (Portfolio at retirement, monthly income, depletion age, surplus/shortfall, projection years) — **if available**
- Monte Carlo Simulation Results (Success rate, runs, median depletion age, final balance, percentile analysis) — **if available**

**Purpose:** What came out. All derived values, projections, and outcomes.

---

#### Category 4: Reference Data (Subtle Gray)

**Visual Treatment:**
- Background: `bg-muted/30`
- Border-left: `border-l-4 border-muted-foreground/40`

**Sections:**
- SA Default Constants (Inflation, medical inflation, equity/bond/cash returns, volatility, safe withdrawal rate, base medical cost)
- Spending Phase Multipliers (Go-Go/Slow-Go/No-Go percentages and medical premiums)
- Accuracy Notes (Compounding method explanation, data source notes, single source of truth reference)

**Purpose:** Reference info, doesn't change often, less critical for verification.

---

### 3. Section Content & Styling

**Section Title:**
```
<h3 className="font-semibold text-sm mb-3 text-primary">{title}</h3>
```

**Parameter Rows (Param component):**
```
<div className="flex justify-between items-center text-sm">
  <span className="text-muted-foreground">{label}:</span>
  <span className="font-mono">{value}</span>
</div>
```

**Key styling:**
- Labels: `text-xs text-muted-foreground` (secondary, precise)
- Values: `font-mono text-sm` (precision instrument vibe)
- Highlighted critical values: `font-semibold text-primary`
- Tight spacing within sections: `space-y-2`
- Generous padding inside colored cards: `p-4`

**Separator between categories:**
```
<Separator className="mt-6 mb-6" />
```

---

### 4. Copy Functionality

**Copy-all Button:**
- Location: Dialog header, next to title
- Trigger: Click to copy entire debug info as formatted text
- Feedback: Show "Copied!" for 2 seconds (already implemented)
- Behavior: Maintains current text export format

**Export Format Changes (Minor):**
- Keep existing section headers and structure
- Add category markers as comments where helpful:
  ```
  =====================================================
  [CRITICAL] PORTFOLIO AT RETIREMENT
  =====================================================
  ```
- Maintains all formulas, checksums, technical details
- Users paste into text editor for external verification (spreadsheet, email, etc.)

---

### 5. Interaction & Animation

**Open Animation:**
- Fade-in + slight scale (2px grow)
- Duration: 200ms, easing: ease-out
- Feels intentional, not jarring

**Close:**
- Escape key
- Backdrop click
- Close button (X)

**Copy Feedback:**
- Button icon changes to checkmark
- "Copied!" tooltip appears
- Auto-revert after 2 seconds

**Scroll Behavior:**
- Dialog stays open during scroll
- Smooth scroll within content area
- Scroll gutter visible on right (`pr-4`)

---

### 6. Visual Language: "Stats for Nerds"

**Aesthetic Goals:**
- Technical precision (not decorative)
- Clinical data presentation (like a test coverage report or debug panel)
- Minimal decoration, maximum clarity

**Color Palette:**
- Teal (`--primary`) + grays (`--muted`, `--muted-foreground`, `--background`)
- No warm colors (no gold, orange, red except for error states)
- Conveys: precision, authority, restraint

**Typography:**
- Section titles: `font-semibold text-sm` (hierarchy, clarity)
- Labels: `text-xs text-muted-foreground` (secondary, technical)
- Values: `font-mono text-sm` (data, precision)
- Monospace values reinforce "this is calculation output"

**Spacing & Density:**
- Tight line-height within sections (`leading-relaxed` or tighter)
- Generous padding inside cards (`p-4`)
- Clear visual separation between color categories
- No unnecessary whitespace

**Borders & Edges:**
- Left borders on all sections (visual anchor, 4px, category-colored)
- Rounded corners on cards (`rounded-lg`)
- No drop shadows on cards (flat, precise aesthetic)
- Subtle borders between parameters within sections (optional, `border-b border-border/30`)

---

## Implementation Approach

### File Changes

**Modified:**
- `components/debug/debug-window.tsx` — Replace Sheet with Dialog, restructure sections into color categories

**No New Files Needed:**
- Use existing `Dialog`, `ScrollArea`, `Separator`, `Button` components from shadcn/ui
- No new components required (keep `Section` and `Param` helper components)

### Section Reorganization

**Current order (flatten into 4 categories):**

| Section Name | Current Order | New Category |
|---|---|---|
| Calculation Method | 1 | Critical Metrics |
| Personal Information | 2 | Calculation Inputs |
| Retirement Goals | 3 | Calculation Inputs |
| Retirement Eligibility | 4 | Calculation Inputs |
| Accounts | 5 | Calculation Inputs |
| Portfolio Aggregates | 6 | Calculated Results |
| Withdrawal Details | 7 | Calculated Results |
| Tax Calculations | 8 | Calculated Results |
| Drawdown Configuration | 9 | Calculation Inputs |
| Market Assumptions | 10 | Calculation Inputs |
| Monte Carlo Configuration | 11 | Reference Data |
| Spending Phase Multipliers | 12 | Reference Data |
| Projection Results | 13 | Calculated Results |
| Monte Carlo Results | 14 | Calculated Results |
| SA Defaults | 15 | Reference Data |

---

## Testing & Verification

**Manual Testing:**
- Open debug window in multiple scenarios (zero balance, retirement soon, etc.)
- Verify color coding appears correctly for each section
- Test copy-all button exports complete, valid text
- Verify dialog opens/closes smoothly, scroll works
- Test on desktop (900px) and mobile (95vw)
- Verify monospace fonts render correctly for data values
- Confirm all current calculations still display (no data loss)

**No Unit Tests Required:**
- This is a presentation/UI refactor, not a calculation change
- Existing DebugWindow props and calculation logic remain unchanged

---

## Scope & Non-Scope

**In Scope:**
- Replace Sheet with Dialog
- Reorganize sections into 4 color-coded categories
- Improve visual hierarchy and typography
- Maintain copy-all functionality
- "Stats for nerds" aesthetic (monospace, teal/gray, technical precision)

**Out of Scope:**
- Individual section copy buttons (use copy-all only)
- Tab navigation (single pane only)
- Collapsible sections (all sections always visible)
- Export to CSV/JSON (text export only)
- Search/filter functionality
- Calculation changes (display-only refactor)

---

## Success Criteria

- ✅ All 100+ metrics still displayed (no data loss)
- ✅ Color-coded sections are visually distinct and well-organized
- ✅ Dialog opens centered, scrolls smoothly, closes cleanly
- ✅ Copy-all button works, maintains current format
- ✅ "Stats for nerds" aesthetic (monospace values, teal/gray, technical precision)
- ✅ Mobile responsive (95vw max-width)
- ✅ Verification workflow improved (faster scanning, clearer hierarchy)

---

## Acceptance Criteria (User Verification)

- User can quickly locate critical metrics (portfolio at retirement, success rate, years to depletion)
- Color coding helps distinguish inputs from outputs from reference data
- Copy-all still works for pasting into external tools
- Monospace aesthetic feels technical and precise
- Dialog feels more intentional than side panel
