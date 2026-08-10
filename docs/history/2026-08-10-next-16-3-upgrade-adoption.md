# 2026-08-10 — Next.js 16.3 upgrade adoption: error boundaries, Rust React Compiler, Instant Navigations

**Date:** 2026-08-10
**Branch:** feature/auth-hardening-2fa (layer on top)

## What

`next` was already on 16.3.0 (upgraded during the 2FA security audit). This pass adopted three
things 16.3 shipped that the app wasn't using:

1. **Error boundaries with the 16.3 `retry` API** — the app had zero `error.tsx` files, so any
   render-time exception crashed the whole route with the default error screen. 16.3 replaced the
   old `reset` callback with `retry`, which re-fetches the failed server-rendered children (via
   `router.refresh()` under the hood) rather than just clearing local error state.
2. **Native Rust React Compiler** — the app already had `reactCompiler: true` (the Babel path).
   `experimental.turbopackRustReactCompiler` runs the compiler natively inside Turbopack (~34–46%
   faster cold/warm `next dev`), and drops the Babel transform.
3. **Instant Navigations** — `cacheComponents: true` + `partialPrefetching: true`, plus `prefetch`
   on the sidebar/bottom-nav links so the app shell is prefetched and tab switches feel SPA-snappy.

## Files

- `next.config.js` — added `cacheComponents`, `partialPrefetching`, and
  `experimental.turbopackRustReactCompiler`.
- `app/layout.tsx` — added `export const instant = false`.
- `app/error.tsx` (new) — root error boundary.
- `app/calculator/error.tsx` (new) — calculator-scoped error boundary.
- `components/error/error-fallback.tsx` (new) — shared fallback UI (PageCard + destructive label,
  error digest, `Try again`/`Reload page` buttons).
- `components/layout/sidebar.tsx`, `components/layout/bottom-nav.tsx` — `prefetch` on nav Links.

## Design decisions

- **`instant = false` on the root layout.** `cacheComponents` enables Partial Prefetching, which
  wants to prerender the app shell at build time. This app is *fully dynamic* — the root layout
  calls `await connection()` (to force dynamic rendering so the CSP nonce from
  `lib/supabase/proxy.ts` always reaches framework scripts) and reads `headers()` for the
  next-themes nonce. Opting the whole tree out of instant navigation (`instant = false`) keeps the
  existing dynamic/CSP behaviour exactly as before, verified by the build output (every route still
  marked `ƒ` Dynamic). This is the documented `[block]` escape hatch for exactly this case.
- **Root + calculator error boundaries only.** The root boundary catches everything below the
  root layout; the calculator one gives the tabbed area a scoped fallback. We deliberately did NOT
  add a `global-error.js` — that only handles errors in the root layout itself (which is thin) and
  must render its own `<html>/<body>`, which would duplicate the font/theme setup for no gain here.
- **ErrorFallback uses the design system** — `PageCard` with `labelVariant="destructive"`,
  `border-destructive/40`, and semantic tokens only, per CLAUDE.md rules. The digest is shown in
  muted mono (useful for support) but the raw `error.message` is not surfaced to end users.

## Verification

- `npm run build` — clean; every route still `ƒ` Dynamic; `next.config.js` logged
  "Cache Components enabled", "Partial Prefetching enabled", and "✓ turbopackRustReactCompiler".
- `npm run typecheck` — clean.
- `npm run lint` on touched files — clean (repo-wide lint has 22 pre-existing errors, untouched).
- `npm run test` — 854/854 passing.
- `npm run test:coverage` — pre-existing branch-coverage shortfall (83.92% vs 85%) is unchanged
  by this work (verified by stashing only these files).
- Manual browser verification via chrome-devtools MCP:
  - Root error boundary exercised by temporarily throwing in `app/print/page.tsx` — the fallback
    rendered with the error digest, `Try again`, and `Reload page`; reverted and page served 200.
  - App routes load normally; no console warnings/errors.

## Notes

- The old `error.tsx` contract (`{ error, reset }`) is gone in 16.3 — boundaries now receive
  `{ error, retry }`. Any future `error.tsx` must use `retry`.
- `turbopackRustReactCompiler` is experimental and Turbopack-only; `reactCompiler: true` must stay
  enabled alongside it. If webpack is ever re-introduced, this flag must be removed.
- `cacheComponents`/`partialPrefetching` are building toward the next major's defaults ("dynamic by
  default"). If the app ever gains server-rendered data fetching, `"use cache"` becomes available.
