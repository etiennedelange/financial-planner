---
type: History Entry
title: "2026-11-14 — AI summaries: Workers AI, your own key, and the fixes that made them work"
description: "Explain My Plan could never work on a deployment without sign-in, and older plans failed the request schema; fixed both, added Cloudflare Workers AI beside Vercel AI Gateway, let users bring their own key, updated model IDs and surfaced real error messages."
date: 2026-11-14
tags: [ai, security, bug-fix]
---

# 2026-11-14 — AI summaries: Workers AI, your own key, and the fixes that made them work

## What was wrong

The "Explain My Plan" card (`components/dashboard/plan-narrative-card.tsx` →
`app/api/plan-narrative/route.ts`) had four problems:

1. **It could not work without sign-in.** The route returned 401 to anyone without a
   Supabase session, but sign-in ships switched off (`NEXT_PUBLIC_AUTH_ENABLED`, see
   `lib/config/features.ts`). On such a deployment every request failed.
2. **Older plans failed the request schema.** Plans saved before
   `drawdownConfig.lumpSumPercentage` existed, and cloud scenarios loaded as untyped
   JSON, send `undefined`; the route's Zod schema requires a number. The engine
   treats a missing value as 0 (`projection-engine.ts`). Problem 1 hid this one; it
   showed up once guests could reach the schema check.
3. **Every failure looked the same.** `toTextStreamResponse()` turned provider errors
   (bad key, no credit, unknown model) into an empty 200, and the client showed
   "Couldn't generate a summary" whatever the cause.
4. **The model picker did nothing, and the model IDs were behind.** The server ignored
   the tier on purpose (no entitlement system), but the card still offered
   Fast/Balanced/Best. The IDs were `claude-haiku-4.5`, `claude-sonnet-5` and
   `claude-opus-5`; the gateway now serves the 5.5 models.

There was also only one way to run the model: Vercel AI Gateway.

## What changed

**Providers** (`lib/ai/providers.ts`, `lib/ai/model-tiers.ts`)
- Two providers: Vercel AI Gateway and **Cloudflare Workers AI**. Workers AI goes
  through its OpenAI-compatible endpoint
  (`https://api.cloudflare.com/client/v4/accounts/{id}/ai/v1`) with
  `@ai-sdk/openai-compatible`. It is a plain HTTPS call, so it works whether the
  app runs on Vercel, on Cloudflare, or locally.
- The server's own provider comes from env: `AI_PROVIDER` (gateway | cloudflare |
  none), or auto-detected in this order: `AI_GATEWAY_API_KEY`, then
  `CLOUDFLARE_AI_ACCOUNT_ID` + `CLOUDFLARE_AI_API_TOKEN`, then Vercel OIDC. The
  Cloudflare variables are deliberately not wrangler's `CLOUDFLARE_API_TOKEN`, so a
  deploy token is never used as the AI key.
- Tiers map per provider. Gateway: `anthropic/claude-haiku-5.5`,
  `anthropic/claude-sonnet-5.5`, `anthropic/claude-opus-5.5` (checked against
  `ai-gateway.vercel.sh/v1/models`). Workers AI: `@cf/openai/gpt-oss-20b`,
  `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, `@cf/openai/gpt-oss-120b` (checked
  against Cloudflare's model catalogue; none are marked for deprecation).
- `maxOutputTokens: 2048` caps cost per call and leaves room for the gpt-oss
  reasoning tokens. The request's abort signal is forwarded.
- `ai` upgraded 7.0.157 → 7.0.172 so it and `@ai-sdk/openai-compatible` share one
  `@ai-sdk/provider` version (the older pair failed typecheck on a new stream part).

**Your own key** (`lib/ai/own-key.ts`, `lib/store/ai-settings-store.ts`,
`components/settings/ai-provider-settings.tsx`)
- Settings → **AI Provider**: "App default" or "My own API key" (AI Gateway key, or
  Workers AI token plus account ID).
- The key is held only in the browser: sessionStorage by default, localStorage when
  "Remember on this device" is ticked, and "Remove saved keys" clears both. It
  travels as `x-ai-*` headers on the narrative request, is validated (printable, no
  spaces, 8–512 characters; account ID exactly 32 hex characters because it goes into
  the URL path), used for that one call, and never stored or logged on the server.
- An incomplete own-key form is an error, never a quiet fall back to the app's key
  (which would spend the operator's credit). The same rule holds on the client
  (`buildNarrativeRequest`) and on the server (`parseUserCredentials`).
- Tier choice is real only on the user's own key. The card shows the picker only in
  that mode; hosted requests always run the default tier.
- The store hydrates after mount (`skipHydration` + `useAiSettingsHydration`), so
  server and client render the same markup.

**Access and rate limiting** (route, `lib/security/client-ip.ts`)
- Signed-out visitors may use their own key. The app's key stays behind sign-in
  unless the operator sets `AI_HOSTED_GUEST_ACCESS=true`. Without it, a public
  deployment with sign-in off would let anyone spend the operator's credit, held back
  only by the in-memory limiter.
- Signed-out callers are rate-limited per IP (20 an hour, same as signed-in users per
  account). The IP comes from the header the platform sets: `x-real-ip` on Vercel,
  `cf-connecting-ip` otherwise, then `x-forwarded-for`.

**Errors** (`lib/ai/narrative-stream.ts`, `lib/ai/narrative-response.ts`)
- The route waits for the first piece of text before it commits to a streamed 200. A
  provider error before any text becomes a real status with a message:
  401 "rejected your API key", 402 out of credit, 429 rate-limited, 502 model
  unavailable. A rejected *hosted* key reads as "service unavailable" (503), not
  "your key". Errors after text has started end the stream early.
- Logs record only the error name and status (`[plan-narrative] generation failed:
  AI_APICallError (401)`), never the error body, URL or key.
- The client shows the route's message (`readNarrativeError`), with a generic
  fallback for non-JSON or schema errors.
- Replaced the deprecated `toTextStreamResponse()` with `createTextStreamResponse()`.

**Payload** (`lib/ai/plan-narrative-prompt.ts`): a missing `lumpSumPercentage` is sent
as 0, matching the engine.

## Verification

- New tests: `providers.test.ts`, `own-key.test.ts`, `narrative-stream.test.ts`,
  `narrative-response.test.ts`, `ai-settings-store.test.ts`, `client-ip.test.ts`,
  `app/api/plan-narrative/route.test.ts` (19 route cases: hosted gateway/Cloudflare,
  own key over hosted, guest policy, per-IP limits, error mapping, log redaction).
  Full suite: 90 files, 1,564 tests, all passing.
- Mutation checks: letting hosted callers pick a tier, falling back to the hosted key
  when the own-key header lacks a key, restoring the old "no session → 401" gate, and
  dropping the `lumpSumPercentage` default each fail the new tests.
- Coverage: 100% of statements in the new `lib/ai` files, about 95% in the route; the
  settings store's gaps are the browser-only storage getter and the mount hook (no
  React testing library in the repo).
- `pnpm check`, `pnpm typecheck` and `next build` are clean. Shadscan holds 90/100:
  the key field uses `autocomplete="new-password"`, because browsers ignore `off`
  on password fields and could autofill the site login there.
- Live run in headless Chromium against `next dev`, signed out, with a seeded plan:
  the hosted request returns the sign-in message. A fake Workers AI token reaches
  Cloudflare, comes back 401, and the card shows "The AI provider rejected your API
  key". The key is in sessionStorage only and is not in the server log.
- **Not verified:** a successful generation against a real provider. That needs a
  working key and spends credit. The streaming path is covered by the route tests
  with a mocked model stream.
