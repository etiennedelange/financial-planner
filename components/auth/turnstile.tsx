"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string
      remove: (id: string) => void
    }
  }
}

/**
 * Renders the Turnstile widget and hands the resulting token to the caller,
 * which passes it to Supabase as options.captchaToken.
 *
 * Renders nothing when no site key is configured, so local development without
 * Turnstile keys still works.
 */
export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !ref.current) return

    function render() {
      if (!window.turnstile || !ref.current || widgetId.current) return
      widgetId.current = window.turnstile.render(ref.current, { sitekey: siteKey!, callback: onToken })
    }

    if (window.turnstile) {
      render()
    } else {
      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.onload = render
      document.head.appendChild(script)
    }

    return () => {
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current)
      widgetId.current = null
    }
  }, [siteKey, onToken])

  if (!siteKey) return null
  return <div ref={ref} className="flex justify-center" />
}
