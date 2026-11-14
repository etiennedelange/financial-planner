import { describe, it, expect } from "vite-plus/test"
import {
  SHARED_CLIENT_BUCKET,
  clientRateLimitId,
  isCloudflareWorkersRuntime,
  trustedClientIpHeader,
} from "./client-ip"

const h = (entries: Record<string, string>) => new Headers(entries)

describe("trustedClientIpHeader", () => {
  it("trusts x-real-ip on Vercel", () => {
    expect(trustedClientIpHeader({ VERCEL: "1" }, false)).toBe("x-real-ip")
  })

  it("trusts cf-connecting-ip only inside the Cloudflare Workers runtime", () => {
    expect(trustedClientIpHeader({}, true)).toBe("cf-connecting-ip")
    expect(trustedClientIpHeader({}, false)).toBeNull()
  })

  it("lets the operator name the header, which wins over platform detection", () => {
    expect(trustedClientIpHeader({ TRUSTED_CLIENT_IP_HEADER: " CF-Connecting-IP " }, false)).toBe(
      "cf-connecting-ip",
    )
    expect(
      trustedClientIpHeader({ TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for", VERCEL: "1" }, true),
    ).toBe("x-forwarded-for")
  })

  it("rejects a malformed configured header instead of guessing", () => {
    expect(trustedClientIpHeader({ TRUSTED_CLIENT_IP_HEADER: "x real ip" }, true)).toBeNull()
  })

  it("trusts nothing on an unknown host", () => {
    expect(trustedClientIpHeader({}, false)).toBeNull()
  })
})

describe("clientRateLimitId", () => {
  it("regression: off Vercel and Cloudflare, a client-sent cf-connecting-ip is ignored", () => {
    // Before, any caller could send a fresh cf-connecting-ip per request and get a fresh quota.
    const a = clientRateLimitId(h({ "cf-connecting-ip": "6.6.6.6" }), {}, false)
    const b = clientRateLimitId(h({ "cf-connecting-ip": "7.7.7.7" }), {}, false)
    expect(a).toBe(SHARED_CLIENT_BUCKET)
    expect(b).toBe(SHARED_CLIENT_BUCKET)
  })

  it("ignores x-forwarded-for and x-real-ip on an unknown host too", () => {
    expect(
      clientRateLimitId(h({ "x-forwarded-for": "1.2.3.4", "x-real-ip": "1.2.3.4" }), {}, false),
    ).toBe(SHARED_CLIENT_BUCKET)
  })

  it("on Vercel uses x-real-ip and ignores a spoofed cf-connecting-ip", () => {
    expect(
      clientRateLimitId(
        h({ "x-real-ip": "1.1.1.1", "cf-connecting-ip": "6.6.6.6" }),
        { VERCEL: "1" },
        false,
      ),
    ).toBe("1.1.1.1")
  })

  it("on Cloudflare Workers uses cf-connecting-ip", () => {
    expect(
      clientRateLimitId(
        h({ "cf-connecting-ip": "3.3.3.3", "x-forwarded-for": "9.9.9.9" }),
        {},
        true,
      ),
    ).toBe("3.3.3.3")
  })

  it("takes the first hop of a configured x-forwarded-for", () => {
    expect(
      clientRateLimitId(
        h({ "x-forwarded-for": " 5.5.5.5 , 10.0.0.1" }),
        { TRUSTED_CLIENT_IP_HEADER: "x-forwarded-for" },
        false,
      ),
    ).toBe("5.5.5.5")
  })

  it("falls back to the shared bucket when the trusted header is missing or blank", () => {
    expect(clientRateLimitId(h({}), { VERCEL: "1" }, false)).toBe(SHARED_CLIENT_BUCKET)
    expect(clientRateLimitId(h({ "x-real-ip": " " }), { VERCEL: "1" }, false)).toBe(
      SHARED_CLIENT_BUCKET,
    )
  })
})

describe("isCloudflareWorkersRuntime", () => {
  it("is false under Node (the test runtime)", () => {
    expect(isCloudflareWorkersRuntime()).toBe(false)
  })
})
