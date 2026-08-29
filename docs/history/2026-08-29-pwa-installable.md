# PWA: installable + offline-capable via manifest, icons, and service worker

Date: 2026-08-29

## What

The SA Retirement Calculator is now installable as a PWA and keeps working
offline. No new dependencies were added:

- **Web app manifest** (`app/manifest.ts`, served at `/manifest.webmanifest`) —
  `display: standalone`, `start_url: /calculator`, `theme_color: #178262`,
  `background_color: #faf9fb`, and the 192/512 icons.
- **Icons** — `app/icon1/route.tsx` (192×192), `app/icon2/route.tsx`
  (512×512), `app/apple-icon/route.tsx` (180×180 apple-touch icon), all
  rendered from one shared `PwaIconArtwork` component (`lib/pwa/icon-artwork.tsx`),
  served as `image/png` with Vercel's `next/og` `ImageResponse`.
- **Service worker** (`public/sw.js`) with three strategies:
  - Navigations: **network-first**, falling back to an inline offline page
    ("You're offline / Reconnect to continue planning your retirement") —
    pages are dynamic SSR with per-user data and must never be cached.
  - `/_next/static/*` (hashed JS/CSS/fonts): **cache-first** into
    `static-assets-v1` — offline reloads render the app shell from cache.
  - Everything else (API, auth, cross-origin): network-only.
  - `install` does `skipWaiting()`, `activate` prunes stale caches and
    `clients.claim()`s.
- **Headers** — `next.config.js` sets `Cache-Control: no-cache, no-store,
  must-revalidate` on `/sw.js` so updates are never stale-cached.
- **Registration** — `components/pwa/service-worker-register.tsx` registers
  `/sw.js` in a client effect, production-only (`NODE_ENV === "production"`),
  mounted in the root layout alongside `appleWebApp` metadata and a
  theme-adaptive `themeColor` viewport (`#178262` light / `#3cddac` dark).
- 3 unit tests for the registration guard (`service-worker-register.test.tsx`).

## Why

The calculator is a tool people open every month (and a home-screen shortcut
should behave like an app, not a bookmark), and a slow or missing connection
should never leave a saved plan unreachable. Manifest + icons + SW make it
installable on Android (Chrome), desktop (Chrome/Edge), and iOS (Safari via
`apple-touch-icon` + `appleWebApp`), with offline-first assets so a dropped
connection degrades to a cached shell instead of a blank page.

## Verification

### Gate (all green)

- `npm run test` — **1002/1002** passed (60 files)
- `npm run typecheck` — clean (exit 0)
- `npm run lint` — 0 errors (9 pre-existing warnings)
- `npm run build` — clean; `/manifest.webmanifest`, `/icon1`, `/icon2`,
  `/apple-icon` all generated as static routes
- `npm run shadscan:gate` — **93/100 (A)**, exit 0 (≥90 gate passed; known
  `mobile-nav-present` waiver unchanged)

### Browser verification (production build, `next start -p 3001`)

Playwright/Chromium against `http://localhost:3001/calculator`:

- `<link rel="manifest">` → `/manifest.webmanifest` (200,
  `application/manifest+json`); JSON has `display: standalone`, both icons
  (`/icon1` 192×192, `/icon2` 512×512, `image/png`), `theme_color #178262`,
  `background_color #faf9fb`, `start_url /calculator` — **pass**
- `<link rel="apple-touch-icon">` (180×180) → 200, `image/png` — **pass**
- SW: `navigator.serviceWorker.ready` resolves, one registration at scope
  `/`, state `activated`, `scriptURL /sw.js`; page controlled after one reload
  — **pass**
- `static-assets-v1` cache populated with 38 `/_next/static/*` entries (JS +
  WOFF2) after reloads — **pass**
- Offline (`context.setOffline(true)`): reload shows the fallback page
  ("You're offline / Reconnect to continue planning your retirement"), a
  cached `_next/static` chunk is served from the SW cache (200), navigating to
  a non-cached URL shows the fallback, and **no console errors** during the
  offline phase — **pass**
- Network restored: `/calculator` renders the app shell again (no fallback) — **pass**
- CSP: **zero true CSP directive violations**; `/sw.js` fetch allowed (200,
  `application/javascript`). The only console noise is pre-existing
  `@vercel/analytics`/`@vercel/speed-insights` 404s (those endpoints only
  exist on Vercel deployments; present before this branch) — **not** CSP
  blocks, **not** SW-related
- **Lighthouse 11.7.1** PWA category: **0.88/1**. `installable-manifest: 1`
  ("Web app manifest and service worker meet the installability
  requirements"), `splash-screen: 1`, `themed-omnibox: 1`, `viewport: 1`,
  `content-width: 1`. Sole non-blocking advisory: `maskable-icon: 0` — no
  `purpose: "maskable"` icon declared; Chrome installs fine without it (the
  regular 192/512 icons are used). Lighthouse 12/13 removed the PWA audits
  entirely, so v11 was used. Manual installability criteria were also met
  independently: valid manifest, active SW with a working fetch handler
  (proven by offline cache serving), icons served, secure context
  (localhost).

### Environment note (not a code issue)

Local `next start` trips the AUTH-007 instrumentation gate because
`.env.local` ships Cloudflare's always-pass Turnstile **test** key (fine in
dev, rejected in production by design). The production server for this
verification was therefore started with placeholder non-test Turnstile env
values (gate still enforced — it correctly rejected the test key first);
auth was not under test, no repo files were changed, and nothing was
deployed.

## Notes / tradeoffs

- Offline reload shows the offline fallback (not a cached HTML shell):
  navigations are deliberately network-first because pages carry per-user
  data. The cached `static-assets-v1` JS/CSS still serve the app shell on any
  page that does render, and the fallback is the documented offline
  experience.
- `maskable-icon` (Lighthouse advisory) is a possible follow-up: a purpose
  `maskable` icon variant would close the only PWA-category finding.
- The `/_vercel/*` console errors seen locally are environmental (Vercel-only
  endpoints) and unrelated to this feature.

Spec: [docs/superpowers/specs/2026-08-29-pwa-installable-design.md](../superpowers/specs/2026-08-29-pwa-installable-design.md) ·
Plan: [docs/superpowers/plans/2026-08-29-pwa-installable.md](../superpowers/plans/2026-08-29-pwa-installable.md)