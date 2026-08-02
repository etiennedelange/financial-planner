# Auth Hardening & 2FA — Design

**Date:** 2026-08-02
**Status:** Approved, ready for planning
**Supersedes:** the anonymous-first account model described in `docs/project-phases/phase-3-user-accounts.md`

## Goal

Replace the current anonymous-first auth with a production-grade account system: no
anonymous database rows, optional TOTP two-factor enforced at the database layer,
a working password reset, session and device management, self-serve account deletion,
and platform hardening (CSP, security headers, bot protection).

The bar: an attacker holding a valid stolen password must not be able to read a
2FA-enrolled user's data, including by calling PostgREST directly with the
publishable key that ships in the client bundle.

## Current state

| Area | Today |
| --- | --- |
| Account model | Every visitor gets a real `auth.users` row via `signInAnonymously()` (`components/supabase-provider.tsx:48`) |
| Sign-up | `updateUser({email, password})` upgrades the anon row in place, preserving the UUID |
| RLS | `session_id = (select auth.uid())` on all four tables, `force row level security` enabled |
| Middleware | `proxy.ts` refreshes the session; authorizes nothing |
| MFA | None. `auth.mfa.totp.enroll_enabled = false` |
| Password policy | `minimum_password_length = 6`, `password_requirements = ""` |

### Defects this design fixes

1. **Password reset never resets the password.** `resetPasswordForEmail` redirects to
   `/auth/callback?next=/calculator` (`components/auth/auth-modal.tsx:90`). The callback
   exchanges the code and drops the user on the calculator. They are never prompted for a
   new password — the reset link is a passwordless login.
2. **Anon→real upgrade has no failure path.** If the email already belongs to an account,
   `updateUser` fails with an error the UI shows raw. If it succeeds, the user sits
   unconfirmed (`enable_confirmations = true`) in a state the UI does not represent.
3. **Weak password policy.** 6 characters, no complexity, no leaked-password check.
4. **`secure_password_change = false`.** A password can be changed from a stale session
   with no reauthentication.
5. **No MFA at all.**
6. **No foreign keys to `auth.users`.** `scenarios.session_id`, `expense_groups.session_id`
   and `expenses.session_id` are plain `uuid` columns. Deleting a user orphans every row
   they own — the data survives, unreachable and unattributed.
7. **No security headers, no CSP, no bot protection, no session timeout.**

## Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Account model | Login required for persistence | Calculator runs unauthenticated in localStorage; no database row until sign-up. Eliminates the anon user table, the abuse vector, and the in-place upgrade complexity. |
| Second factors | TOTP + recovery codes | Zero per-use cost, offline, standard. SMS rejected — SIM-swap is a live threat in South Africa. Passkeys deferred. |
| 2FA policy | Optional, enforced once enrolled | No friction for casual users; real protection for those who opt in. |
| Enforcement point | Row Level Security | The publishable key is in the client bundle. Middleware-only enforcement is bypassable by calling PostgREST directly. |
| Google OAuth | Out of scope | OAuth users have no password, which branches the 2FA and reauthentication flows. Defer to its own spec. |

## Architecture

### 1. Account model

Anonymous sign-in is removed entirely.

- `enable_anonymous_sign_ins = false` in `supabase/config.toml`
- `signInAnonymously()` deleted from `SupabaseProvider`
- `sessionId` stays `null` for signed-out visitors

Both Zustand stores already persist to localStorage and no-op their database writes when
`sessionId` is `null` (`lib/store/calculator-store.ts:133`, `lib/store/expenses-store.ts:96`),
so local-only mode requires no store changes. `UserMenu`'s `isAnon` check collapses to
`user === null`.

### 2. Claim-on-signup

The highest data-loss risk in this design. A first-time signup should carry local work up.
A returning user signing in on a borrowed browser must not have server data clobbered by
whatever is in that browser's localStorage.

**Rule:** on sign-in, if the account has **zero** scenarios server-side, migrate localStorage
up and then clear local state. If it has **any**, the server wins and local state is discarded.

No merge. Two divergent retirement plans have no correct merge, and guessing produces
numbers the user cannot explain — the same reasoning behind the single-source-of-truth
rule for `projectFinalSavings` in CLAUDE.md.

One function, `claimLocalData(userId)` in `lib/supabase/claim.ts`, idempotent, called from a
single site in the `onAuthStateChange` handler. It must be safe to interrupt: a failure
partway through leaves localStorage intact and retries on next sign-in.

### 3. 2FA enforcement in RLS

A single `stable security definer` function, defined once and referenced by all four table
policies — never inlined per-table:

```sql
create function public.mfa_satisfied() returns boolean
language sql stable security definer set search_path = '' as $$
  select (select auth.jwt()->>'aal') = 'aal2'
     or not exists (
       select 1 from auth.mfa_factors
       where user_id = (select auth.uid()) and status = 'verified'
     );
$$;
```

Every policy becomes `session_id = (select auth.uid()) and public.mfa_satisfied()`.
An attacker with a stolen password holds an `aal1` token and receives an empty result set
from PostgREST.

Middleware redirects to `/auth/mfa` when a verified factor exists and the session is `aal1`.
This is the UX layer. RLS is the boundary.

**Rejected alternatives:**
- *Middleware-only enforcement* — bypassable by calling PostgREST directly with the
  publishable key from the client bundle.
- *`custom_access_token` hook stamping an AAL claim* — avoids the per-query lookup but adds
  a Postgres hook and a deploy dependency. Not justified at this query volume.

### 4. Recovery codes

Supabase provides no recovery codes; they are custom.

- `user_recovery_codes` table: `user_id`, `code_hash`, `used_at`
- 10 codes generated at enrolment, stored as `crypt()` hashes, displayed exactly once
- Redeemed through a `security definer` RPC that marks the code used and elevates the
  session to `aal2`
- RLS: a user may read the `used_at` state of their own codes but never the hashes

### 5. Password and reset

- `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"`
- `secure_password_change = true`
- Leaked-password protection enabled in the dashboard once a hosted project exists
- New `app/auth/reset-password/page.tsx`
- `app/auth/callback/route.ts` branches on `type`: `recovery` → reset page, otherwise `next`.
  It handles both the PKCE `code` parameter and `token_hash` + `type` via `verifyOtp`,
  since which arrives depends on the email template.
- Sensitive operations — change email, change password, disable 2FA, delete account —
  require re-entering the current password, verified fresh. An active session is not enough.

### 6. Sessions and devices

- `[auth.sessions] timebox = "168h"`, `inactivity_timeout = "12h"` (both tunable)
- `auth.sessions` is not reachable through PostgREST; a `security definer` RPC returns the
  caller's own sessions only
- "Sign out everywhere" via `signOut({ scope: 'global' })`
- Both surfaced in account settings

### 7. Account deletion and POPIA

- Migration adds `references auth.users(id) on delete cascade` to `scenarios.session_id`,
  `expense_groups.session_id`, `expenses.session_id`. `accounts` already cascades through
  `scenario_id`.
- Deletion runs in a route handler under the service-role key, gated on reauthentication
  and on AAL2 where a factor is enrolled
- Data export: JSON download of the user's scenarios, accounts and expenses

### 8. Platform hardening

- CSP with a per-request nonce, set in `proxy.ts` (`next.config.js` headers cannot generate
  nonces). Allowlist: the Supabase origin, Vercel Analytics, Turnstile.
- HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`,
  `Permissions-Policy`
- Cloudflare Turnstile on sign-up and sign-in via `[auth.captcha]`, passed as `captchaToken`

## Testing

Three layers, because the risk here is not in the UI.

**Vitest**
- `claimLocalData` decision table: zero scenarios server-side, existing scenarios,
  failure partway through, repeated invocation
- Recovery codes: generation, hashing, redemption, single-use enforcement, exhaustion

**SQL against local Supabase** — the layer that proves the 2FA claim rather than asserting it
- Each policy at `aal1` with a verified factor (must return zero rows)
- Each policy at `aal1` with no factor (must return the user's rows)
- Each policy at `aal2` (must return the user's rows)
- Cross-user access at every AAL (must return zero rows)

**Playwright**
- Sign up → enrol TOTP → sign out → sign in with TOTP
- Sign in via recovery code, and confirm that code is then dead
- Password reset end to end, including that the old password no longer works
- Local work claimed on first signup; local work discarded for an account with existing data

## Rollout

Supabase MFA is a **Pro plan** feature. Everything here is buildable and testable on the
local stack. The Pro requirement applies only when pointing at a hosted project — worth
knowing before a production migration is half-done.

No hosted project is currently linked (`supabase/.temp/project-ref` absent).

## Out of scope

- Google OAuth and any social login
- Passkeys / WebAuthn
- SMS as a second factor
- Billing and subscription tiers (see `docs/project-phases/future-enhancements.md`)
