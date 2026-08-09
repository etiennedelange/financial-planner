# 2026-08-08 — Fix: `/auth/mfa` "Could not load your authentication factors." (dev-proxy redirect loop)

Follow-up on the `feature/auth-hardening-2fa` branch, layered on top of the same-day
local-dev email-link fix and the Manage Account modal→page rework (both above/earlier
in `docs/project-phases.md`). Routing-middleware bug fix — no calculation code touched,
so CLAUDE.md's unit-test rule does not apply.

## Symptom

A user signing in with a 2FA-enrolled account landed on the `/auth/mfa` two-factor
challenge page and immediately saw "Could not load your authentication factors."
instead of a TOTP code field.

## Root cause

`lib/supabase/proxy.ts` exports `updateSession()`, the Next.js routing middleware
(wired up via `proxy.ts` at the repo root) that enforces the AAL2 (2FA) gate: any
request is redirected to `/auth/mfa` when the session is AAL1 but the user has an
enrolled TOTP factor (`needsSecondFactor`). An `isMfaExempt` allowlist keeps a small
set of paths reachable while gated, so the challenge page and its own API calls don't
get redirected into a loop — originally just `path.startsWith("/auth/")` and
`path === "/api/auth/recover"`.

Earlier in this same session, `app/supabase/[...path]/route.ts` was added (see
`docs/history/2026-08-08-local-dev-email-verification-fix.md`): a dev-only proxy that
forwards browser Supabase API calls through this app's own origin (`/supabase/*`)
instead of hitting `127.0.0.1:54321` directly, because that port isn't reliably
reachable from the browser in this devcontainer. That proxy path was never added to
`isMfaExempt`. Consequence: once a user lands on `/auth/mfa`, the challenge page's own
`supabase.auth.mfa.listFactors()` call — which now goes out through
`/supabase/auth/v1/user` via the dev proxy instead of straight to Supabase — was itself
intercepted by this same middleware and redirected back to `/auth/mfa`, a
redirect-to-self loop that returned the `/auth/mfa` page's HTML instead of the JSON the
Supabase client expected. The client surfaced that as "Could not load your
authentication factors."

This bug was a direct, previously-latent consequence of adding the dev proxy: before
`app/supabase/[...path]/route.ts` existed, all supabase-js browser calls went straight
to `127.0.0.1:54321` and never touched this app's own middleware, so the gap in
`isMfaExempt` never mattered.

## Fix

One line in `lib/supabase/proxy.ts` — added `path.startsWith("/supabase/")` to the
`isMfaExempt` check, with a comment referencing the same reasoning already documented
for the `/api/auth/recover` exemption: it's API traffic the challenge page itself
depends on, not page content that should be redirected.

```ts
const isMfaExempt =
  path.startsWith("/auth/") || path === "/api/auth/recover" || path.startsWith("/supabase/")
```

## Scope note

This bug is specific to the devcontainer's `/supabase/*` dev-proxy setup and would not
manifest in a production deployment, where `NEXT_PUBLIC_SUPABASE_URL` points directly
at a real Supabase project origin. The fix is still correct and harmless in
production — the `/supabase/*` path match there simply never occurs, since browser
calls go to the real Supabase domain instead.

## Verification

- Reproduced first with a fresh, non-stale test account: signed up, verified email,
  enrolled TOTP via the Settings page's Security section (computed TOTP code), signed
  out, signed back in. Confirmed `/auth/mfa` showed the error, and the network tab
  showed `/supabase/auth/v1/user` returning a 307 redirect to `/auth/mfa` instead of
  the expected JSON.
- Applied the fix and reproduced the same flow again: `/auth/mfa` now loads the
  enrolled factor with no error, and completing the TOTP code lands the user back in
  `/calculator/overview` fully signed in.
- `npm run typecheck` clean.
- `npm run test` — 789/789 passing.
- `npm run build` succeeds.
