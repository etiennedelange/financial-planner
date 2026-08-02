# Add Account — Redesign Spec

**Date:** 2026-06-14
**Status:** Approved, ready for implementation

---

## Problem

The current Add/Edit Account flow uses a `Sheet` (440px side panel sliding in from the right). It is intrusive on desktop and not mobile-native. The 8-field form presented in a single scroll is also unnecessarily long on small screens.

---

## Decision

Replace the side sheet with a **responsive 2-step form**:
- **Desktop (≥640px):** Radix `Dialog` (centered modal) — already installed, no new dep
- **Mobile (<640px):** Vaul `Drawer` (bottom sheet, swipe-to-dismiss) — requires `vaul` install
- **2 steps** to reduce cognitive load, with SA defaults pre-filling step 2

---

## Architecture

### New component

**`components/accounts/account-form-dialog.tsx`**

Single component that renders as Dialog or Drawer based on a `useMediaQuery('(min-width: 640px)')` hook. Internal `step` state (`1 | 2`) drives which fields are shown. Accepts the same props as the current `AccountSheet`.

```tsx
interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: Account | null       // null = add mode, Account = edit mode
  onSubmit: (data: AccountFormData) => void
}
```

### New UI primitive

**`components/ui/drawer.tsx`** — shadcn-style Drawer component wrapping Vaul. Standard shadcn implementation.

### Deleted file

**`components/accounts/account-sheet.tsx`** — replaced entirely. No other consumers.

### Modified file

**`components/pages/accounts-page.tsx`** — swap `AccountSheet` import/usage for `AccountFormDialog`. State variables (`sheetOpen` → `dialogOpen`) renamed for clarity. Logic unchanged.

---

## Form Steps

### Step 1 — Essentials

| Field | Type | Notes |
|---|---|---|
| Account Name | text input | required |
| Provider | text input | required |
| Account Type | select | RA, Pension, Preservation, TFSA, Discretionary |
| Current Balance (R) | number | min 0, step 1000 |
| Monthly Contribution (R) | number | min 0, step 100 |

Footer: **"Continue →"** button (advances to step 2). No back button on step 1.

### Step 2 — Performance

| Field | Type | Default | Notes |
|---|---|---|---|
| Expected Return (%) | number | `SA_DEFAULTS.defaultExpectedReturn` | 0–30, step 0.5 |
| Annual Fees (%) | number | `SA_DEFAULTS.defaultAnnualFees` | 0–5, step 0.1 |
| Contribution Escalation (%) | number | `SA_DEFAULTS.defaultContributionEscalation` | 0–20, step 0.5 |
| TFSA contributions to date (R) | number | — | **conditional**: only shown when `type === "tfsa"` |

Footer: **"← Back"** (returns to step 1) and **"Add Account"** / **"Update Account"** (submits).

A subtle helper note below the fields: *"Pre-filled with SA defaults — adjust if needed."*

---

## Progress Indicator

Shown in the header of both Dialog and Drawer:

```
Add Account
Step 1 of 2 — Essentials
[████████░░░░░░░░] ← thin gold bar, 50% fill
```

- Title: "Add Account" or "Edit Account" depending on mode
- Subtitle: "Step N of 2 — [Step name]"
- Bar: `h-[2px]` gold (`bg-primary`) on a muted track, sits flush against the bottom of the header border
- Step 1 → 50% fill. Step 2 → 100% fill.

---

## Responsive Behaviour

| Breakpoint | Component | Notes |
|---|---|---|
| `< 640px` | Vaul `Drawer` | Slides up from bottom. Drag handle at top. Swipe down to dismiss. Content scrolls inside the sheet. |
| `≥ 640px` | Radix `Dialog` | Centered, `max-w-md`. Escape key / backdrop click to dismiss. |

The same `AccountFormDialog` component renders both. A `useIsMobile` hook (`window.innerWidth < 640` with SSR guard, no resize listener needed) switches between `<Drawer>` and `<Dialog>` at render time. The dialog/drawer only mounts when `open=true`, so the breakpoint is evaluated fresh each time it opens — no mid-session resize edge case.

---

## Validation

Zod schema unchanged from `account-sheet.tsx`. `react-hook-form` spans both steps — the form is one logical unit; only the displayed fields change per step. Validation fires on submit (step 2), not on step advance (step 1 fields are validated client-side via `trigger()` before advancing).

Step 1 field errors block advancing to step 2. Step 2 field errors block final submit.

---

## Edit Mode

When `account` prop is provided:
- Both steps pre-populate from the existing account values
- Title shows "Edit Account"
- Submit button shows "Update Account"
- Form opens at step 1 (user can navigate to step 2 to change performance fields)

---

## Dependencies

```bash
npm install vaul
```

`components/ui/drawer.tsx` — new file, standard shadcn Drawer wrapper over Vaul.

No other new dependencies.

---

## Files Changed

| File | Action |
|---|---|
| `components/accounts/account-form-dialog.tsx` | **Create** — new component |
| `components/ui/drawer.tsx` | **Create** — Vaul wrapper |
| `components/accounts/account-sheet.tsx` | **Delete** |
| `components/pages/accounts-page.tsx` | **Modify** — swap import + rename state var |

---

## Out of Scope

- Multi-account bulk import
- Account reordering
- Any changes to the account card grid layout
- Changes to delete flow (AlertDialog — stays as-is)
