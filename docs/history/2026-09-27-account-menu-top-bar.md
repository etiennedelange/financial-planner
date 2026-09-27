# 2026-09-27 — Account control moved from sidebar to top bar

## What changed

The sidebar's bottom "Sign in" row didn't line up with the nav items above it: the 24px
avatar circle was wider than the 16px nav icons, so the label sat 8px off, and it used
a smaller, lighter font than the nav items. The account control also belongs top-right by convention.
The sidebar is also `hidden` below `md`, so there was **no way to sign in on mobile**.

- `components/layout/account-menu.tsx` (new) — `AccountMenu`, owns the `AuthModal`. A
  single ghost icon button (`h-8 w-8`, like `ThemeToggle`; small primary dot when signed
  in) opens a dropdown. Anonymous: Settings + Sign in — when `isAuthEnabled()` is false,
  Sign in is a disabled item with a "Soon" badge, so the WIP dialog can't be opened.
  Signed in: email label, Manage Account, Sign Out.
- `components/layout/top-bar.tsx` — renders `AccountMenu` after `ThemeToggle`, separated
  by a thin divider.
- `components/layout/sidebar.tsx` — account block, `AuthModal`, sign-out handler, `user`
  prop and the bottom Settings link removed; the sidebar is now wordmark + main nav only.
  Settings is reached from the account menu on desktop (the mobile bottom nav still has it).
- `components/layout/app-shell.tsx` — no longer passes `user` to `Sidebar`.

The trigger is "Account menu" in both states. E2E sign-in now goes through the menu via a
new `openSignIn()` helper in `e2e/helpers/auth-helper.ts` (used by the helper's own
sign-up/sign-in and by `e2e/journeys/02-password-reset.spec.ts`); e2e needs
`NEXT_PUBLIC_AUTH_ENABLED=true`, as before. E2E suite not run in this session.

## Verification

typecheck + lint clean, 1012/1012 tests, shadscan 93/100 (same as before the change).
Not visually verified in a browser — Playwright's Chromium is not installed in the container.
