import { describe, expect, it } from "vitest"
import manifest from "./manifest"

describe("manifest", () => {
  it("is installable: standalone display with a start URL", () => {
    const m = manifest()
    expect(m.display).toBe("standalone")
    expect(m.start_url).toBe("/calculator")
    expect(m.name).toBeTruthy()
    expect(m.short_name).toBeTruthy()
  })

  it("declares 192 and 512 PNG icons", () => {
    const icons = manifest().icons ?? []
    expect(icons).toContainEqual({ src: "/icon1", sizes: "192x192", type: "image/png" })
    expect(icons).toContainEqual({ src: "/icon2", sizes: "512x512", type: "image/png" })
  })

  it("uses the brand teal and light background colors", () => {
    const m = manifest()
    expect(m.theme_color).toBe("#178262")
    expect(m.background_color).toBe("#faf9fb")
  })
})
