import { afterEach, describe, expect, it, vi } from "vitest"
import { isAuthEnabled } from "./features"

describe("isAuthEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("is off when the variable is unset", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", undefined)
    expect(isAuthEnabled()).toBe(false)
  })

  it("is on only for the exact string 'true'", () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", "true")
    expect(isAuthEnabled()).toBe(true)
  })

  it.each(["false", "1", "TRUE", "yes", ""])("is off for %j", (value) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_ENABLED", value)
    expect(isAuthEnabled()).toBe(false)
  })
})
