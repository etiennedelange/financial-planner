import { describe, it, expect, afterEach } from "vitest"
import { resolveSiteUrl } from "./site-url"

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe("resolveSiteUrl", () => {
  it("prefers NEXT_PUBLIC_SITE_URL over the Vercel URL", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com"
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "my-app.vercel.app"
    expect(resolveSiteUrl()).toBe("https://example.com")
  })

  it("normalises a protocol-less Vercel project URL to https", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "sa-financial-planner.vercel.app"
    expect(resolveSiteUrl()).toBe("https://sa-financial-planner.vercel.app")
  })

  it("keeps a Vercel URL that already has a scheme", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "https://www.example.com"
    expect(resolveSiteUrl()).toBe("https://www.example.com")
  })

  it("falls back to localhost when neither env var is set", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL
    expect(resolveSiteUrl()).toBe("http://localhost:3000")
  })

  it("always returns a value new URL() accepts", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "sa-financial-planner.vercel.app"
    expect(() => new URL(resolveSiteUrl())).not.toThrow()
  })
})
