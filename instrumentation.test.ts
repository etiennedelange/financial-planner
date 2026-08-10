import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { register } from "./instrumentation"

const ORIGINAL_ENV = { ...process.env }

describe("instrumentation register (AUTH-007)", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, NODE_ENV: "production" }
    process.env.NEXT_RUNTIME = "nodejs"
  })

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV }
  })

  it("does nothing outside production", () => {
    process.env = { ...process.env, NODE_ENV: "development" }
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    expect(() => register()).not.toThrow()
  })

  it("does nothing outside the nodejs runtime (e.g. edge)", () => {
    process.env.NEXT_RUNTIME = "edge"
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    expect(() => register()).not.toThrow()
  })

  it("throws in production when the site key is missing", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    process.env.TURNSTILE_SECRET_KEY = "real-secret"
    expect(() => register()).toThrow(/NEXT_PUBLIC_TURNSTILE_SITE_KEY/)
  })

  it("throws in production when the secret key is missing", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "real-site-key"
    delete process.env.TURNSTILE_SECRET_KEY
    expect(() => register()).toThrow(/TURNSTILE_SECRET_KEY/)
  })

  it("throws in production when the published always-pass test key is used", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "1x00000000000000000000AA"
    process.env.TURNSTILE_SECRET_KEY = "real-secret"
    expect(() => register()).toThrow(/test key/)
  })

  it("does not throw with real-looking production keys", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAAAAAAprodkey"
    process.env.TURNSTILE_SECRET_KEY = "0x4AAAAAAAprodsecret"
    expect(() => register()).not.toThrow()
  })
})
