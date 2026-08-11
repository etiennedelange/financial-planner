# Auth and 2FA Risk Register

**Review date:** 2026-08-10
**Remediation date:** 2026-08-10
**Branch reviewed:** `feature/auth-hardening-2fa`
**Scope:** Supabase Auth, password reset, TOTP, recovery codes, AAL middleware, account security routes, deployment dependencies, and commercial abuse controls.
**Status:** All nine open risks below have been remediated on this branch. See "Remediation Record" at the end of this document for what changed, file by file, and the residual caveats worth carrying into the next review.

## Risk Ratings

- **High:** Fix before public or paid availability.
- **Medium:** Fix before broad launch; document compensating controls if deferred.
- **Low:** Track and resolve as part of release hardening.

## Open Risks

### AUTH-001: Auth callback open redirect

- **Severity:** High
- **Status:** Resolved (`lib/auth/safe-redirect.ts`, `app/auth/callback/route.ts`)
- **Evidence:** `app/auth/callback/route.ts:20,61` concatenates untrusted `next` directly into `NextResponse.redirect()`.
- **Verified case:** `next=@evil.com` produces `https://app.example.com@evil.com/`, whose origin is `evil.com`.
- **Impact:** Auth and recovery links can be used in phishing or redirect chains. The raw authorization code is exchanged before the redirect, so no direct token leak was observed; the redirect remains unsafe.
- **Remediation:** Resolve `next` against `origin`, require the resolved URL to have the same origin, and fall back to `/calculator` otherwise. Add tests for `@evil.com`, absolute URLs, protocol-relative URLs, backslashes, and encoded separators.

### AUTH-002: 2FA users cannot complete account deletion

- **Severity:** High (availability and POPIA compliance)
- **Status:** Resolved (`components/auth/account-settings.tsx`)
- **Evidence:** `components/auth/account-settings.tsx:83-92` invokes deletion only after `ReauthenticateDialog`; `components/auth/reauthenticate-dialog.tsx:38-53` calls `signInWithPassword`, replacing the browser session with a password-only AAL1 session. `lib/supabase/proxy.ts:75-92` redirects AAL1 requests to `/auth/mfa`, and `/api/account/delete` is not exempt. The route also rejects non-AAL2 requests at `app/api/account/delete/route.ts:28-31`.
- **Observed flow:** The middleware returns its default 307 redirect. A DELETE fetch preserves its method through that redirect, reaches the page route instead of the API route, and the client then attempts to parse a non-JSON error response. The route-level unit tests pass in isolation, but there is no end-to-end deletion test for an enrolled 2FA user.
- **Impact:** A user with 2FA cannot exercise self-service account erasure through the UI.
- **Remediation:** Add a dedicated deletion flow that performs password and TOTP proof without replacing an already elevated session, or explicitly elevate with `TotpReauthDialog` before calling the deletion endpoint. Add an end-to-end regression test.

### AUTH-003: Unauthenticated AI endpoint permits cost abuse

- **Severity:** High (commercial abuse)
- **Status:** Resolved (`app/api/plan-narrative/route.ts`, `lib/ai/plan-narrative-schema.ts`, `lib/security/rate-limit.ts`)
- **Evidence:** `app/api/plan-narrative/route.ts` has no authentication, rate limit, request-size limit, or schema validation. The client-controlled `tier` can select the most expensive configured model.
- **Verified case:** An unauthenticated POST returned HTTP 200. The unauthenticated export endpoint correctly returned 401, demonstrating that this is endpoint-specific.
- **Impact:** Attackers can consume AI budget, send oversized payloads, or use the endpoint as an unmetered public service.
- **Remediation:** Require a valid session, validate the complete body with Zod, cap body and account counts, apply per-user/IP quotas, and enforce server-side model/tier entitlements.

### AUTH-004: Vulnerable production dependency tree

- **Severity:** High
- **Status:** Resolved (`next`/`@next/bundle-analyzer`/`eslint-config-next` upgraded to 16.3.0; `vite` pinned via `pnpm-workspace.yaml` overrides)
- **Evidence:** `pnpm audit` exits non-zero with 16 advisories: 8 high and 8 moderate. The installed tree contains `next@16.2.7`, nested `postcss@8.4.31`, and `sharp@0.34.5`. The relevant middleware/proxy advisory applies because this is an App Router application using middleware and Turbopack. Advisories specific to rewrites, Server Actions, or custom servers were not observed as applicable to this codebase.
- **Remediation:** Upgrade `next`, `@next/bundle-analyzer`, and `eslint-config-next` together to a patched compatible release. `next@16.3.0` was verified to bundle `postcss@8.5.23` and `sharp@^0.35.3`. Regenerate and audit the pnpm lockfile, then run the full test, typecheck, build, and browser suites.

### AUTH-005: Recovery-code redemption has no application-specific rate limit

- **Severity:** Medium
- **Status:** Resolved (`app/api/auth/recover/route.ts`, `lib/security/rate-limit.ts`)
- **Evidence:** `app/api/auth/recover/route.ts:16-39` and `public.redeem_recovery_code()` perform no throttling. The configured Supabase Auth limits cover Auth endpoints, MFA challenge/verify, and token operations, not this PostgREST RPC.
- **Impact:** A wrong attempt can perform up to ten bcrypt comparisons, allowing CPU amplification and unlimited guessing attempts. The code space is large enough that practical brute force is still unlikely, but the endpoint is unnecessarily exposed to abuse.
- **Remediation:** Add per-IP and per-user throttling, a bounded attempt counter or temporary lockout, a request body length limit, and a uniform 429 response.

### AUTH-006: Recovery codes are not atomically single-use

- **Severity:** Medium
- **Status:** Resolved (`supabase/migrations/20260810000000_atomic_recovery_code_redemption.sql`)
- **Evidence:** `supabase/migrations/20260802000200_recovery_codes.sql:76-88` first selects an unused matching row and then updates by `id` without a row lock or `used_at is null` condition on the update.
- **Impact:** Concurrent requests can both observe the same unused code and both return `true`, violating the documented single-use invariant. The current factor-deletion side effect is mostly idempotent, but the replay becomes dangerous if the recovery action expands.
- **Remediation:** Make redemption one atomic conditional update, for example an `UPDATE ... WHERE id = ... AND used_at IS NULL RETURNING` flow, or lock the selected row with `FOR UPDATE`. Add a concurrent redemption regression test.

### AUTH-007: Missing Turnstile site key disables all auth forms

- **Severity:** Medium (availability)
- **Status:** Resolved (`instrumentation.ts`)
- **Evidence:** `components/auth/turnstile.tsx:69` renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is absent, while the sign-in, sign-up, reset, and reauthentication buttons require `captchaToken` before submission.
- **Impact:** A deployment missing the public site key silently makes authentication unusable. The test key in `.env.example` masks this during local development.
- **Remediation:** Fail deployment health checks when production Turnstile configuration is incomplete, or make the client behavior match an explicitly disabled server-side CAPTCHA mode. Update the stale component comment and add an environment-matrix test.
- **Deployment note (2026-08-11):** Production Cloudflare widget created (site key `0x4AAAAAAENVcI5snagBAJ2G`, recorded in `.env.example`). Remaining setup lives outside the repo: hosting-platform env vars (`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`, set before `next build`), the same secret in the hosted Supabase dashboard CAPTCHA settings, and the production domain on the widget's hostname allowlist. Local dev intentionally keeps the always-pass test pair so local Supabase captcha validation keeps working.

### AUTH-008: npm and pnpm lockfiles have diverged

- **Severity:** Low
- **Status:** Resolved (`package-lock.json` removed; `preinstall` guard added)
- **Evidence:** `package.json` pins `next` at 16.2.7, while the committed `package-lock.json` root metadata still records 16.2.3. The repository declares `pnpm@11.20.0` and also commits `pnpm-lock.yaml`.
- **Impact:** Different tools can resolve different dependency trees, and npm audit reported a stale `nanoid` issue that was not present in the pnpm-installed tree.
- **Remediation:** Remove `package-lock.json` if pnpm is the supported package manager, enforce `pnpm install --frozen-lockfile` in CI, and add a lockfile policy check.

### AUTH-009: Strict post-deletion token revocation is not guaranteed

- **Severity:** Low/Medium hardening
- **Status:** Resolved (`app/api/account/delete/route.ts`)
- **Evidence:** `app/api/account/delete/route.ts` deletes the user and then calls client-side global sign-out. Supabase access tokens are signed JWTs and can remain cryptographically usable until expiry unless sensitive operations validate the `session_id` against `auth.sessions`.
- **Impact:** Current user data is cascade-deleted, which limits the immediate exposure. However, a future sensitive endpoint that trusts only a valid JWT could accept a token issued before deletion.
- **Remediation:** Decide the required post-deletion guarantee. For strict revocation, validate session existence for sensitive operations and explicitly revoke sessions before deletion where supported. Keep the one-hour JWT expiry and session timeouts under review.

## Reviewed Controls

- RLS enforcement through `mfa_satisfied()` is active in the local database for scenarios, accounts, expenses, and expense groups.
- `store_recovery_codes()` contains the AAL gate that blocks an AAL1 caller with an enrolled factor from replacing recovery codes.
- Recovery-code hashes are stored with bcrypt; raw codes are not selectable through the granted columns.
- Supabase Security Advisor warnings for the five intentional `SECURITY DEFINER` RPCs were reviewed. They have empty search paths, explicit grants, and caller-ownership checks; no cross-user access was found. Keep these warnings in the release review, especially if the RPC surface grows.
- The callback, recovery, deletion, and export routes use server-side user checks; unauthenticated export returned 401 during verification.
- Security headers are present on the development Supabase proxy response. The earlier finding that this proxy strips those headers is withdrawn.

## Verification Record

- `pnpm test`: 43 files, 810 tests passed.
- `pnpm typecheck`: passed.
- `pnpm run test:rls`: completed without assertion errors.
- Semgrep source scan: 0 findings.
- `pnpm audit`: 16 advisories, 8 high and 8 moderate.
- `pnpm lint`: 22 errors and 5 warnings; this is not a clean release gate and includes general React/compiler issues.
- Production build verification was interrupted and is not recorded as passing.

## Remediation Record (2026-08-10)

All nine risks above are resolved on `feature/auth-hardening-2fa`.

- **AUTH-001** — `lib/auth/safe-redirect.ts` adds `safeNext()`, which resolves the untrusted `next` param against `origin` with `new URL()` and only keeps it if the resolved origin matches; anything else (including `@evil.com`, absolute URLs, `//evil.com`, backslash and percent-encoded variants) falls back to `/calculator`. `app/auth/callback/route.ts` now calls it instead of using the raw param. Covered by `lib/auth/safe-redirect.test.ts` (10 cases).
- **AUTH-002** — `components/auth/account-settings.tsx` now tracks whether the user has an enrolled TOTP factor and, for account deletion only, uses `TotpReauthDialog` (`elevateWithTotp`, which challenges the existing factor without touching the session) instead of `ReauthenticateDialog` (`signInWithPassword`, which replaces the session and drops it back to AAL1). Users without 2FA still use the password dialog. `app/api/account/delete/route.ts`'s AAL2 gate is unchanged; it now sees a session that was never downgraded.
- **AUTH-003** — `app/api/plan-narrative/route.ts` now requires `supabase.auth.getUser()` to succeed (401 otherwise), rejects bodies over 50 KB via `Content-Length` before parsing, rate-limits to 20 requests/hour per user (`lib/security/rate-limit.ts`), validates the full body against `lib/ai/plan-narrative-schema.ts` (Zod, `.safeParse`, 400 on failure, capped at 25 accounts), and ignores the client-supplied `tier` entirely — every caller gets `DEFAULT_MODEL_TIER` until a real entitlement system exists to decide who may pick a more expensive model. Covered by `lib/ai/plan-narrative-schema.test.ts` and `lib/security/rate-limit.test.ts`.
- **AUTH-004** — `next`, `@next/bundle-analyzer`, and `eslint-config-next` upgraded 16.2.7 → 16.3.0 (bundles patched `postcss@8.5.23`, `sharp@^0.35.3`). The remaining two dev-only `vite` advisories (both Windows-only, transitive through `vitest`) are closed with a `pnpm-workspace.yaml` override pinning `vite` to `>=8.0.16`. `pnpm audit` now reports **0 vulnerabilities**.
- **AUTH-005** — `app/api/auth/recover/route.ts` adds a `Content-Length` cap (1000 bytes), a 64-character code-length cap, and `lib/security/rate-limit.ts`-backed throttling at 10 attempts/hour keyed by both source IP (`x-forwarded-for`) and authenticated user ID, returning a uniform 429. Covered by new cases in `app/api/auth/recover/route.test.ts`.
- **AUTH-006** — `supabase/migrations/20260810000000_atomic_recovery_code_redemption.sql` replaces `public.redeem_recovery_code()`'s unconditional `UPDATE ... WHERE id = target` with `UPDATE ... WHERE id = target AND used_at IS NULL`, checked via `GET DIAGNOSTICS rows_updated = ROW_COUNT`. Postgres's row-level locking on the UPDATE makes this atomic: only the first of two concurrent redemptions of the same code can ever flip the row. Re-run `pnpm run test:rls` against a running Supabase instance to confirm (the existing sequential assertions in `supabase/tests/rls_mfa.test.sql` still pass; a true concurrency test needs two simultaneous connections and wasn't added).
- **AUTH-007** — `instrumentation.ts` (Next.js instrumentation hook, runs once at server startup) throws in production if `NEXT_PUBLIC_TURNSTILE_SITE_KEY` or `TURNSTILE_SECRET_KEY` is unset, or if the site key matches one of Cloudflare's published always-pass/always-block/always-challenge test keys — turning a silent, invisible failure into a startup crash. `components/auth/turnstile.tsx`'s stale comment was updated to point at it. Covered by `instrumentation.test.ts` (6 cases).
- **AUTH-008** — `package-lock.json` removed (pnpm is the declared and CI-relevant package manager); `package.json` gained a `preinstall` script (`npx -y only-allow pnpm`) so `npm install`/`yarn install` fail immediately instead of silently producing a divergent tree. `pnpm-lock.yaml` was already current at `next@16.3.0` after the AUTH-004 upgrade.
- **AUTH-009** — `app/api/account/delete/route.ts` now calls `admin.auth.admin.signOut(user.id, "global")` before `admin.auth.admin.deleteUser(user.id)`, explicitly revoking refresh tokens ahead of the cascade delete. The primary guarantee is unchanged and was already correct: every route authenticates via `supabase.auth.getUser()`, which re-verifies against Supabase Auth per request rather than trusting a locally-decoded JWT, so a deleted user's token stops working the moment the user row is gone. The explicit sign-out is defense in depth, and the route now documents that any future endpoint must keep using `getUser()` rather than decoding a JWT locally. Covered by a new ordering assertion in `app/api/account/delete/route.test.ts`.

**Verification after remediation:**
- `pnpm test`: 47 files, 840 tests passed (one unseeded statistical test in `lib/monte-carlo/__tests__/random-returns.test.ts` is flaky in isolation and unrelated to this change; reran clean).
- `pnpm typecheck`: passed.
- `pnpm build`: passed (Next.js 16.3.0, Turbopack), all routes including `instrumentation.ts` registered.
- `pnpm audit`: 0 vulnerabilities (down from 16).
- `pnpm lint` on all new/changed files: 0 errors, 0 warnings. The pre-existing 22 errors / 5 warnings elsewhere in the repo (React Compiler `set-state-in-effect` findings, an unrelated unescaped-entity warning) are unchanged and out of scope for this remediation.
- `pnpm run test:rls` was not re-run in this pass (requires a running local Supabase Postgres container) — recommended before the next deploy given the AUTH-006 migration.

**Residual items for the next review:**
- AUTH-003's per-instance in-memory rate limiter (`lib/security/rate-limit.ts`) is not durable and not shared across serverless instances; replace with a shared store (e.g. Upstash Redis) before relying on it at scale. The same limiter backs AUTH-005.
- AUTH-003's tier restriction is a blunt instrument (nobody gets `best`/`fast` via the API) rather than real entitlements; revisit once a subscription/plan system exists.
- The two remaining `pnpm audit` clears are enforced via a `pnpm-workspace.yaml` override rather than an upstream fix landing in `vitest`; revisit when `@vitest/mocker`/`vite` update their own dependency ranges.
