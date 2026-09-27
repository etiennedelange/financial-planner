# 2026-09-27 — Sign-in dialog behind `NEXT_PUBLIC_AUTH_ENABLED`

## What changed

Supabase sign-in is still work in progress, but the deployed Vercel site exposed a
working sign-in / sign-up / reset dialog. It is now gated by a build-time flag.

- `lib/config/features.ts` — `isAuthEnabled()`: true only when
  `NEXT_PUBLIC_AUTH_ENABLED === "true"`. **Default off**, so a deploy that never sets
  the variable ships with auth disabled.
- `components/auth/auth-modal.tsx` — when off, the dialog still opens but: subtitle
  reads "Accounts are coming soon", a note explains the plan is saved in this browser,
  every input/button (including the sign-in/up/reset mode links) sits in a
  `<fieldset disabled>`, submit buttons read "Coming soon", the Turnstile widget is
  not rendered (no Cloudflare call), and each submit handler returns early before
  touching Supabase.
- `components/layout/sidebar.tsx` — the "Sign in" button stays visible with a muted
  "Soon" tag.
- `.env.example` documents the flag (`true` for local dev); `.env.local` opted in.

## Why this shape

The user was fine with either hiding the entry point or showing a disabled dialog;
disabled-but-visible signals the feature is coming without offering a broken flow.
Signed-in-only surfaces (Settings → Account, `/auth/*` routes) are unreachable
without a session, so they are not gated separately. `instrumentation.ts` (AUTH-007)
still requires Turnstile keys in production — unchanged.

## Deploying

`NEXT_PUBLIC_*` is inlined at `next build`. Vercel project `financial-planner` has
`NEXT_PUBLIC_AUTH_ENABLED=false` (plain, Production + Preview) set explicitly so the
state is visible in the dashboard;
to ship auth, set `NEXT_PUBLIC_AUTH_ENABLED=true` for the environment and redeploy.

## Verification

- New tests: `lib/config/features.test.ts` (flag parsing), `components/auth/auth-modal.test.tsx`
  (disabled state: fieldset disabled, no captcha, "Coming soon"; enabled state renders captcha).
- `npm run test` 1012/1012, typecheck/lint/build clean.
- shadscan 93/100 unchanged (first draft's unnamed fieldset tripped
  `grouped-controls-have-legend`; fixed with `aria-label`).
