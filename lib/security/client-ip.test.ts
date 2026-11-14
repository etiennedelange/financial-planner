import { describe, it, expect } from "vite-plus/test"
import { clientIp } from "./client-ip"

const h = (entries: Record<string, string>) => new Headers(entries)

describe("clientIp", () => {
  it("on Vercel, trusts x-real-ip over a client-sent cf-connecting-ip", () => {
    expect(
      clientIp(h({ "x-real-ip": "1.1.1.1", "cf-connecting-ip": "6.6.6.6" }), { VERCEL: "1" }),
    ).toBe("1.1.1.1")
  })

  it("on Vercel, falls back to the first x-forwarded-for hop", () => {
    expect(clientIp(h({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }), { VERCEL: "1" })).toBe("2.2.2.2")
  })

  it("off Vercel, prefers Cloudflare's cf-connecting-ip", () => {
    expect(clientIp(h({ "cf-connecting-ip": "3.3.3.3", "x-forwarded-for": "9.9.9.9" }), {})).toBe(
      "3.3.3.3",
    )
  })

  it("then x-real-ip, then x-forwarded-for", () => {
    expect(clientIp(h({ "x-real-ip": "4.4.4.4", "x-forwarded-for": "9.9.9.9" }), {})).toBe(
      "4.4.4.4",
    )
    expect(clientIp(h({ "x-forwarded-for": " 5.5.5.5 , 10.0.0.1" }), {})).toBe("5.5.5.5")
  })

  it("returns 'unknown' when no header is present or the value is blank", () => {
    expect(clientIp(h({}), {})).toBe("unknown")
    expect(clientIp(h({ "x-forwarded-for": " " }), { VERCEL: "1" })).toBe("unknown")
  })
})
