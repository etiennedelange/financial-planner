import { describe, it, expect } from "vite-plus/test"
import { PROVIDER_ORIGINS } from "@/lib/ai/providers/origins"
import { buildCsp, SECURITY_HEADERS } from "./headers"

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
  if (!found) throw new Error(`No ${name} directive in CSP`)
  return found
}

describe("buildCsp", () => {
  it("binds script-src to the request nonce", () => {
    expect(directive(buildCsp("abc123", false), "script-src")).toContain("'nonce-abc123'")
  })

  it("lets same-origin workers load, since strict-dynamic would otherwise block the Monte Carlo worker", () => {
    const csp = buildCsp("n", false)
    expect(directive(csp, "script-src")).toContain("'strict-dynamic'")
    expect(directive(csp, "worker-src")).toContain("'self'")
  })

  describe("connect-src — the exfiltration guard for the user's API key", () => {
    it("allows exactly self and the three LLM providers — nothing else", () => {
      const sources = directive(buildCsp("n", false), "connect-src").split(" ").slice(1)
      expect([...sources].sort()).toEqual(
        [
          "'self'",
          "https://api.anthropic.com",
          "https://api.openai.com",
          "https://generativelanguage.googleapis.com",
        ].sort(),
      )
    })

    it("never uses a wildcard or a bare scheme", () => {
      for (const isDev of [true, false]) {
        const connect = directive(buildCsp("n", isDev), "connect-src")
        expect(connect).not.toMatch(/\*/)
        expect(connect).not.toMatch(/(^|\s)https?:(\s|$)/)
      }
    })

    it("has no origin left over from the removed account system", () => {
      const csp = buildCsp("n", false)
      expect(csp).not.toContain("supabase")
      expect(csp).not.toContain("cloudflare")
      expect(csp).not.toContain("vercel")
    })

    it("derives every provider origin from the shared PROVIDER_ORIGINS list", () => {
      const connect = directive(buildCsp("n", false), "connect-src")
      for (const origin of Object.values(PROVIDER_ORIGINS)) expect(connect).toContain(origin)
    })
  })

  it("allows no third-party script origins", () => {
    const scripts = directive(buildCsp("n", false), "script-src")
    expect(scripts).not.toMatch(/https?:\/\//)
  })

  it("blocks all framing — nothing embeds, and nothing may be embedded", () => {
    const csp = buildCsp("n", false)
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'")
    expect(directive(csp, "frame-ancestors")).toContain("'none'")
  })

  it("restricts form submission, base-uri and plugins", () => {
    const csp = buildCsp("n", false)
    expect(directive(csp, "form-action")).toContain("'self'")
    expect(directive(csp, "base-uri")).toContain("'self'")
    expect(directive(csp, "object-src")).toContain("'none'")
  })

  it("does not permit unsafe-eval in production", () => {
    expect(buildCsp("n", false)).not.toContain("'unsafe-eval'")
  })

  it("permits unsafe-eval in development for React refresh", () => {
    expect(directive(buildCsp("n", true), "script-src")).toContain("'unsafe-eval'")
  })

  it("does not force an https upgrade in development, where the dev server is plain http", () => {
    expect(buildCsp("n", true)).not.toContain("upgrade-insecure-requests")
  })

  it("upgrades insecure requests in production", () => {
    expect(buildCsp("n", false)).toContain("upgrade-insecure-requests")
  })
})

describe("SECURITY_HEADERS", () => {
  it("denies framing", () => {
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY")
  })

  it("sets a two-year HSTS max-age including subdomains", () => {
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("max-age=63072000")
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toContain("includeSubDomains")
  })

  it("blocks MIME sniffing", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff")
  })

  it("does not leak full URLs cross-origin", () => {
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin")
  })
})
