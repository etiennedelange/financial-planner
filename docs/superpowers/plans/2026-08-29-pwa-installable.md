# PWA Installable + Offline Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the SA Retirement Calculator installable as a PWA (manifest, icons, iOS metadata) with a hand-written service worker that caches immutable static assets and serves an offline fallback — no new dependencies.

**Architecture:** `app/manifest.ts` (Next 16 metadata route) + generated icon routes reusing a shared artwork component; `public/sw.js` classic script with three strategies (cache-first `/_next/static/*`, network-first navigations with inline offline fallback, network-only for everything else incl. auth'd APIs); a small client component registers `/sw.js` only in production builds. `/sw.js` gets no-store headers from `next.config.js`. Native browser install prompts only — no custom install UI (per Next 16 PWA guide).

**Tech Stack:** Next.js 16.3 (App Router, Turbopack), TypeScript, Vitest + happy-dom, React 19, Tailwind v4.

## Global Constraints

- Working branch: `feat/pwa-installable` (already created). All commits land here.
- Brand colors (from `app/globals.css` tokens): light primary teal `#178262`, light background `#faf9fb`, dark primary teal `#3cddac`, dark background `#0a0713`.
- Manifest values: `name: "SA Retirement Calculator"`, `short_name: "Retirement Calc"`, `start_url: "/calculator"`, `display: "standalone"`, `theme_color: "#178262"`, `background_color: "#faf9fb"`.
- Service worker must NEVER cache: navigations (dynamic SSR, per-user data), `/api/*`, `/supabase/*`, cross-origin requests.
- SW registered only when `process.env.NODE_ENV === "production"` (dev/preview iteration must not be trapped by a stale worker).
- No new runtime or dev dependencies. Do not add `@testing-library/react` — repo tests use `react-dom/client` `createRoot` + `act` (see `components/ui/rolling-value.test.tsx`).
- Test files colocated next to source (`manifest.ts` → `manifest.test.ts`).
- Every task ends with commit; commits after meaningful change per CLAUDE.md must be accompanied by docs (docs are written in Task 5; commit messages reference the feature).
- Run `npm run typecheck && npm run lint && npm run test` after every task (build + shadscan in Task 5).

---

### Task 1: Web app manifest + tests

**Files:**
- Create: `app/manifest.ts`
- Test: `app/manifest.test.ts`

**Interfaces:**
- Produces: `export default function manifest(): MetadataRoute.Manifest` — consumed by Next at `/manifest.webmanifest`; later tasks reference its icons (served by Task 2's routes).

- [ ] **Step 1: Write the failing test**

Create `app/manifest.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import manifest from "./manifest"

describe("manifest", () => {
  it("is installable: standalone display with a start URL", () => {
    const m = manifest()
    expect(m.display).toBe("standalone")
    expect(m.start_url).toBe("/calculator")
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
  })

  it("declares 192 and 512 PNG icons", () => {
    const icons = manifest().icons ?? []
    expect(icons).toContainEqual({ src: "/icon1", sizes: "192x192", type: "image/png" })
    expect(icons).toContainEqual({ src: "/icon2", sizes: "512x512", type: "image/png" })
  })

  it("uses the brand teal and light background colors", () => {
    const m = manifest()
    expect(m.theme_color).toBe("#178262")
    expect(m.background_color).toBe("#faf9fb")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run app/manifest.test.ts`
Expected: FAIL — cannot resolve `./manifest`.

- [ ] **Step 3: Create `app/manifest.ts`**

```ts
import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SA Retirement Calculator",
    short_name: "Retirement Calc",
    description: "South African retirement planning with Monte Carlo simulations",
    start_url: "/calculator",
    display: "standalone",
    background_color: "#faf9fb",
    theme_color: "#178262",
    icons: [
      { src: "/icon1", sizes: "192x192", type: "image/png" },
      { src: "/icon2", sizes: "512x512", type: "image/png" },
    ],
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run app/manifest.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add app/manifest.ts app/manifest.test.ts
git commit -m "feat(pwa): add web app manifest with install metadata"
```

---

### Task 2: Shared icon artwork + sized icon routes

**Files:**
- Create: `lib/pwa/icon-artwork.tsx`
- Modify: `app/icon.tsx` (refactor to use shared artwork)
- Create: `app/icon1.tsx` (192×192), `app/icon2.tsx` (512×512), `app/apple-icon.tsx` (180×180)

**Interfaces:**
- Consumes: nothing (Task 1's manifest references the `/icon1`, `/icon2` URLs this task creates).
- Produces: `export function PwaIconArtwork({ rounded = false }: { rounded?: boolean })` — a full-size square div, absolute-positioned children in % coordinates so it scales 32→512px. Served at `/icon1`, `/icon2`, `/apple-icon`.

- [ ] **Step 1: Create the shared artwork component**

Create `lib/pwa/icon-artwork.tsx` (port of the existing `app/icon.tsx` design — teal-free blue `#3b82f6` background, white bars + trend polyline — converted from px to % coordinates):

```tsx
const BARS = [
  { left: 9.4, height: 25 },
  { left: 28.1, height: 37.5 },
  { left: 46.9, height: 28.1 },
  { left: 65.6, height: 50 },
]

export function PwaIconArtwork({ rounded = false }: { rounded?: boolean }) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        borderRadius: rounded ? 8 : 0,
        background: "#3b82f6",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "12.5%",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      {BARS.map(({ left, height }) => (
        <div
          key={left}
          style={{
            position: "absolute",
            left: `${left}%`,
            bottom: "12.5%",
            width: "12.5%",
            height: `${height}%`,
            borderRadius: "3%",
            background: "rgba(255,255,255,0.35)",
          }}
        />
      ))}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 32 32"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <polyline
          points="3,22 9,16 15,18 21,10 27,5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="27" cy="5" r="2" fill="white" />
      </svg>
    </div>
  )
}
```

Note: no rounded corners at install sizes — installers apply their own mask; `rounded` stays only for the 32px favicon. Bars span left 9.4%→78% — within the central ~80% maskable safe zone.

- [ ] **Step 2: Refactor `app/icon.tsx` to use the artwork**

Replace the entire contents of `app/icon.tsx`:

```tsx
import { ImageResponse } from "next/og"
import { PwaIconArtwork } from "@/lib/pwa/icon-artwork"

export const size = { width: 32, height: 32 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<PwaIconArtwork rounded />, { ...size })
}
```

- [ ] **Step 3: Create the three sized icon routes**

`app/icon1.tsx`:

```tsx
import { ImageResponse } from "next/og"
import { PwaIconArtwork } from "@/lib/pwa/icon-artwork"

export const size = { width: 192, height: 192 }
export const contentType = "image/png"

export default function Icon() {
  return new ImageResponse(<PwaIconArtwork />, { ...size })
}
```

`app/icon2.tsx` — identical except `size = { width: 512, height: 512 }`.

`app/apple-icon.tsx` — identical except `size = { width: 180, height: 180 }`.

- [ ] **Step 4: Verify build + icon routes render**

Run: `npm run build && npm run start` (background), then:

```bash
curl -sI http://localhost:3000/icon1 | grep -i "content-type"
curl -sI http://localhost:3000/icon2 | grep -i "content-type"
curl -sI http://localhost:3000/apple-icon | grep -i "content-type"
curl -sI http://localhost:3000/manifest.webmanifest | grep -i "content-type"
```

Expected: `image/png` for the three icons, `application/manifest+json` for the manifest. Kill the server afterwards. If the build fails for missing env vars (Supabase), verify with `npm run dev` instead and confirm the routes still render PNG (dev renders them too) — icon route shape is env-independent.

- [ ] **Step 5: Commit**

```bash
git add lib/pwa/icon-artwork.tsx app/icon.tsx app/icon1.tsx app/icon2.tsx app/apple-icon.tsx
git commit -m "feat(pwa): generate 192/512 and apple-touch icons from shared artwork"
```

---

### Task 3: Service worker + no-store headers

**Files:**
- Create: `public/sw.js`
- Create: `public/sw.test.ts`
- Modify: `next.config.js`

**Interfaces:**
- Produces: `/sw.js` classic script (registered by Task 4). Cache name `"static-assets-v1"`; only `/_next/static/*` GET requests are cached; navigations fall back to an inline HTML offline page.

- [ ] **Step 1: Write the failing test**

Create `public/sw.test.ts` (content-level regression guards for the two invariants that matter):

```ts
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sw = readFileSync(new URL("./sw.js", import.meta.url), "utf-8")

describe("public/sw.js", () => {
  it("caches only immutable static assets", () => {
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")')
    expect(sw).toContain('ASSET_CACHE = "static-assets-v1"')
  })

  it("never caches navigations — network first with an offline fallback", () => {
    expect(sw).toContain('request.mode === "navigate"')
    expect(sw).toContain("offlineResponse()")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run public/sw.test.ts`
Expected: FAIL — cannot read `./sw.js` (file missing).

- [ ] **Step 3: Create `public/sw.js`**

```js
const ASSET_CACHE = "static-assets-v1"

self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== ASSET_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)
  const sameOrigin = url.origin === self.location.origin

  // Navigations: always network-first. Pages are dynamic SSR with per-user
  // data — never cached. Offline, serve the inline fallback page.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => offlineResponse()))
    return
  }

  // Immutable build assets (hashed JS/CSS/fonts): cache-first. Everything
  // else (API, auth, cross-origin) stays network-only — never cached.
  if (sameOrigin && request.method === "GET" && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })
    )
  }
})

function offlineResponse() {
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline — SA Retirement Calculator</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf9fb; color: #17242d; display: grid; place-items: center; min-height: 100vh; margin: 0; }
  .card { text-align: center; padding: 2rem; }
  h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
  p { color: #5b6470; margin: 0; }
</style>
</head>
<body>
  <div class="card">
    <h1>You're offline</h1>
    <p>Reconnect to continue planning your retirement.</p>
  </div>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  )
}
```

- [ ] **Step 4: Add `/sw.js` response headers in `next.config.js`**

Add to the `nextConfig` object (next to `images`):

```js
  // PWA: the service worker must never be served from a browser/CDN cache —
  // stale workers trap users on old caches. Per the Next.js PWA guide.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ]
  },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run public/sw.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add public/sw.js public/sw.test.ts next.config.js
git commit -m "feat(pwa): add offline-capable service worker with no-store headers"
```

---

### Task 4: Registration component + layout metadata

**Files:**
- Create: `components/pwa/service-worker-register.tsx`
- Create: `components/pwa/service-worker-register.test.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `/sw.js` from Task 3.
- Produces: `export function ServiceWorkerRegister()` — client component returning `null`; registers the SW in production only. Mounted in root layout.

- [ ] **Step 1: Write the failing test**

Create `components/pwa/service-worker-register.test.tsx` (repo pattern: `react-dom/client` `createRoot` + `act`, no testing-library):

```tsx
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ServiceWorkerRegister } from "./service-worker-register"

function render(node: React.ReactNode) {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  return { container, root }
}

describe("ServiceWorkerRegister", () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    const r = render(null)
    container = r.container
    root = r.root
  })

  afterEach(() => {
    root.unmount()
    container.remove()
    vi.unstubAllEnvs()
    delete (navigator as unknown as { serviceWorker?: unknown }).serviceWorker
  })

  it("registers /sw.js in production when service workers are supported", async () => {
    vi.stubEnv("NODE_ENV", "production")
    const register = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(register).toHaveBeenCalledWith("/sw.js", { scope: "/", updateViaCache: "none" })
  })

  it("does not register outside production builds", async () => {
    vi.stubEnv("NODE_ENV", "development")
    const register = vi.fn()
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register },
      configurable: true,
    })

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(register).not.toHaveBeenCalled()
  })

  it("does not register when service workers are unsupported", async () => {
    vi.stubEnv("NODE_ENV", "production")

    await act(async () => {
      root.render(<ServiceWorkerRegister />)
    })

    expect(container.textContent).toBe("")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/pwa/service-worker-register.test.tsx`
Expected: FAIL — cannot resolve `./service-worker-register`.

- [ ] **Step 3: Create the component**

Create `components/pwa/service-worker-register.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
  useEffect(() => {
    // Dev builds must stay SW-free — a stale worker would serve old assets
    // (and an old offline fallback) while iterating. Production (incl. Vercel
    // previews) registers with updateViaCache: "none" so the browser always
    // revalidates the worker script against the no-store response.
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Feature degradation only — never break the app on SW failure.
    })
  }, [])

  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/pwa/service-worker-register.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Mount in layout + add install metadata**

In `app/layout.tsx`:

1. Import the component: `import { ServiceWorkerRegister } from "@/components/pwa/service-worker-register"` (alphabetical position: after `ThemeShortcut` import, before `Toaster`).
2. Add `themeColor` to the existing `viewport` export:

```tsx
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#178262" },
    { media: "(prefers-color-scheme: dark)", color: "#3cddac" },
  ],
}
```

3. Add `appleWebApp` to the existing `metadata` export:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "SA Retirement Calculator",
  description: "South African retirement planning with Monte Carlo simulations",
  appleWebApp: {
    capable: true,
    title: "SA Retirement Calculator",
    statusBarStyle: "default",
  },
}
```

4. Render the component inside the body, next to the other shell affordances:

```tsx
          <ThemeShortcut />
          <CommandPalette />
          <ServiceWorkerRegister />
          <Toaster />
```

- [ ] **Step 6: Verify**

Run: `npm run typecheck && npm run lint && npm run test`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add components/pwa/service-worker-register.tsx components/pwa/service-worker-register.test.tsx app/layout.tsx
git commit -m "feat(pwa): register service worker in production and add install metadata"
```

---

### Task 5: Full verification + docs

**Files:**
- Create: `docs/history/2026-08-29-pwa-installable.md`
- Modify: `docs/project-phases/phase-9-site-improvement.md`
- Modify: `docs/project-phases.md`

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Full test + build gate**

Run: `npm run test && npm run typecheck && npm run lint && npm run build && npm run shadscan:gate`
Expected: all green (shadscan ≥90/100; the known `mobile-nav-present` waiver may still be the only finding).

- [ ] **Step 2: Browser verification (production build)**

Run `npm run start` (build from Step 1), then in a browser:

1. Open `http://localhost:3000/calculator`.
2. Verify `<link rel="manifest">` points at a working `/manifest.webmanifest` and the manifest JSON contains `display: standalone` + both icons.
3. Verify `<link rel="apple-touch-icon">` resolves (200, image/png).
4. Chrome DevTools → Application: confirm the service worker registered and is active; reload once so `/_next/static/*` chunks populate the `static-assets-v1` cache.
5. DevTools → Network → Offline → reload: the page must render from the cached assets (offline fallback HTML only when navigating to a URL whose HTML isn't cached — a fresh reload of `/calculator` may show the fallback, which is by design; the key checks are: no console errors, cached JS/CSS served, fallback page renders when expected).
6. Re-enable network; verify normal function returns.
7. Lighthouse audit (Application/Installable category): no installability blockers (manifest + icons + SW present).

Also confirm the middleware CSP does not block SW registration (no CSP errors in console for `/sw.js`).

- [ ] **Step 3: Docs — history file**

Create `docs/history/2026-08-29-pwa-installable.md` following the repo's history-file format (see `docs/history/2026-08-16-command-palette-restyle.md` as the shape reference): what changed, why, verification (tests count, build/typecheck/lint/shadscan results, browser checks), spec + plan links.

- [ ] **Step 4: Docs — phase updates**

1. `docs/project-phases/phase-9-site-improvement.md` — add a completed checklist entry for PWA installability linking the history file (check the file's existing structure first and match it).
2. `docs/project-phases.md` — add one Recent Activity entry (date + one-liner + history link) at the top of the list; drop the oldest entry if the list exceeds 10.

- [ ] **Step 5: Commit**

```bash
git add docs/history/2026-08-29-pwa-installable.md docs/project-phases/phase-9-site-improvement.md docs/project-phases.md
git commit -m "docs(pwa): record PWA installable implementation"
```

---

## Self-Review Notes

- **Spec coverage:** manifest (T1), icons + apple-icon (T2), SW with the three strategies + offline fallback + no-store headers (T3), registration + themeColor + appleWebApp (T4), testing/docs (T5). No spec section is left without a task.
- **Placeholders:** every step carries concrete code or commands; no TBD/TODO.
- **Type consistency:** `PwaIconArtwork({ rounded })`, `ServiceWorkerRegister()`, `manifest()` names match across tasks; `/icon1`, `/icon2`, `/apple-icon` URLs consistent between manifest (T1) and routes (T2).