# 2026-08-08 — Manage Account Moved from Modal to `/calculator/settings`

Follow-up on the `feature/auth-hardening-2fa` branch, layered on top of the same-day
local-dev email-link fix (`docs/history/2026-08-08-local-dev-email-verification-fix.md`).
UI/UX rework plus one bug fix — no calculation code touched, so CLAUDE.md's unit-test
rule does not apply.

## Problem

The entire "Manage Account" surface (change email, change password, 2FA/security,
active sessions, account deletion) lived inside `components/auth/profile-modal.tsx`, a
`sm:max-w-sm` (384px) Dialog that scrolled internally to fit all that content. This
violated this project's `impeccable` design-skill product-register rule ("Modal as
first thought... exhaust inline/progressive alternatives first") and was inconsistent
with the app's own established pattern: `/calculator/settings` already existed as a
real full-page settings surface (Display, Appearance, Plan, Danger Zone sections) built
with `PageCard`, not a modal.

## Fix

- **New `components/auth/account-settings.tsx`** — `PageCard`-based
  `AccountSettings({ user })` containing Change Email, Change Password, Export Data,
  plus the existing `SecuritySection` and `SessionList` components, plus a new
  destructive `Delete Account` `PageCard`. Logic ported 1:1 from the old
  `profile-modal.tsx` (same Zod schemas, same `ReauthenticateDialog` gate on
  email/password/delete) — no behavioral change to the account operations themselves,
  only where/how they're presented.
- **`components/pages/settings-page.tsx`** — renders `<AccountSettings user={user} />`
  (from `useAuth()` in `components/supabase-provider.tsx`) when signed in, after the
  existing sections. The pre-existing "Danger Zone" `PageCard` (local plan-data reset)
  was renamed to "Reset Plan Data" to disambiguate it from the new "Delete Account"
  section — the page now has two distinct destructive actions and needed two labels.
- **`components/layout/sidebar.tsx`** — the "Manage Account" dropdown item is now a
  `Link` (via `DropdownMenuItem asChild`) to `/calculator/settings`, replacing the
  `ProfileModal` open call. `profileModalOpen` state and the `ProfileModal` usage were
  removed.
- **Deleted `components/auth/profile-modal.tsx`** — fully replaced by the above.
- **Deleted `components/auth/user-menu.tsx`** — found to be 100% dead code while doing
  this work (repo-wide grep found zero imports). `sidebar.tsx` had its own separate,
  actually-wired-up inline account-menu dropdown; `user-menu.tsx` was an orphaned
  earlier version of the same thing.
- **Styling polish** on components that previously only ever rendered inside the
  384px-wide modal and needed to read correctly at full page width:
  `components/auth/mfa-enrollment.tsx`, `components/auth/security-section.tsx`,
  `components/auth/session-list.tsx` — `w-full` buttons became natural-width
  `size="sm"`, `text-xs` body copy bumped to `text-sm` to match the page's type scale,
  `max-w-sm`/`max-w-lg` caps added so form fields don't stretch edge-to-edge. No
  behavioral changes, styling only.

## Bug found and fixed during verification

`components/auth/reauthenticate-dialog.tsx` (the password re-entry gate used before
email/password change and account deletion) called
`supabase.auth.signInWithPassword()` without a Turnstile `captchaToken`. Since commit
`f8a24d6` made captcha verification mandatory on auth forms, every reauthentication
attempt was failing server-side with `captcha_failed` and being silently reported to
the user as "That password is not correct" — a pre-existing bug (inherited unchanged
from the old `profile-modal.tsx` flow, not introduced by this rework) that stayed
invisible until this session's in-browser verification exercised the reauthenticate
path. Fixed by adding the same `Turnstile`-widget + `captchaToken` pattern already used
in `components/auth/auth-modal.tsx` (site key `NEXT_PUBLIC_TURNSTILE_SITE_KEY`,
single-use token reset via `turnstile.current?.reset()` after each attempt, Confirm
button disabled until a token is issued).

## Verification

- Full Playwright browser walkthrough signed in as a real test user: navigated
  `/calculator/settings`, exercised Change Password end-to-end including the
  reauthenticate dialog (reproduced the `captcha_failed` 400 first, then confirmed
  success after the fix), confirmed "Manage Account" in the sidebar navigates to the
  settings page instead of opening a modal, confirmed Security/Active
  Sessions/Delete Account sections render correctly at full page width with no
  clipping/overflow.
- `npm run typecheck` clean.
- `npm run test` — 789/789 passing.
- `npm run build` succeeds.
- `npm run lint` has pre-existing unrelated errors elsewhere in the codebase
  (`theme-toggle.tsx`, `spring-number.tsx`, chart hooks, an existing `useEffect` in
  `security-section.tsx`) — confirmed via `git stash`/`git stash pop` that these
  predate this session's changes.
