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
