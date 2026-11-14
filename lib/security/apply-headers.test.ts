import { NextRequest } from "next/server"
import { afterEach, describe, expect, it, vi } from "vite-plus/test"
import { withSecurityHeaders } from "./apply-headers"

const csp = (url: string) =>
  withSecurityHeaders(new NextRequest(url)).headers.get("Content-Security-Policy") ?? ""

describe("withSecurityHeaders", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("production over HTTPS: upgrades insecure requests, no eval", () => {
    vi.stubEnv("NODE_ENV", "production")
    const policy = csp("https://planner.example/calculator")
    expect(policy).toContain("upgrade-insecure-requests")
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it("production served over plain HTTP (next start locally): neither upgrade nor eval", () => {
    vi.stubEnv("NODE_ENV", "production")
    const policy = csp("http://localhost:3000/calculator")
    expect(policy).not.toContain("upgrade-insecure-requests")
    expect(policy).not.toContain("'unsafe-eval'")
  })

  it("development: eval for React refresh, no upgrade, even over HTTPS", () => {
    vi.stubEnv("NODE_ENV", "development")
    const policy = csp("https://planner.example/calculator")
    expect(policy).toContain("'unsafe-eval'")
    expect(policy).not.toContain("upgrade-insecure-requests")
  })

  it("mints a fresh nonce per request and threads it into the policy", () => {
    const a = csp("https://planner.example/")
    const b = csp("https://planner.example/")
    const nonce = /'nonce-([0-9a-f]+)'/.exec(a)?.[1]
    expect(nonce).toBeTruthy()
    expect(b).not.toContain(`'nonce-${nonce}'`)
  })
})
