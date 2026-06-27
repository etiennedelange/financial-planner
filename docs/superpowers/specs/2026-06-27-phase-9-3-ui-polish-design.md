# Phase 9.3 UI/UX Polish — Design Spec

_2026-06-27 | feature/redesign branch_

## Scope

Five high-priority items from `docs/project-phases/phase-9-site-improvement.md §9.3`:

1. Success rate color utility (deduplication)
2. Hardcoded color classes → semantic tokens
3. Aria labels on key interactive elements
4. Confirmation dialog before destructive deletes
5. Toast notifications for write actions

---

## 1. Success Rate Color Utility

**Problem:** Four components each define their own success-rate color function with slightly different thresholds and different token choices:

| Component | Tokens used | Thresholds |
|---|---|---|
| `dashboard-metric-card.tsx` | `hsl(var(--chart-2/3/4))`, `text-destructive` | ≥90/75/60 |
| `success-gauge.tsx` | `bg/text-green/lime/yellow/orange/red-*` (hardcoded) | ≥90/75/50/25 |
| `projection-summary.tsx` | `text-chart-2`, `text-warning`, `text-destructive` | ≥90/75/60/40 |
| `sticky-results-bar.tsx` | `text-green/cyan/orange/red-500` (hardcoded) | ≥90/75/60 |

**Solution:** Extract `lib/utils/success-rate.ts` with a single `getSuccessRateStyle(rate: number)` returning:

```ts
type SuccessRateStyle = {
  text: string    // Tailwind text class
  bg: string      // Tailwind bg class (for progress bars)
  border: string  // Tailwind border class (for metric card borders)
  label: string   // Human label: "Excellent" | "Good" | "Fair" | "At Risk" | "Critical"
}
```

**Unified thresholds:** `≥90 Excellent / ≥75 Good / ≥60 Fair / ≥40 At Risk / <40 Critical`

**Token choices** (most semantic of the four existing implementations):
- ≥90 Excellent: `text-chart-2 / bg-[hsl(var(--chart-2))] / border-[hsl(var(--chart-2))]`
- ≥75 Good: `text-chart-4 / bg-[hsl(var(--chart-4))] / border-[hsl(var(--chart-4))]`
- ≥60 Fair: `text-warning / bg-[hsl(var(--warning))] / border-[hsl(var(--warning))]`
- ≥40 At Risk: `text-warning / bg-[hsl(var(--warning))] / border-[hsl(var(--warning))]`
- <40 Critical: `text-destructive / bg-destructive / border-destructive`

**Consumers updated:**
- `dashboard-metric-card.tsx` — replace `successRateStyles()` local fn, use `border` + `text`
- `success-gauge.tsx` — replace `getColor()` + `getMessage()` local fns, use `bg` + `text` + `label`
- `projection-summary.tsx` — replace `getSuccessTier()` local fn, use `text` + `label`
- `sticky-results-bar.tsx` — replace `successRateColor()` local fn, use `text`

---

## 2. Hardcoded Colors → Semantic Tokens

After extracting the success-rate utility, remaining hardcoded colors:

**`sticky-results-bar.tsx`** surplus/shortfall metric:
- `text-green-500` (surplus) → `text-[hsl(var(--success))]` (the `--success` token added in Phase 10)
- `text-red-500` (shortfall) → `text-destructive`

**`sticky-results-bar.tsx`** `depletionColor()` helper:
- `text-green-500` → `text-[hsl(var(--success))]`
- `text-orange-500` → `text-warning`
- `text-red-500` → `text-destructive`

**`auth-modal.tsx` / `profile-modal.tsx`** session-state badges: left unchanged — these are auth-specific UI not part of the financial design system.

---

## 3. Aria Labels

Targeted additions only where no existing `aria-label` or `title` provides the accessible name.

**Sidebar (`components/layout/sidebar.tsx`):**
- Each nav `<Link>`: add `aria-label="{label} page"` and `aria-current="page"` on the active item
- The sidebar `<nav>` element: add `aria-label="Main navigation"`

**Chart containers:**
- `success-gauge.tsx` PageCard content area: add `role="img"` + `aria-label="Success rate gauge: {successRate}%"`
- `monte-carlo-chart.tsx` chart wrapper: `role="img"` + `aria-label="Monte Carlo simulation chart"`
- `portfolio-growth-chart.tsx` chart wrapper: `role="img"` + `aria-label="Portfolio growth chart"`

**Icon-only buttons:**
- Scenario switcher rename/delete buttons already have `title=""` — add matching `aria-label`
- Accounts page delete button (`onClick={() => onDelete(account.id)}`): add `aria-label="Delete {account.name}"`

**Status badges:**
- `projection-summary.tsx` success-rate badge: add `aria-label="Retirement success rate: {label}"`

---

## 4. Confirmation Before Delete

**Problem:** Account and scenario deletions are immediate — no recovery.

**Solution:** Use the existing `alert-dialog.tsx` (already in `components/ui/`). No new dependencies.

**Pattern for both locations:**

```ts
const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

// Trash button → setPendingDeleteId(id)   (opens dialog)
// AlertDialog confirm → actualDelete(pendingDeleteId); setPendingDeleteId(null)
// AlertDialog cancel → setPendingDeleteId(null)
```

**`accounts-page.tsx`:** Delete button sets `pendingDeleteId`. `AlertDialog` at the bottom of the component tree, outside the account list render. Message: "Delete account?" / "This will permanently remove [account name] and all its data."

**`scenario-switcher.tsx`:** Same pattern. The `AlertDialog` must render outside the `DropdownMenuContent` (Radix portals can conflict). Message: "Delete scenario?" / "This will permanently remove [scenario name]."

---

## 5. Toast Notifications

**Problem:** No feedback after write actions — users can't tell if add/save/delete succeeded.

**Setup:** Add shadcn `toast` component (using the already-installed `@radix-ui/react-toast`):
- `components/ui/toast.tsx` — shadcn Toast primitives
- `components/ui/toaster.tsx` — Toaster component mounted in layout
- `lib/hooks/use-toast.ts` — toast hook (shadcn pattern)
- Mount `<Toaster />` in `app/calculator/layout.tsx`

**Triggers and messages:**

| Action | Toast |
|---|---|
| Add account | "Account added" |
| Edit account | "Account updated" |
| Delete account (confirmed) | "Account deleted" |
| Scenario rename | "Scenario renamed to [name]" |
| Scenario delete (confirmed) | "Scenario deleted" |
| Export plan | "Plan exported" |
| Reset to defaults | "Reset to defaults" |

All toasts: `duration: 3000ms`, no action button needed.

---

## Implementation Order

1. `lib/utils/success-rate.ts` — utility first, no component changes yet
2. Update the 4 consumer components to use it
3. Fix remaining hardcoded colors in `sticky-results-bar.tsx`
4. Aria labels (sidebar, charts, buttons, badges)
5. Delete confirmation dialogs (accounts + scenarios)
6. Toast setup + wire up all triggers

## Files Changed

| File | Change |
|---|---|
| `lib/utils/success-rate.ts` | **new** — shared utility |
| `components/dashboard/dashboard-metric-card.tsx` | use shared utility |
| `components/charts/success-gauge.tsx` | use shared utility |
| `components/results/projection-summary.tsx` | use shared utility |
| `components/dashboard/sticky-results-bar.tsx` | use shared utility + semantic tokens |
| `components/layout/sidebar.tsx` | aria labels |
| `components/charts/monte-carlo-chart.tsx` | aria labels |
| `components/charts/portfolio-growth-chart.tsx` | aria labels |
| `components/pages/accounts-page.tsx` | delete confirmation + toast |
| `components/scenarios/scenario-switcher.tsx` | delete confirmation + toast |
| `components/ui/toast.tsx` | **new** — shadcn toast primitives |
| `components/ui/toaster.tsx` | **new** — Toaster component |
| `lib/hooks/use-toast.ts` | **new** — toast hook |
| `app/calculator/layout.tsx` | mount Toaster |
