"use client"

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (t: string) => void }) => string
      remove: (id: string) => void
      reset: (id: string) => void
    }
  }
}

export interface TurnstileHandle {
  /** Discards the spent token and issues a fresh challenge. */
  reset: () => void
}

/**
 * Renders the Turnstile widget and hands the resulting token to the caller,
 * which passes it to Supabase as options.captchaToken.
 *
 * Tokens are single-use — Cloudflare's siteverify rejects a replay — so a caller
 * whose request failed must reset() before the user can retry, or every retry
 * resubmits a spent token and fails on the captcha instead of the real reason.
 * This is invisible against Cloudflare's always-pass test secret, which accepts
 * replays unconditionally.
 *
 * Renders nothing when no site key is configured, so local development without
 * Turnstile keys still works. In production this same silent no-op would leave
 * every auth form permanently blocked on a captchaToken that can never arrive —
 * `instrumentation.ts` fails startup instead of letting that ship silently.
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (token: string) => void }>(
function Turnstile({ onToken }, handleRef) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useImperativeHandle(handleRef, () => ({
    reset: () => {
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
    },
  }), [])

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
})
