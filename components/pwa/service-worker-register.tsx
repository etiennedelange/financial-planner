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
    // An UPDATE (a worker already controlled this page) takes over via skipWaiting + claim.
    // Anything the old worker served before then (e.g. a stale calculation worker script)
    // is not re-fetched, so reload once to run on the new worker's assets. A first install
    // (no previous controller) needs no reload. Bounded: the reloaded page starts with the
    // new controller, so no further controllerchange fires.
    const hadController = Boolean(navigator.serviceWorker.controller)
    let reloading = false
    const onControllerChange = () => {
      if (!hadController || reloading) return
      reloading = true
      window.location.reload()
    }
    navigator.serviceWorker.addEventListener?.("controllerchange", onControllerChange)
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Feature degradation only — never break the app on SW failure.
    })
    return () =>
      navigator.serviceWorker.removeEventListener?.("controllerchange", onControllerChange)
  }, [])

  return null
}
