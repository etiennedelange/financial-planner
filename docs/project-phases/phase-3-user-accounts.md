# Phase 3: User Accounts 🔄 In Progress

**Goal:** Implement user authentication and profile management so users can sync their retirement plan across devices.

## Completed

- [x] **Supabase Auth integration** — `onAuthStateChange` listener in `SupabaseProvider`; `AuthContext` exposes current user to all components
- [x] **Sign up flow** — `AuthModal` sign-up tab calls `supabase.auth.updateUser()` on anon users (upgrades anonymous → real, preserving UUID + all saved data); falls back to `signUp()` if not anon
- [x] **Login flow** — `AuthModal` sign-in tab calls `signInWithPassword`; session change triggers `sessionId` update + DB sync
- [x] **Logout** — `UserMenu` dropdown calls `signOut()`; `user` becomes null → "Sign In" button shown; new anon session created on next page load
- [x] **Password reset** — `AuthModal` reset tab calls `resetPasswordForEmail` with redirect to `/auth/callback`
- [x] **Auth callback route** — `app/auth/callback/route.ts` exchanges OAuth code for session; handles email confirmation + password reset redirects
- [x] **User menu in header** — `UserMenu` component: shows "Sign In" button for anon users; shows email + "Sign Out" dropdown for authenticated users
- [x] **Proxy (middleware)** — `proxy.ts` refreshes Supabase session on every request so tokens don't expire mid-session
- [x] **Server-side Supabase client** — `lib/supabase/server.ts` for use in Server Components and Route Handlers

- [x] **Redesigned auth modal** — dropped shadcn Tabs for contextual mode-switching via footer links; branded Motion animation in header; inline "Forgot password?" link; status messages as pill banners
- [x] **Finance animation** — `FinanceAnimation` (Motion-powered, 60fps): growing bars + animated trend line + pulsing dot; `StaticFinanceChart` (plain SVG, no deps) for static contexts
- [x] **Welcome banner** — shown on home page when real user is signed in; static finance chart + "Welcome back, {name}" + sync status line; hidden for anonymous users
- [x] **Favicon** — `app/icon.tsx` using Next.js `ImageResponse`; blue rounded-square with white bars + rising trend line + dot; consistent with auth modal motif
- [x] **Sign-out race condition fixed** — removed `signInAnonymously()` from `onAuthStateChange(SIGNED_OUT)` handler; was racing with cookie cleanup and restoring the real user session
- [x] **Profile management modal** — `ProfileModal` with change-email + change-password forms; "Manage Account" item in `UserMenu` dropdown; same visual style as auth modal (static finance chart header, pill status messages, compact `h-8` inputs)
- [x] **12-char password policy + reauthentication gate** — `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"` in `supabase/config.toml`; `secure_password_change = true`; sign-up schema in `AuthModal` mirrors the server policy while sign-in keeps a length-1 check so legacy accounts with shorter passwords can still log in; new `ReauthenticateDialog` (`components/auth/reauthenticate-dialog.tsx`) re-confirms the current password via `signInWithPassword` before `ProfileModal` proceeds with an email or password change

## Pending

- [ ] Social login (Google OAuth) — optional
- [ ] Protected routes / redirect to login — not needed currently (app works anonymously)
- [ ] **Enable "Prevent use of leaked passwords"** in the hosted Supabase project (Dashboard → Authentication → Policies) the day the project is created — this setting has no `config.toml` equivalent and cannot be applied locally

## Key Design Decisions

- **Anonymous-first**: App works without auth. Anonymous session created on first load; upgrading to a real account preserves all data (same UUID via `updateUser`).
- **Data migration on sign-up**: Calling `updateUser()` on an existing anonymous user converts it to a real user without changing the `user.id`, so all rows keyed by `session_id` remain accessible.
- **Post sign-out**: `user` becomes null; app keeps working via localStorage; new anon session created on next page load via `init()`. DO NOT call `signInAnonymously()` inside `onAuthStateChange(SIGNED_OUT)` — it races with cookie cleanup and restores the old session.
- **`proxy.ts`**: Next.js 16 renamed `middleware.ts` to `proxy.ts` and the export from `middleware` to `proxy`.
- **Motion**: installed via pnpm (`pnpm add motion`); npm install broken in this environment due to pnpm/jiti conflict.
