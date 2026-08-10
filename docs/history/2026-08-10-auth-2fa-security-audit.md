# Auth and 2FA Security Audit

**Date:** 2026-08-10
**Branch:** `feature/auth-hardening-2fa`

Triple-check review of the authentication, TOTP, recovery-code, AAL, Supabase RLS, and commercial abuse surfaces. The detailed risk register is [here](../security/auth-2fa-risk-register.md).

## Outcome

The RLS/AAL design remains sound: the local RLS suite passed, recovery-code replacement is AAL-gated, and no cross-user access was found in the reviewed security-definer functions. The review identified unresolved pre-launch risks rather than a clean production-security sign-off:

- Auth callback open redirect through an unvalidated `next` parameter.
- 2FA users cannot complete the account deletion flow because password reauthentication replaces the session with AAL1.
- Unauthenticated, unmetered AI narrative generation can create direct cost abuse.
- Vulnerable Next.js, nested PostCSS, and sharp dependency versions.
- Recovery-code redemption lacks throttling and has a concurrent single-use race.
- Missing Turnstile configuration disables the authentication UI.
- npm and pnpm lockfiles are divergent.

The earlier claim that the development Supabase proxy strips security headers was disproved by a live response and removed from the risk register.

## Release Decision

Do not describe Phase 3 as commercially security-complete until the High risks are fixed, the Medium risks have compensating controls or remediation plans, and the production build/browser verification has completed.
