# Vercel build failure: protocol-less VERCEL_PROJECT_PRODUCTION_URL

**Date:** 2026-08-16
**Type:** Bug fix (production build blocker on Vercel)

## Symptom

`next build` on Vercel failed during "Collecting page data":

```
Error: Failed to collect configuration for /_not-found
  [cause]: TypeError: Invalid URL
    at module evaluation (app/layout.tsx:32:17)
      metadataBase: new URL(siteUrl),
    code: 'ERR_INVALID_URL', input: 'retirement-calculator-claude.vercel.app'
```

Local `pnpm build` passed, so this looked environment-specific.

## Root cause

`app/layout.tsx` resolved the site URL as:

```ts
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL ??
  "http://localhost:3000"
```

Vercel injects `VERCEL_PROJECT_PRODUCTION_URL` **without a scheme**
(`retirement-calculator-claude.vercel.app`), so `new URL(siteUrl)` throws
`ERR_INVALID_URL`. Locally neither env var is set, the `http://localhost:3000`
fallback is used, and the build passes — masking the bug until a Vercel deploy.

The same duplicated pattern also fed `app/robots.ts` and `app/sitemap.ts`, which
would have emitted protocol-less URLs (`retirement-calculator-claude.vercel.app/sitemap.xml`)
in production — a latent SEO bug that did not crash the build.

## Fix

- Added `lib/utils/site-url.ts` exporting `resolveSiteUrl()` — the single
  source of truth for the canonical site URL. It prefers
  `NEXT_PUBLIC_SITE_URL`, falls back to `VERCEL_PROJECT_PRODUCTION_URL`, then
  `http://localhost:3000`, and normalises protocol-less values to `https://`
  before returning (so `new URL()` always succeeds).
- Switched `app/layout.tsx`, `app/robots.ts`, and `app/sitemap.ts` to import it,
  removing the triplicated resolution logic.
- Added `lib/utils/site-url.test.ts` (5 tests): explicit URL preferred, Vercel
  URL normalised to https, already-schemed URL kept, localhost fallback, and a
  guarantee that the result is always accepted by `new URL()`.

## Verification

- Reproduced the exact Vercel error locally first:
  `VERCEL_PROJECT_PRODUCTION_URL=retirement-calculator-claude.vercel.app pnpm build`
  failed with `ERR_INVALID_URL` at `app/layout.tsx:32` before the fix.
- After the fix the same command builds cleanly (24/24 static pages).
- `npm run typecheck` — clean.
- `npm run test` — 990/990 pass (56 files).
