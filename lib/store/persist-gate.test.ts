import { describe, it, expect, beforeEach } from "vitest"
import { createGatedPersistStorage } from "./persist-gate"

const KEY = "gate-test-key"

describe("createGatedPersistStorage", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("drops writes until released so pre-hydration state can never clobber persisted data", () => {
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.setItem(KEY, { state: { n: 1 }, version: 2 })
    expect(localStorage.getItem(KEY)).toBeNull()

    storage.release()
    storage.setItem(KEY, { state: { n: 2 }, version: 2 })
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ state: { n: 2 }, version: 2 })
  })

  it("reads persisted values regardless of gate state", () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { n: 9 }, version: 2 }))
    const storage = createGatedPersistStorage<{ n: number }>()!
    expect(storage.getItem(KEY)).toEqual({ state: { n: 9 }, version: 2 })
  })

  it("supports removeItem", () => {
    localStorage.setItem(KEY, JSON.stringify({ state: { n: 9 }, version: 2 }))
    const storage = createGatedPersistStorage<{ n: number }>()!
    storage.removeItem(KEY)
    expect(localStorage.getItem(KEY)).toBeNull()
  })

  it("returns undefined when localStorage is unavailable (SSR fallback)", () => {
    const original = window.localStorage
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("no localStorage")
      },
    })
    try {
      expect(createGatedPersistStorage<{ n: number }>()).toBeUndefined()
    } finally {
      Object.defineProperty(window, "localStorage", {
        configurable: true,
        value: original,
      })
    }
  })
})
