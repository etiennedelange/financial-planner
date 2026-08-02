# Phase 7: UI Redesign — Sidebar App Shell ✅ Complete

_Implemented 2026-06-07 on `feature/redesign` branch._

## Goal

Replace the single-column scroll layout with a fixed app shell: 220px left sidebar, sticky top bar, scrollable page content, and a right Sheet panel for account add/edit. Navigation moves from collapsible sections to four distinct SPA-style page views.

## Tasks

- [x] Fixed app shell (`components/layout/app-shell.tsx`) — sidebar + top bar + content slot
- [x] Left sidebar (`components/layout/sidebar.tsx`) — 220px, wordmark, nav items, settings/user bottom zone
- [x] Sticky top bar (`components/layout/top-bar.tsx`) — page title, scenario switcher, action buttons
- [x] Four page routes: Overview, Accounts, Plan, Projections
- [x] Settings page route
- [x] Account Sheet overlay (`components/accounts/account-sheet.tsx`) — right slide-in, does not push layout
- [x] Semantic color tokens throughout — no hardcoded `bg-blue-500` etc.
- [x] Color theme toggle + dark/light mode wired into new layout

## Route Structure

```
app/calculator/
  layout.tsx          ← app shell (sidebar + top bar)
  overview/page.tsx   ← dashboard metrics, charts
  accounts/page.tsx   ← account list + Sheet for add/edit
  plan/page.tsx       ← personal info, retirement goals, assumptions
  projections/page.tsx← insights, breakdown, Monte Carlo
  settings/page.tsx   ← display mode, compounding method
  expenses/page.tsx   ← expense tracker (Phase 8)
```

## Design Decisions

- Sidebar fixed at `w-[220px]` — mobile out of scope; structure supports future hamburger drawer
- Active nav item: `bg-primary text-primary-foreground` pill; inactive: `text-muted-foreground hover:bg-accent`
- App shell never scrolls — only the page content area scrolls
- Account Sheet overlays from the right without pushing the layout

## Phase 9 Follow-ups

- Sidebar width duplicated in `sidebar.tsx:60` and `app-shell.tsx:37` — extract to `--sidebar-width` CSS variable
- No mobile collapse/responsive breakpoints yet
- Hardcoded color classes (`text-green-600`, etc.) remain in some components — see Phase 9.3
