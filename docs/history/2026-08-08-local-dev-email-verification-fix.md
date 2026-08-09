# 2026-08-08 — Local-Dev Fix: Auth Email Links Unreachable (ERR_CONNECTION_REFUSED)

Follow-up on the `feature/auth-hardening-2fa` branch, after the 2026-08-08 auth-hardening
completion entry in `docs/project-phases.md`. Local-dev-environment fix — no calculation
code touched, so CLAUDE.md's unit-test rule does not apply.

## Root cause

Supabase's local GoTrue instance builds the confirmation/recovery link in signup and
password-reset emails from the `[api] port` config, hardcoded as
`http://127.0.0.1:54321/auth/v1/verify?...`. That raw port is not reliably reachable from
the browser in this devcontainer — the same underlying reason
`app/supabase/[...path]/route.ts` already proxies the app's own Supabase `fetch()` calls
through `localhost:3000`. That proxy only covers calls the app makes itself; it cannot
rewrite a static href already baked into an email body. Clicking the link produced
`ERR_CONNECTION_REFUSED`.

## Fix

- **New `supabase/templates/confirmation.html` and `supabase/templates/recovery.html`** —
  custom email templates using Supabase's documented `{{ .SiteURL }}` + `{{ .TokenHash }}`
  pattern instead of GoTrue's own `/verify` redirect. Links resolve to
  `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=signup` (and
  `&type=recovery` for the reset template).
- **`supabase/config.toml`** — added `[auth.email.template.confirmation]` and
  `[auth.email.template.recovery]` sections pointing at the new templates; changed
  `site_url` from `http://127.0.0.1:3000` to `http://localhost:3000` to match the
  already-working `NEXT_PUBLIC_SUPABASE_URL` proxy origin.
- **`app/supabase/[...path]/route.ts`** — the proxy now forwards GoTrue's redirects
  (`redirect: "manual"`) instead of following them internally. Following them here
  inlined the redirect target's already-rendered HTML — with its own CSP nonce baked
  into its script tags — under this route's URL, whose middleware stamps a different
  nonce on the response header, failing every script's nonce check. Also strips
  `content-encoding`/`content-length` from the forwarded response: `fetch()`
  transparently decompresses the body, so the original headers described bytes that no
  longer matched what was being sent, and the browser failed to decode them.
- **No changes to `app/auth/callback/route.ts`** — it already accepted both the PKCE
  `code` shape and the OTP `token_hash`+`type` shape, so the existing route handled the
  new template's link format without modification.

## Verification

- Playwright + Mailpit API, end-to-end: signup-confirmation flow, and password-recovery
  flow (confirmed recovery lands on `/auth/reset-password`, not a direct login).
- Full suite: 789/789 passing (one statistical Monte Carlo test flaked on unseeded RNG
  on first run, passed clean on rerun — unrelated, pre-existing flake pattern also noted
  in the 2026-07-11 audit history entry).
- `npm run typecheck` clean.
