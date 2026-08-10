import { describe, it, expect, vi, afterEach } from "vitest"
import { checkRateLimit } from "./rate-limit"

describe("checkRateLimit", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("allows requests up to the limit", () => {
    const key = `test-${Math.random()}`
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
    expect(checkRateLimit(key, 3, 60_000).allowed).toBe(true)
  })

  it("blocks once the limit is exceeded", () => {
    const key = `test-${Math.random()}`
    checkRateLimit(key, 2, 60_000)
    checkRateLimit(key, 2, 60_000)
    const result = checkRateLimit(key, 2, 60_000)
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
  })

  it("resets the window after it expires", () => {
    vi.useFakeTimers()
    const key = `test-${Math.random()}`
    checkRateLimit(key, 1, 1_000)
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(false)
    vi.advanceTimersByTime(1_001)
    expect(checkRateLimit(key, 1, 1_000).allowed).toBe(true)
  })

  it("tracks independent keys separately", () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    checkRateLimit(a, 1, 60_000)
    expect(checkRateLimit(a, 1, 60_000).allowed).toBe(false)
    expect(checkRateLimit(b, 1, 60_000).allowed).toBe(true)
  })
})
