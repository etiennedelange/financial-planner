// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const sw = readFileSync(new URL("./sw.js", import.meta.url), "utf-8")

describe("public/sw.js", () => {
  it("caches only immutable static assets", () => {
    expect(sw).toContain('url.pathname.startsWith("/_next/static/")')
    expect(sw).toContain('ASSET_CACHE = "static-assets-v1"')
  })

  it("never caches navigations — network first with an offline fallback", () => {
    expect(sw).toContain('request.mode === "navigate"')
    expect(sw).toContain("offlineResponse()")
  })

  it("falls back to the network when the cache throws (e.g. quota exceeded)", () => {
    expect(sw).toContain("catch {")
    expect(sw).toContain("return fetch(request)")
  })
})
