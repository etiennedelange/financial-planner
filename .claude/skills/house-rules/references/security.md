# Security Checklist

Read when the diff touches `app/api/`, `app/auth/`, `lib/auth/`, `lib/supabase/`,
`lib/security/`, `supabase/migrations/`, or `proxy.ts`.

Primary source: `docs/security/auth-2fa-risk-register.md` (reviewed and remediated
2026-08-10, nine risks AUTH-001…AUTH-009). Each check below guards a risk that was found
*in this codebase* — these are regressions waiting to happen, not hypotheticals.

Supporting: `docs/history/2026-08-10-auth-2fa-security-audit.md`,
`docs/history/2026-08-15-bootstrap-data-ownership-hardening.md`,
`docs/history/2026-08-08-mfa-challenge-dev-proxy-redirect-loop-fix.md`

---

## SEC1 — Redirects (AUTH-001, High)

**The incident:** `app/auth/callback/route.ts` concatenated an untrusted `next` parameter
into `NextResponse.redirect()`. `next=@evil.com` produced
`https://app.example.com@evil.com/` — origin `evil.com`. Usable in phishing and redirect
chains from auth and recovery links.

**Check:** every redirect built from user-controlled input goes through
`lib/auth/safe-redirect.ts`. The contract: resolve against `origin`, require same-origin,
fall back to `/calculator`.

**Check:** new redirect paths have tests for the documented attack shapes — `@evil.com`,
absolute URLs, protocol-relative (`//evil.com`), backslashes, and encoded separators.

---

## SEC2 — API routes must authenticate, validate, and throttle (AUTH-003, High)

**The incident:** `app/api/plan-narrative/route.ts` had no authentication, no rate limit, no
request-size limit, and no schema validation. An unauthenticated POST returned 200, and a
client-controlled `tier` could select the most expensive configured model — an unmetered
public AI service billed to this project.

**Check every new or modified route handler for all five:**

1. **Auth** — a valid session is required, unless the route is deliberately public and says so
2. **Zod validation** of the *complete* body, not just the fields the handler reads
3. **Body and collection caps** — max payload size, max account count
4. **Rate limiting** via `lib/security/rate-limit.ts`, per-user and per-IP
5. **Server-side entitlement** — model/tier selection is never trusted from the client

**Check:** a route that consumes a paid resource (AI, email, storage) without a quota. Cost
abuse is a documented High severity here, not a theoretical concern.

**Check:** RPC endpoints. AUTH-005 was exactly this — `redeem_recovery_code()` had no
application-level throttle, because Supabase's configured Auth limits cover Auth endpoints
and MFA challenge/verify, **not** arbitrary PostgREST RPCs. Do not assume platform limits
cover a custom RPC.

---

## SEC3 — AAL2 / MFA gating (AUTH-002, High)

**The incident:** a 2FA-enrolled user could not delete their account. `ReauthenticateDialog`
called `signInWithPassword`, which *replaced* the elevated browser session with a
password-only AAL1 session. `lib/supabase/proxy.ts` then redirected the AAL1 request to
`/auth/mfa`; a `DELETE` fetch preserves its method through a 307, hit the page route instead
of the API route, and the client tried to parse a non-JSON error. Route-level unit tests
passed in isolation — only an end-to-end test catches this.

**Check:** re-authentication never downgrades an already-elevated session. Elevate with the
TOTP dialog rather than re-running `signInWithPassword`.

**Check:** sensitive routes assert AAL2 server-side *and* are reachable — a route that
correctly rejects non-AAL2 requests is still broken if the proxy redirects the request away
before it arrives.

**Check:** new sensitive operations have an **end-to-end** test with an enrolled 2FA user.
Unit tests passing in isolation is the exact false signal this incident produced.

---

## SEC4 — Service-role key handling

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS entirely. It is currently read in exactly two
places: `app/api/auth/recover/route.ts` and `app/api/account/delete/route.ts`.

**Check:** any new read of `SUPABASE_SERVICE_ROLE_KEY`. A third call site needs
justification in the review — it is not a routine addition.

**Check:** the key never reaches a client component, a `NEXT_PUBLIC_*` variable, or a
response body. This is Critical if violated.

**Check:** service-role clients are constructed per-request inside the handler, never at
module scope where they could leak across requests.

**Check:** a service-role call path that bypasses the RLS-based 2FA enforcement gate.
Two-factor enforcement lives in RLS, in `public.mfa_satisfied()` (see
`20260802000100_mfa_rls.sql`) — it is the project's **single** enforcement point. A
service-role client routes around it entirely, so a new service-role call site is also
a new hole in the 2FA gate, not just in row ownership. Evaluate every new service-role
path against the gate, even when the code does not touch `app/auth/`.

---

## SEC5 — RLS and migrations

**Check:** a new table without RLS enabled and policies defined. Existing migrations
establish the pattern — `20260802000100_mfa_rls.sql`,
`20260802000400_recovery_codes_require_mfa.sql`.

**Check:** a policy widened (e.g. `USING (true)`) without explicit justification.

**Check:** ownership. Rows are scoped per user; `20260802000005_scenario_claim_tracking.sql`
and the bootstrap hardening work exist to keep guest and user data from crossing. New
queries must filter by the owning user, not rely on the client to ask nicely.

**Check:** operations that must be atomic actually are. AUTH-006 was recovery codes not
being atomically single-use; the fix is `20260810000000_atomic_recovery_code_redemption.sql`.
A check-then-write pair across two statements is a race.

---

## SEC6 — Dependencies (AUTH-004, High)

**The incident:** `pnpm audit` exited non-zero with 16 advisories (8 high, 8 moderate). The
middleware/proxy advisory applied because this is an App Router app using middleware and
Turbopack. Resolved by upgrading `next`, `@next/bundle-analyzer`, and `eslint-config-next`
together to 16.3.0.

**Check:** if `package.json` or `pnpm-lock.yaml` changed, run `pnpm audit`.

**Check:** `next`, `@next/bundle-analyzer`, and `eslint-config-next` moved **together**.
Splitting them is what produced the mismatched tree.

The project also has a dedicated `security-audit` skill for devcontainer, pnpm, and semgrep
checks — recommend it rather than reproducing it here.

---

## SEC7 — Injection and rendering

**Check:** new `dangerouslySetInnerHTML`. Exactly one exists, in `components/ui/chart.tsx`
for generated CSS custom properties. Any new instance carrying user-derived content is a
finding.

**Check:** raw SQL built by string concatenation in a migration or RPC. Use parameters.

**Check:** secrets or user PII in `console.log`. An earlier incident had a captcha failure
silently reported to the console instead of surfaced
(`docs/history/2026-08-08-account-settings-page-migration.md`) — logs are neither a UI nor
a safe place for user data.
