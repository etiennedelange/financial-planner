# PWA Installable + Offline Assets — Design

Date: 2026-08-29
Status: Approved
Branch: `feat/pwa-installable`

## Context

The app is a Next.js 16.3 App Router app (Turbopack, React Compiler, Tailwind v4),
fully dynamic server-rendering (`instant = false`, per-request CSP nonce in
`lib/supabase/proxy.ts`), Supabase auth with MFA, deployed on Vercel. There is
currently zero PWA code: no manifest, no service worker, no install metadata.

Goal: make the site installable as a PWA with offline caching of static assets.
Decisions made during brainstorming:

- **Scope:** installable + offline assets (not full page offline)
- **Install UX:** native browser install prompts only — no custom install button
  (the Next.js 16 PWA guide explicitly recommends against `beforeinstallprompt`
  buttons: "not cross browser and platform — does not work on Safari iOS")
- **SW approach:** hand-written service worker (zero new dependencies), not
  Serwist — the app's pages are dynamic SSR + auth-gated and must never be
  precached, so the only offline win is immutable static assets, which a
  runtime cache-first strategy gets for free

## Architecture

### 1. Web app manifest — `app/manifest.ts`

`MetadataRoute.Manifest` per the Next 16 manifest file convention
(`app/manifest.ts` serves at `/manifest.webmanifest`):

- `name: "SA Retirement Calculator"`, `short_name: "Retirement Calc"`,
  description from existing layout metadata
- `start_url: "/calculator"` — `app/page.tsx` redirects there anyway; starting
  directly avoids a redirect hop on cold start (critical offline)
- `display: "standalone"`
- `theme_color` and `background_color` derived from design tokens:
  - `theme_color`: teal primary `hsl(162 70% 30%)` ≈ `#176282`
  - `background_color`: page background from `globals.css` (`--background`)
- `icons`: 192×192 + 512×512 PNGs referencing the generated icon routes below,
  each with explicit `sizes` and `type: "image/png"`

### 2. Icons — generated routes, no binary files

Extract the existing favicon artwork from `app/icon.tsx` (bar chart + trend
line) into a shared module `lib/pwa/icon-artwork.tsx` so all sizes render the
same design without duplication:

- `app/icon.tsx` — unchanged favicon (32×32)
- `app/icon1.tsx` — 192×192, served at `/icon1`
- `app/icon2.tsx` — 512×512, served at `/icon2`
- `app/apple-icon.tsx` — 180×180, served at `/apple-icon` (required for iOS
  home screen; Next auto-injects `<link rel="apple-touch-icon">`)
- Artwork is NOT maskable-safe (bars are, trend-line endpoints aren't) —
  declaring maskable is a known follow-up (move polyline endpoints inward
  first) (per the app-icons file convention — numbered `icon1.tsx`,
  `icon2.tsx` files, `size` + `contentType` exports)

**Fallback (only if an installer rejects extensionless URLs):** generate static
PNGs once and commit them to `public/`. Verified via Lighthouse during
implementation.

### 3. Layout metadata — `app/layout.tsx`

- `viewport.themeColor`: light + dark variants matching the theme
  (`{ light: "#…", dark: "#…" }` — exact hex from tokens at implementation)
- `metadata.appleWebApp: { capable: true, title, statusBarStyle: "default" }`

### 4. Service worker — `public/sw.js` (hand-written, classic script)

Single `ASSET_CACHE` version constant. Three strategies:

| Request | Strategy | Why |
|---|---|---|
| Same-origin GET `/_next/static/*` (JS/CSS/fonts) | **Cache-first** | Hashed URLs are immutable; this is the offline win |
| Navigation requests (`mode: "navigate"`) | **Network-first**, fallback to inline offline page | Pages are dynamic SSR — never cached (per-user data) |
| Everything else (`/api/*`, `/supabase/*`, cross-origin) | **Network only, never cached** | Auth'd endpoints — caching would leak user data |

Lifecycle:

- `install`: `skipWaiting()` so updates activate on next load
- `activate`: delete stale `ASSET_CACHE` versions, `clients.claim()`
- Offline fallback: small inline branded HTML string returned when a
  navigation fetch fails — no network assets, no auth leak

### 5. Registration + config

- `components/pwa/service-worker-register.tsx` — client component:
  - registers `/sw.js` with `scope: "/"`, `updateViaCache: "none"`
  - only when `process.env.NODE_ENV === "production"` and
    `"serviceWorker" in navigator` (dev stays SW-free to avoid stale-cache
    confusion during development)
  - mounted once in root layout
- `next.config.js` — `headers()` for `/sw.js`:
  `Cache-Control: no-cache, no-store, must-revalidate` +
  `Content-Type: application/javascript; charset=utf-8` (per the Next 16 PWA
  guide's security section, so the SW is never stuck on a stale copy)
- **No CSP changes** — the SW is a same-origin classic script; the middleware
  CSP does not govern service worker registration. Confirm during verification.

## Error handling

- SW fetch failures never throw into the page: navigation falls back to the
  inline offline page; asset misses fall back to network; API calls fail
  naturally (same as today, no caching layer involved)
- SW registration failures are silently ignored (feature degradation, no
  console noise beyond browser defaults)

## Testing

- Unit tests (Vitest, happy-dom):
  - `app/manifest.test.ts` — required fields present: `display: "standalone"`,
    `start_url`, `name`, icons with correct sizes/types
  - register component test — mocks `navigator.serviceWorker`, asserts
    registration call + args, and that it does nothing in dev
- `npm run build`, `npm run typecheck`, `npm run lint`, `npm run test`,
  `npm run shadscan:gate`
- Browser verification (chrome-devtools on the production build):
  - Lighthouse audit: installability passes
  - DevTools offline toggle: app loads from cache, offline fallback renders on
    navigation, no console errors
- Docs per CLAUDE.md: history file in `docs/history/` + phase doc update

## Risks / mitigations

| Risk | Mitigation |
|---|---|
| Installer rejects extensionless `/icon1` manifest URLs | Verified in Lighthouse; fallback = commit static PNGs to `public/` |
| SW caches stale assets after deploy | Versioned cache name + activate cleanup; `updateViaCache: "none"` |
| Caching auth'd responses | Explicit whitelist: only `/_next/static/*` and navigations; everything else network-only |
| Dev mode confusion | SW registered only in production builds |