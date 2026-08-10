import { describe, it, expect } from "vitest"
import { safeNext } from "./safe-redirect"

const origin = "https://app.example.com"

describe("safeNext", () => {
  describe("valid same-origin targets", () => {
    it("preserves a relative path", () => {
      expect(safeNext("/settings", origin)).toBe("/settings")
    })

    it("preserves query and hash", () => {
      expect(safeNext("/plan?x=1#section", origin)).toBe("/plan?x=1#section")
    })

    it("defaults to /calculator when next is null", () => {
      expect(safeNext(null, origin)).toBe("/calculator")
    })

    it("defaults to /calculator when next is empty", () => {
      expect(safeNext("", origin)).toBe("/calculator")
    })
  })

  describe("open redirect attempts", () => {
    it("neutralizes userinfo-style host confusion to a same-origin path", () => {
      expect(safeNext("@evil.com", origin)).toBe("/@evil.com")
    })

    it("rejects an absolute URL to another origin", () => {
      expect(safeNext("https://evil.com", origin)).toBe("/calculator")
    })

    it("rejects a protocol-relative URL", () => {
      expect(safeNext("//evil.com", origin)).toBe("/calculator")
    })

    it("rejects a backslash variant browsers normalize to //", () => {
      expect(safeNext("/\\evil.com", origin)).toBe("/calculator")
    })

    it("neutralizes an encoded absolute URL to a same-origin path", () => {
      expect(safeNext("https:%2f%2fevil.com", origin)).toBe("/%2f%2fevil.com")
    })

    it("rejects a different scheme on the same host", () => {
      expect(safeNext("javascript:alert(1)", origin)).toBe("/calculator")
    })
  })
})
