import { describe, it, expect } from "vite-plus/test"
import { buildCsp, SECURITY_HEADERS } from "./headers"

function directive(csp: string, name: string): string {
  const found = csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
  if (!found) throw new Error(`No ${name} directive in CSP`)
  return found
}

const DEV = { allowEval: true, upgradeInsecureRequests: false }
const PROD = { allowEval: false, upgradeInsecureRequests: true }

describe("buildCsp", () => {
  it("binds script-src to the request nonce", () => {
    expect(directive(buildCsp("abc123", PROD), "script-src")).toContain("'nonce-abc123'")
  })

  it("lets same-origin workers load, since strict-dynamic would otherwise block the Monte Carlo worker", () => {
    const csp = buildCsp("n", PROD)
    expect(directive(csp, "script-src")).toContain("'strict-dynamic'")
    expect(directive(csp, "worker-src")).toContain("'self'")
  })

  describe("connect-src — the exfiltration guard", () => {
    it("allows this site only: the app makes no outbound requests", () => {
      for (const options of [DEV, PROD]) {
        expect(directive(buildCsp("n", options), "connect-src")).toBe("connect-src 'self'")
      }
    })

    it("has no AI provider, telemetry, account-system or CDN origin", () => {
      const csp = buildCsp("n", PROD)
      for (const banned of [
        "anthropic",
        "openai",
        "googleapis",
        "huggingface",
        "supabase",
        "cloudflare",
        "vercel",
      ]) {
        expect(csp).not.toContain(banned)
      }
    })
  })

  it("allows no third-party script origins", () => {
    const scripts = directive(buildCsp("n", PROD), "script-src")
    expect(scripts).not.toMatch(/https?:\/\//)
  })

  it("blocks all framing — nothing embeds, and nothing may be embedded", () => {
    const csp = buildCsp("n", PROD)
    expect(directive(csp, "frame-src")).toBe("frame-src 'none'")
    expect(directive(csp, "frame-ancestors")).toContain("'none'")
  })

  it("restricts form submission, base-uri and plugins", () => {
    const csp = buildCsp("n", PROD)
    expect(directive(csp, "form-action")).toContain("'self'")
    expect(directive(csp, "base-uri")).toContain("'self'")
    expect(directive(csp, "object-src")).toContain("'none'")
  })

  it("does not permit unsafe-eval in production", () => {
    expect(buildCsp("n", PROD)).not.toContain("'unsafe-eval'")
  })

  it("permits unsafe-eval in development for React refresh", () => {
    expect(directive(buildCsp("n", DEV), "script-src")).toContain("'unsafe-eval'")
  })

  it("does not force an https upgrade in development, where the dev server is plain http", () => {
    expect(buildCsp("n", DEV)).not.toContain("upgrade-insecure-requests")
  })

  it("upgrades insecure requests in production", () => {
    expect(buildCsp("n", PROD)).toContain("upgrade-insecure-requests")
  })

  it("a production build served over plain http gets neither eval nor an https upgrade", () => {
    const csp = buildCsp("n", { allowEval: false, upgradeInsecureRequests: false })
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).not.toContain("upgrade-insecure-requests")
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
