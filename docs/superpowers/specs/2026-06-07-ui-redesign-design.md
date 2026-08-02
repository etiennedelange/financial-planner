# UI Redesign — Left Sidebar Shell

**Date:** 2026-06-07  
**Status:** Approved for implementation

## Overview

Replace the current single-column scroll layout with a fixed app shell: 220px left sidebar, sticky top bar, scrollable page content area, and a right Sheet panel for account add/edit. Navigation moves from collapsible sections to four distinct SPA-style page views.

Design goals: modern, minimal, snappy.

---

## Shell Layout

Fixed full-viewport layout (`min-h-screen flex`). Never scrolls at the shell level — only the page content area scrolls.

```
┌──────────────┬──────────────────────────────┐
│              │  Top bar (48px, sticky)       │
│  Left        ├──────────────────────────────┤
│  Sidebar     │                              │
│  (220px)     │  Page content (scrollable)   │
│  fixed       │                              │
└──────────────┴──────────────────────────────┘
```

When the Account Sheet is open, it overlays the content area from the right (does not push the layout).

---

## Left Sidebar

**Width:** 220px, fixed, full-height  
**Background:** `bg-card` (existing semantic token — works across all color and dark/light themes)

Three zones top-to-bottom:

### Top — Wordmark
App name "SA Retirement" in small all-caps label style. No logo needed.

### Middle — Navigation
Four items with icon + text label. Active item: `bg-primary text-primary-foreground` pill. Inactive: `text-muted-foreground hover:bg-accent`.

| Item | Icon | Notes |
|---|---|---|
| Overview | LayoutDashboard | Default landing page |
| Accounts | Wallet | Badge showing account count |
| Plan | SlidersHorizontal | Personal info + goals + assumptions |
| Projections | TrendingUp | Insights + calculation breakdown |

### Bottom — Utility (separated by divider)
- Settings (Settings icon)
- User avatar + email snippet (triggers existing profile/auth modal on click)

**Mobile:** Out of scope for this redesign. Sidebar structure supports a future hamburger drawer or bottom tab bar.

---

## Top Bar

**Height:** 48px, sticky, `bg-background border-b`

| Zone | Content |
|---|---|
| Left | Page title — updates with active nav item |
| Centre | ScenarioSwitcher — visible on all pages |
| Right | Display mode dropdown · Dark mode toggle · Color theme toggle |

The display mode dropdown is the same component as today (Future Value / Today's Value with explanatory text). The scenario switcher stays in the top bar (not the sidebar) so it remains accessible on every page without consuming sidebar real estate.

---

## Pages

Each nav item renders a distinct page component in the content area. No collapsibles — all content is directly visible within the page.

### Overview
The main dashboard. Components:
- `DashboardMetricsGrid`
- `PortfolioGrowthChart` + `MonteCarloChart` (side-by-side on lg)
- `KeyInsightsSummary`

No welcome banner. No sticky results bar. No `QuickActionsCard`.

### Accounts
Components:
- Portfolio summary card (total balance, monthly contributions, account count)
- Account cards grid (`AccountCard` × n)
- Empty state with single "Add Account" CTA when no accounts exist

Page header action: "Add Account" button (top-right) — opens the right Sheet.  
Editing an account card also opens the Sheet.

### Plan
Three form sections, stacked, with section headings and generous spacing:
1. Personal Information (`PersonalInfoForm`)
2. Retirement Goals (`RetirementGoalsForm`)
3. Investment Assumptions (`AssumptionsForm`)

No collapsibles. Users scroll within the page to reach each section.

### Projections
Two sections, fully expanded:
1. Detailed Insights (`InsightsPanel`)
2. Calculations Breakdown (`CalculationsBreakdown`)

### Settings
Organised into four card sections:

**Display**
- Display mode: Today's Value (real) / Future Value (nominal)
- Compounding method: Nominal (Excel-compatible) / Compound (actuarially correct)

**Appearance**
- Color theme picker (`ColorThemeToggle`)
- Dark / light mode (`ThemeToggle`)

**Plan**
- Export plan (JSON download)
- Import plan (JSON upload)
- Print / Save PDF (opens `/print`)
- Export CSV

**Danger Zone**
- Reset to defaults (destructive, confirmation required)

---

## Right Sheet — Add / Edit Account

**Component:** shadcn `Sheet` with `side="right"`, width ~440px  
**Trigger:** "Add Account" button on Accounts page, or "Edit" on any account card  
**Behaviour:** Slides over the content area — does not push the layout

Contents:
- Sheet header: "Add Account" or "Edit Account"
- Full account form (same fields as current `AccountFormDialog`)
- Sticky footer: Save (primary) · Cancel (ghost)

The existing `AccountFormDialog` (centered modal) is **replaced entirely** by this Sheet. One pattern, not two.

---

## Removed Components / Patterns

| Removed | Reason |
|---|---|
| `QuickActionsCard` | Removed entirely — not needed |
| Welcome banner | User info visible in sidebar bottom |
| Sticky results bar (`StickyResultsBar`) | Metrics always visible on Overview |
| Collapsible sections (`CollapsibleSection`) | Replaced by page navigation |
| Overcrowded header toolbar | Controls distributed to top bar + Settings page |
| `AccountFormDialog` (modal) | Replaced by right Sheet |

---

## File Structure (new/changed)

```
components/
  layout/
    app-shell.tsx          # Fixed shell: sidebar + top bar + content slot
    sidebar.tsx            # Left nav with items + bottom utility zone
    top-bar.tsx            # 48px sticky bar: title + scenario + controls
  pages/
    overview-page.tsx      # Dashboard metrics + charts + insights
    accounts-page.tsx      # Account grid + add/edit Sheet
    plan-page.tsx          # Three input forms
    projections-page.tsx   # Insights + calculations
    settings-page.tsx      # Display + appearance + plan + danger zone
  accounts/
    account-sheet.tsx      # Replaces account-form dialog with Sheet
```

`calculator-client.tsx` becomes a thin router: reads active nav item from state, renders the appropriate page inside the shell.

---

## Out of Scope

- Mobile / responsive behaviour (sidebar collapses, bottom tab bar)
- URL routing per page (current single-route app; can be added later)
- Any calculation changes

## Notes

- `DebugWindow` is a floating overlay component — it stays as-is, rendered inside the shell but outside the page content hierarchy. No changes needed.
- `isSimulating` / `isWorkerRunning` state from the Monte Carlo worker is still passed to `MonteCarloChart` as today. The removed `StickyResultsBar` was the only other consumer.
- Import error handling currently shown at the top of the page moves to inline within the Settings page Plan section.
