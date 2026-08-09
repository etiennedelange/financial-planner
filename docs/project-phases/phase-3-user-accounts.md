# Phase 3: User Accounts ✅ Complete

**Goal:** Implement user authentication and profile management so users can sync their retirement plan across devices, with hardened security including mandatory login and optional 2FA.

## Completed

### Basic Authentication & Profile Management
- [x] **Supabase Auth integration** — `onAuthStateChange` listener in `SupabaseProvider`; `AuthContext` exposes current user to all components
- [x] **Sign up flow** — `AuthModal` sign-up tab calls `supabase.auth.signUp()` with email/password; email confirmation required
- [x] **Login flow** — `AuthModal` sign-in tab calls `signInWithPassword`; session change triggers `sessionId` update + DB sync
- [x] **Logout** — inline account-menu dropdown in `components/layout/sidebar.tsx` calls `signOut()`; `user` becomes null
- [x] **Password reset** — `AuthModal` reset tab calls `resetPasswordForEmail` with redirect to `/auth/callback`; now requires TOTP challenge for 2FA-enrolled users
- [x] **Auth callback route** — `app/auth/callback/route.ts` exchanges OAuth code for session; handles email confirmation + password reset redirects
- [x] **Local-dev email links fixed** — custom `supabase/templates/confirmation.html`/`recovery.html` route GoTrue's confirmation/recovery links through the app's own origin (`{{ .SiteURL }}/auth/callback?token_hash=...`) instead of the raw `127.0.0.1:54321` GoTrue `/verify` endpoint, which is unreachable from the browser in this devcontainer; `site_url` in `supabase/config.toml` aligned to `localhost:3000`; proxy (`app/supabase/[...path]/route.ts`) now forwards GoTrue redirects instead of following them internally, avoiding a CSP-nonce mismatch. See `docs/history/2026-08-08-local-dev-email-verification-fix.md`
- [x] **"Manage Account" moved from modal to `/calculator/settings`** — `components/auth/account-settings.tsx` (new, `PageCard`-based) replaces the deleted `components/auth/profile-modal.tsx`; sidebar's "Manage Account" item now `Link`s to the settings page instead of opening a Dialog. Also deleted `components/auth/user-menu.tsx` (verified 100% dead code — zero imports; `sidebar.tsx` already had its own wired-up inline account menu). Fixed a real bug found during verification: `reauthenticate-dialog.tsx` was missing the Turnstile `captchaToken` required since commit `f8a24d6`, so every reauth attempt failed with `captcha_failed`, misreported to the user as a wrong password. See `docs/history/2026-08-08-account-settings-page-migration.md`
- [x] **Proxy (middleware)** — `proxy.ts` refreshes Supabase session on every request; enforces AAL (Authenticator Assurance Level) gating for 2FA. `isMfaExempt` allowlist keeps the `/auth/mfa` challenge page and its API dependencies reachable while gated; fixed to also cover the dev-only `/supabase/*` proxy path, which was causing a redirect-to-self loop and "Could not load your authentication factors." on the challenge page. See `docs/history/2026-08-08-mfa-challenge-dev-proxy-redirect-loop-fix.md`
- [x] **Server-side Supabase client** — `lib/supabase/server.ts` for use in Server Components and Route Handlers

### UI & Experience
- [x] **Redesigned auth modal** — contextual mode-switching via footer links; branded Motion animation in header; inline "Forgot password?" link; status messages as pill banners
- [x] **Finance animation** — `FinanceAnimation` (Motion-powered, 60fps): growing bars + animated trend line + pulsing dot; `StaticFinanceChart` (plain SVG, no deps) for static contexts
- [x] **Favicon** — `app/icon.tsx` using Next.js `ImageResponse`; teal rounded-square with white bars + rising trend line + dot
- [x] **Profile/account management page** — `components/auth/account-settings.tsx`, rendered on `/calculator/settings`, with account security section (2FA, session management), account deletion (POPIA), and data export. Previously a `ProfileModal` Dialog; moved to a full page — see "Manage Account" entry above.

### Mandatory Login & Password Policy
- [x] **Anonymous sign-in removed** — `enable_anonymous_sign_ins = false` in config; all users must authenticate
- [x] **12-char password policy** — `minimum_password_length = 12`, `password_requirements = "lower_upper_letters_digits"` in `supabase/config.toml`; sign-up schema mirrors server policy

### Multi-Factor Authentication (2FA)
- [x] **TOTP (Time-based One-Time Password)** — `lib/auth/mfa.ts` with `listFactors()`, `enrollTotp()`, `verifyTotp()`, `disableTfa()`
- [x] **Recovery codes** — single-use, bcrypt-hashed, generated at enrolment and at regeneration; user may see count but never the codes themselves (column-level RLS grant)
- [x] **MFA challenge flow** — `app/auth/mfa/page.tsx` gates all requests requiring AAL2 (second factor satisfied); supports both TOTP verification and recovery-code redemption
- [x] **RLS enforcement via `mfa_satisfied()`** — SQL function checking both verified TOTP factor existence and AAL level; enforces 2FA at the database boundary for all protected tables
- [x] **Recovery-code redemption** — `/api/auth/recover` exempt from AAL gate (recovery entry point); auto-deletes victim's TOTP factor if valid code supplied; 0-downtime recovery path

### Security Hardening
- [x] **CSP (Content-Security-Policy) with per-request nonces** — `lib/security/headers.ts` builds strict CSP; nonce generated in middleware and threaded to client; all Next.js script tags carry nonce attribute
- [x] **Security headers** — X-Frame-Options (DENY), HSTS (2-year max-age), X-Content-Type-Options (nosniff), Referrer-Policy (strict-origin-when-cross-origin), Permissions-Policy (camera/microphone/etc denied)
- [x] **Cloudflare Turnstile bot protection** — bot protection on auth forms (sign-in, sign-up, password reset); single-use tokens with reset capability on retry
- [x] **Session management** — `my_sessions()` RPC lists active sessions with user agent, IP, last activity; "Sign Out Everywhere" terminates all other sessions; configurable timeouts and inactivity limits
- [x] **Account deletion (POPIA compliance)** — user-initiated self-serve deletion via service-role Admin API; cascades to all user data (scenarios, expenses, auth records)
- [x] **Data export** — user-initiated export of all personal data in JSON format (POPIA right to portability)

### Known Design Decisions
- **Login-required model**: App no longer works without authentication. All routes except `/auth/*` require user session. Anonymous access removed in favor of stronger default security.
- **AAL gating**: Middleware applies UX-layer AAL gate (redirect to `/auth/mfa` if needed); RLS enforces the real boundary via `mfa_satisfied()` — a client that bypasses middleware still gets zero rows.
- **Recovery codes over email**: Email-based account recovery is unilaterally strong; recovery codes provide a self-serve path without requiring email access. Both coexist: email recovery resets password, codes auto-delete TOTP.
- **Single TOTP factor per user**: Only one TOTP factor supported per account. Backup devices must share the same secret or use recovery codes.

## Pending

- [ ] Social login (Google OAuth) — optional
- [ ] **Enable "Prevent use of leaked passwords"** in the hosted Supabase project (Dashboard → Authentication → Policies) on the day the project is deployed to production — this setting has no `config.toml` equivalent and cannot be applied locally
- [ ] **WebAuthn/passkeys** — optional future enhancement for passwordless 2FA
