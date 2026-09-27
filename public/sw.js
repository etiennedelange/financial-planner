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
  // Any cache failure (e.g. quota exceeded on put) falls back to the
  // network — a cache hiccup must never fail an otherwise-fetchable asset.
  if (sameOrigin && request.method === "GET" && url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        try {
          const cache = await caches.open(ASSET_CACHE)
          const cached = await cache.match(request)
          if (cached) return cached
          const response = await fetch(request)
          if (response.ok) cache.put(request, response.clone())
          return response
        } catch {
          return fetch(request)
        }
      })()
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
<title>Offline — SA Financial Planner</title>
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
